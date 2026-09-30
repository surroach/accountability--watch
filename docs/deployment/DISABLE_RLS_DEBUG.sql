-- Disable RLS temporarily for debugging
-- This allows anonymous users to submit reports without RLS policies blocking them

ALTER TABLE public.incident_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_evidence DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "allow_anon_insert_reports" ON public.incident_reports;
DROP POLICY IF EXISTS "allow_anon_insert_evidence" ON public.report_evidence;
DROP POLICY IF EXISTS "anyone_insert" ON public.incident_reports;
DROP POLICY IF EXISTS "admin_view_reports" ON public.incident_reports;
DROP POLICY IF EXISTS "allow_anon_upload_evidence" ON storage.objects;
DROP POLICY IF EXISTS "allow_anon_read_evidence" ON storage.objects;
DROP POLICY IF EXISTS "allow_admin_read_evidence" ON storage.objects;
DROP POLICY IF EXISTS "allow_admin_delete_evidence" ON storage.objects;

-- Verify tables are accessible
SELECT 'incident_reports' as table_name, rls_enabled FROM (
  SELECT relname, row_level_security_enabled FROM pg_class 
  WHERE relname = 'incident_reports'
) AS t(relname, rls_enabled);
