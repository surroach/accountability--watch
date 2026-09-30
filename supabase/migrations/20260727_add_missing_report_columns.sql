-- Add missing columns to incident_reports table
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS incident_type text;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS submission_mode text DEFAULT 'identified';
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS urgent_flag boolean DEFAULT false;
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS is_moderated boolean DEFAULT false;

-- Add GPS metadata columns to report_evidence table
ALTER TABLE public.report_evidence ADD COLUMN IF NOT EXISTS gps_latitude numeric;
ALTER TABLE public.report_evidence ADD COLUMN IF NOT EXISTS gps_longitude numeric;
ALTER TABLE public.report_evidence ADD COLUMN IF NOT EXISTS gps_accuracy_meters numeric;
ALTER TABLE public.report_evidence ADD COLUMN IF NOT EXISTS media_timestamp timestamptz;

-- Create index on urgent_flag for faster querying
CREATE INDEX IF NOT EXISTS idx_incident_reports_urgent_flag 
  ON public.incident_reports(urgent_flag) 
  WHERE urgent_flag = true;

-- Create index on is_moderated for faster querying
CREATE INDEX IF NOT EXISTS idx_incident_reports_is_moderated 
  ON public.incident_reports(is_moderated);

-- Create index on incident_type for filtering
CREATE INDEX IF NOT EXISTS idx_incident_reports_incident_type 
  ON public.incident_reports(incident_type);

-- Create index on submission_mode for filtering
CREATE INDEX IF NOT EXISTS idx_incident_reports_submission_mode 
  ON public.incident_reports(submission_mode);
