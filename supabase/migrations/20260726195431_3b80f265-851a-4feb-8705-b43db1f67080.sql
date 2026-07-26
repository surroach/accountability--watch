
-- Enums
CREATE TYPE public.report_status AS ENUM ('new', 'under_review', 'referred', 'closed');
CREATE TYPE public.app_role AS ENUM ('admin', 'legal_partner');

-- User roles table
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

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Incident reports
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
  status public.report_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.incident_reports TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.incident_reports TO authenticated;
GRANT ALL ON public.incident_reports TO service_role;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can submit
CREATE POLICY "anyone can submit reports" ON public.incident_reports
  FOR INSERT TO anon, authenticated WITH CHECK (consent_given = true);

-- Only admins/legal partners can view or manage
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

-- Report evidence
CREATE TABLE public.report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  content_type text,
  size_bytes bigint,
  sha256 text NOT NULL,
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

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER incident_reports_set_updated_at
  BEFORE UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public aggregate: counts by city and by month, no PII
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
