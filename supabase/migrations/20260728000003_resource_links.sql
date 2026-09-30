-- =============================================================================
-- Migration: resource_links
-- Stores curated external resources (legal aid contacts, rights guides, etc.)
-- that are shown on the /resources page.  Only admins can manage them;
-- anyone (including anon) can read published ones.
-- =============================================================================

CREATE TYPE public.resource_category AS ENUM (
  'legal_aid',
  'know_your_rights',
  'mental_health',
  'journalist',
  'complaint_authority',
  'other'
);

CREATE TABLE IF NOT EXISTS public.resource_links (
  id           uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text                      NOT NULL CHECK (length(trim(title)) > 0),
  url          text                      NOT NULL CHECK (url ~ '^https?://'),
  description  text,
  category     public.resource_category  NOT NULL DEFAULT 'other',
  -- Only published rows are served to the public endpoint
  is_published boolean                   NOT NULL DEFAULT false,
  -- Display order within a category; lower numbers appear first
  sort_order   integer                   NOT NULL DEFAULT 0,
  created_by   uuid                      REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz               NOT NULL DEFAULT now(),
  updated_at   timestamptz               NOT NULL DEFAULT now()
);

-- Keep updated_at current
CREATE TRIGGER resource_links_set_updated_at
  BEFORE UPDATE ON public.resource_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_resource_links_category
  ON public.resource_links(category, sort_order)
  WHERE is_published = true;

-- ── Grants ────────────────────────────────────────────────────────────────────
-- Anon + authenticated can read (RLS will filter to published only)
GRANT SELECT ON public.resource_links TO anon, authenticated;
GRANT ALL    ON public.resource_links TO service_role;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.resource_links ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read published resources
CREATE POLICY "anyone can read published resources"
  ON public.resource_links
  FOR SELECT
  USING (is_published = true);

-- Admins can read everything (including drafts)
CREATE POLICY "admins can read all resources"
  ON public.resource_links
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert, update, delete
CREATE POLICY "admins can insert resources"
  ON public.resource_links
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can update resources"
  ON public.resource_links
  FOR UPDATE TO authenticated
  USING  (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can delete resources"
  ON public.resource_links
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Seed: a handful of real Indian civil-rights resources ─────────────────────
-- These are published immediately so the /resources page isn't empty on deploy.
INSERT INTO public.resource_links (title, url, description, category, is_published, sort_order)
VALUES
  ('People''s Union for Civil Liberties (PUCL)',
   'https://www.pucl.org',
   'National civil liberties organisation providing legal support and documentation for rights violations.',
   'legal_aid', true, 10),

  ('Human Rights Law Network (HRLN)',
   'https://hrln.org',
   'Litigation, advocacy and legal aid for victims of human rights violations across India.',
   'legal_aid', true, 20),

  ('National Human Rights Commission (NHRC)',
   'https://nhrc.nic.in',
   'Statutory body that receives complaints of human rights violations. File a complaint online.',
   'complaint_authority', true, 10),

  ('Know Your Rights During Protest — PUCL Guide',
   'https://www.pucl.org/reports/know-your-rights',
   'Plain-language guide to constitutional rights when attending or organising a protest.',
   'know_your_rights', true, 10),

  ('iCall Psychosocial Helpline',
   'https://icallhelpline.org',
   'Free psychological counselling for individuals experiencing distress, including those who have witnessed violence.',
   'mental_health', true, 10)
ON CONFLICT DO NOTHING;
