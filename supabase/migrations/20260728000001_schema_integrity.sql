-- =============================================================================
-- Migration: schema integrity
-- Fixes: enum promotions, NOT NULL enforcement, GPS columns on incident_reports,
--        consent check constraint
-- Safe to run on an existing database — all steps are idempotent or additive.
-- =============================================================================

-- ── 1. Promote report_status enum ────────────────────────────────────────────
-- The initial migration only declared: new, under_review, referred, closed
-- The app also uses: pending_moderation, moderation_approved, moderation_rejected
-- ALTER TYPE … ADD VALUE is non-transactional in Postgres; each call is its own
-- implicit transaction and cannot be inside an explicit BEGIN/COMMIT.

ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'pending_moderation';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'moderation_approved';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'moderation_rejected';

-- ── 2. Create proper enums for incident_type and submission_mode ──────────────
-- These columns were added as plain `text` in migration 2.  We promote them
-- to typed enums so the DB enforces valid values, not just the app layer.

DO $$ BEGIN
  CREATE TYPE public.incident_type AS ENUM (
    'excessive_force',
    'unlawful_detention',
    'property_damage',
    'harassment',
    'wrongful_arrest',
    'illegal_search',
    'lack_of_due_process',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_mode AS ENUM ('anonymous', 'identified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Cast incident_reports columns to the new enum types ───────────────────
-- Step A: drop the DEFAULT so ALTER TYPE can proceed without conflict
ALTER TABLE public.incident_reports
  ALTER COLUMN submission_mode DROP DEFAULT;

-- Step B: cast text → enum (NULL values are preserved; invalid values would
--         error here, which is intentional — surface data problems early)
ALTER TABLE public.incident_reports
  ALTER COLUMN incident_type
    TYPE public.incident_type USING incident_type::public.incident_type;

ALTER TABLE public.incident_reports
  ALTER COLUMN submission_mode
    TYPE public.submission_mode USING submission_mode::public.submission_mode;

-- Step C: restore the default using the enum literal, then set NOT NULL
ALTER TABLE public.incident_reports
  ALTER COLUMN submission_mode SET DEFAULT 'identified'::public.submission_mode;

ALTER TABLE public.incident_reports
  ALTER COLUMN submission_mode SET NOT NULL;

-- incident_type stays nullable — reporters aren't required to classify the type.
-- urgent_flag and is_moderated: ensure NOT NULL with sensible defaults
ALTER TABLE public.incident_reports
  ALTER COLUMN urgent_flag SET NOT NULL,
  ALTER COLUMN urgent_flag SET DEFAULT false;

ALTER TABLE public.incident_reports
  ALTER COLUMN is_moderated SET NOT NULL,
  ALTER COLUMN is_moderated SET DEFAULT false;

-- ── 4. Add GPS columns to incident_reports (device location at report time) ──
-- These appear in types.ts Row but were never added in a migration.
ALTER TABLE public.incident_reports
  ADD COLUMN IF NOT EXISTS gps_latitude  numeric,
  ADD COLUMN IF NOT EXISTS gps_longitude numeric,
  ADD COLUMN IF NOT EXISTS gps_accuracy  numeric;

-- ── 5. Consent check constraint ───────────────────────────────────────────────
-- The RLS INSERT policy already enforces consent_given = true, but a DB-level
-- check is a belt-and-braces defence (works even if RLS is bypassed via
-- service_role or direct DB access).
ALTER TABLE public.incident_reports
  DROP CONSTRAINT IF EXISTS chk_consent_given;

ALTER TABLE public.incident_reports
  ADD CONSTRAINT chk_consent_given CHECK (consent_given = true);

-- ── 6. NOT NULL already confirmed on required text fields ────────────────────
-- incident_at, location_text, description are already NOT NULL from migration 1.
-- We add a belt-and-braces length guard so empty strings can't sneak through.
ALTER TABLE public.incident_reports
  DROP CONSTRAINT IF EXISTS chk_location_text_nonempty,
  DROP CONSTRAINT IF EXISTS chk_description_nonempty;

ALTER TABLE public.incident_reports
  ADD CONSTRAINT chk_location_text_nonempty CHECK (length(trim(location_text)) > 0),
  ADD CONSTRAINT chk_description_nonempty   CHECK (length(trim(description))   >= 10);

-- ── 7. Index on status for fast admin queue queries ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_incident_reports_status
  ON public.incident_reports(status);

CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at
  ON public.incident_reports(created_at DESC);
