-- ═════════════════════════════════════════════════════════════════════════════
-- CRITICAL FIX SCRIPT FOR ACCOUNTABILITY WATCH
-- Copy and paste ENTIRE file into Supabase SQL Editor
-- Run all at once
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX #1: Replace restrictive RLS policies with permissive ones
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old restrictive policies
DROP POLICY IF EXISTS "anyone can submit reports" ON public.incident_reports;
DROP POLICY IF EXISTS "anyone can attach evidence" ON public.report_evidence;

-- Create new permissive policies that allow anonymous inserts
CREATE POLICY "allow_anon_insert_reports" ON public.incident_reports
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "allow_anon_insert_evidence" ON public.report_evidence
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX #2: Fix storage policies to allow admin read access
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old storage policies
DROP POLICY IF EXISTS "allow_anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "allow_anon_read" ON storage.objects;

-- Create new storage policies
CREATE POLICY "allow_anon_upload_evidence" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'evidence');

CREATE POLICY "allow_anon_read_evidence" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'evidence');

CREATE POLICY "allow_admin_read_evidence" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'evidence' AND (
      SELECT EXISTS(SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
          AND role IN ('admin', 'legal_partner'))
    )
  );

CREATE POLICY "allow_admin_delete_evidence" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'evidence' AND (
      SELECT EXISTS(SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
          AND role = 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX #3: Verify SELECT policies for reports are correct
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "staff can view reports" ON public.incident_reports;

CREATE POLICY "admin_view_reports" ON public.incident_reports
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'legal_partner')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX #4: Add data validation constraints for evidence SHA256
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.report_evidence
  ADD CONSTRAINT IF NOT EXISTS chk_sha256_valid 
    CHECK (length(sha256) = 64 AND sha256 ~ '^[a-f0-9]{64}$');

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX #5: Add indexes for dashboard queries and performance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_incident_reports_city_created 
  ON public.incident_reports(city, created_at DESC) 
  WHERE status != 'pending_moderation';

CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id_created 
  ON public.report_evidence(report_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_reports_incident_at 
  ON public.incident_reports(incident_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX #6: Ensure grants are correct for anon role
-- ─────────────────────────────────────────────────────────────────────────────

GRANT INSERT ON public.incident_reports TO anon;
GRANT INSERT ON public.report_evidence TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX #7: Add missing table constraints
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.incident_reports
  ADD CONSTRAINT IF NOT EXISTS chk_city_length CHECK (city IS NULL OR length(trim(city)) > 0);

ALTER TABLE public.incident_reports
  ADD CONSTRAINT IF NOT EXISTS chk_badge_length CHECK (badge_or_unit IS NULL OR length(trim(badge_or_unit)) > 0);

ALTER TABLE public.report_evidence
  ADD CONSTRAINT IF NOT EXISTS chk_file_name_nonempty CHECK (file_name IS NULL OR length(trim(file_name)) > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX #8: Ensure RLS is enabled on all security-sensitive tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES - Run these to confirm all fixes applied
-- ═════════════════════════════════════════════════════════════════════════════

-- Check RLS policies exist and are correct:
-- SELECT * FROM pg_policies WHERE tablename IN ('incident_reports', 'report_evidence') ORDER BY tablename, policyname;

-- Check storage policies:
-- SELECT * FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname;

-- Check constraints:
-- SELECT constraint_name, table_name FROM information_schema.table_constraints 
--   WHERE table_schema = 'public' AND constraint_type = 'CHECK' ORDER BY table_name;

-- Check indexes:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('incident_reports', 'report_evidence');

-- Test anonymous insert:
-- INSERT INTO public.incident_reports (incident_at, location_text, description, consent_given) 
--   VALUES (NOW(), 'Test location', 'Test description at least 10 chars', true)
--   RETURNING id, report_code;

