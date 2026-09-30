-- ═════════════════════════════════════════════════════════════════════════════
-- COMPLETE DATABASE MIGRATION FOR ACCOUNTABILITY WATCH
-- Copy this entire file and paste it in Supabase SQL Editor
-- Run it all at once
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CREATE ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE public.report_status AS ENUM ('new', 'under_review', 'referred', 'closed', 'pending_moderation', 'moderation_approved', 'moderation_rejected');
CREATE TYPE public.app_role AS ENUM ('admin', 'legal_partner');
CREATE TYPE public.incident_type AS ENUM ('excessive_force', 'unlawful_detention', 'property_damage', 'harassment', 'wrongful_arrest', 'illegal_search', 'lack_of_due_process', 'other');
CREATE TYPE public.submission_mode AS ENUM ('anonymous', 'identified');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CREATE USER ROLES TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CREATE HAS_ROLE FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CREATE INCIDENT REPORTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code text NOT NULL UNIQUE DEFAULT ('AW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  incident_at timestamptz NOT NULL,
  location_text text NOT NULL,
  city text,
  description text NOT NULL,
  injury_details text,
  badge_or_unit text,
  witness_name text,
  witness_contact text,
  reporter_name text,
  reporter_contact text,
  consent_given boolean NOT NULL DEFAULT false,
  status public.report_status NOT NULL DEFAULT 'pending_moderation',
  incident_type public.incident_type,
  submission_mode public.submission_mode NOT NULL DEFAULT 'identified',
  urgent_flag boolean NOT NULL DEFAULT false,
  is_moderated boolean NOT NULL DEFAULT false,
  gps_latitude numeric,
  gps_longitude numeric,
  gps_accuracy numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_consent_given CHECK (consent_given = true),
  CONSTRAINT chk_location_text_nonempty CHECK (length(trim(location_text)) > 0),
  CONSTRAINT chk_description_nonempty CHECK (length(trim(description)) >= 10)
);

GRANT INSERT ON public.incident_reports TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.incident_reports TO authenticated;
GRANT ALL ON public.incident_reports TO service_role;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit reports" ON public.incident_reports
  FOR INSERT TO anon, authenticated WITH CHECK (consent_given = true);

CREATE POLICY "staff can view reports" ON public.incident_reports
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'legal_partner')
  );

CREATE POLICY "staff can update reports" ON public.incident_reports
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'legal_partner')
  );

CREATE POLICY "admins can delete reports" ON public.incident_reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CREATE INDEXES ON INCIDENT REPORTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_incident_reports_status ON public.incident_reports(status);
CREATE INDEX idx_incident_reports_created_at ON public.incident_reports(created_at DESC);
CREATE INDEX idx_incident_reports_urgent_flag ON public.incident_reports(urgent_flag) WHERE urgent_flag = true;
CREATE INDEX idx_incident_reports_is_moderated ON public.incident_reports(is_moderated);
CREATE INDEX idx_incident_reports_incident_type ON public.incident_reports(incident_type);
CREATE INDEX idx_incident_reports_submission_mode ON public.incident_reports(submission_mode);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CREATE UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN 
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER incident_reports_set_updated_at
  BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CREATE REPORT EVIDENCE TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  content_type text,
  size_bytes bigint,
  sha256 text NOT NULL,
  gps_latitude numeric,
  gps_longitude numeric,
  gps_accuracy_meters numeric,
  media_timestamp timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.report_evidence TO anon, authenticated;
GRANT SELECT, DELETE ON public.report_evidence TO authenticated;
GRANT ALL ON public.report_evidence TO service_role;
ALTER TABLE public.report_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can attach evidence" ON public.report_evidence
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "staff can view evidence" ON public.report_evidence
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'legal_partner')
  );

CREATE POLICY "admins can delete evidence" ON public.report_evidence
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CREATE STATUS HISTORY TABLE (AUDIT LOG)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.report_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  old_status public.report_status,
  new_status public.report_status NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

GRANT SELECT ON public.report_status_history TO authenticated;
GRANT ALL ON public.report_status_history TO service_role;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff can view history" ON public.report_status_history
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'legal_partner')
  );

CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.report_status_history (report_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER log_report_status_change
  AFTER UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CREATE FILE UPLOAD LOG AND VALIDATION
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.evidence_upload_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.incident_reports(id) ON DELETE SET NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  rejected boolean DEFAULT false,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.evidence_upload_log TO authenticated;
GRANT ALL ON public.evidence_upload_log TO service_role;
ALTER TABLE public.evidence_upload_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_file_upload()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Check file size (25 MB = 26214400 bytes)
  IF NEW.size_bytes > 26214400 THEN
    INSERT INTO evidence_upload_log (file_name, file_size, mime_type, rejected, rejection_reason)
    VALUES (NEW.file_name, NEW.size_bytes, NEW.content_type, true, 'File exceeds 25 MB limit');
    RAISE EXCEPTION 'File exceeds maximum size of 25 MB';
  END IF;

  -- Check MIME type
  IF NEW.content_type NOT IN (
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf'
  ) THEN
    INSERT INTO evidence_upload_log (file_name, file_size, mime_type, rejected, rejection_reason)
    VALUES (NEW.file_name, NEW.size_bytes, NEW.content_type, true, 'MIME type not allowed');
    RAISE EXCEPTION 'File type not allowed';
  END IF;

  -- Log accepted upload
  INSERT INTO evidence_upload_log (report_id, file_name, file_size, mime_type, rejected)
  VALUES (NEW.report_id, NEW.file_name, NEW.size_bytes, NEW.content_type, false);

  RETURN NEW;
END; $$;

CREATE TRIGGER validate_file_upload_trigger
  BEFORE INSERT ON public.report_evidence
  FOR EACH ROW EXECUTE FUNCTION public.validate_file_upload();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CREATE RESOURCE LINKS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text NOT NULL,
  category text,
  city text,
  country text DEFAULT 'India',
  language text DEFAULT 'en',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.resource_links TO anon, authenticated;
GRANT ALL ON public.resource_links TO service_role;
ALTER TABLE public.resource_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view resources" ON public.resource_links
  FOR SELECT TO anon, authenticated USING (is_active = true);

INSERT INTO public.resource_links (title, description, url, category, country) VALUES
  ('NHRC - National Human Rights Commission', 'File complaints about police misconduct', 'https://nhrc.nic.in', 'Legal Aid', 'India'),
  ('ACLU - American Civil Liberties Union', 'Legal support for civil rights violations', 'https://www.aclu.org', 'Legal Aid', 'USA'),
  ('Amnesty International', 'Global human rights organization', 'https://www.amnesty.org', 'Advocacy', NULL)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. CREATE PUBLIC STATS FUNCTION (Privacy-protected aggregates)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.public_incident_stats(
  from_date timestamptz DEFAULT NULL,
  to_date timestamptz DEFAULT NULL,
  city_filter text DEFAULT NULL
)
RETURNS TABLE (
  total_reports bigint,
  by_city jsonb,
  by_month jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH filtered AS (
    SELECT * FROM public.incident_reports
    WHERE (from_date IS NULL OR incident_at >= from_date)
      AND (to_date IS NULL OR incident_at <= to_date)
      AND (city_filter IS NULL OR city_filter = '' OR city ILIKE city_filter)
  )
  SELECT
    (SELECT count(*) FROM filtered)::bigint AS total_reports,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('city', c, 'count', ct) ORDER BY ct DESC)
      FROM (SELECT COALESCE(NULLIF(city, ''), 'Unspecified') AS c, count(*) AS ct FROM filtered GROUP BY 1) t
    ), '[]'::jsonb) AS by_city,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'count', ct) ORDER BY m)
      FROM (SELECT to_char(date_trunc('month', incident_at), 'YYYY-MM') AS m, count(*) AS ct FROM filtered GROUP BY 1) t
    ), '[]'::jsonb) AS by_month;
$$;

GRANT EXECUTE ON FUNCTION public.public_incident_stats(timestamptz, timestamptz, text) TO anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- COMMIT ALL CHANGES
-- ═════════════════════════════════════════════════════════════════════════════

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═════════════════════════════════════════════════════════════════════════════

-- Run these to verify all tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT COUNT(*) as policies FROM pg_policies WHERE tablename IN ('incident_reports', 'report_evidence', 'user_roles', 'resource_links');
-- SELECT COUNT(*) as triggers FROM information_schema.triggers WHERE trigger_schema = 'public';

-- That's it! Your database is now ready!
