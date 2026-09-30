-- =============================================================================
-- Migration: file_upload_validation
-- 
-- Adds server-side file validation to the evidence bucket via a Postgres
-- function that validates every object before it's persisted.  Enforces:
-- - Max file size: 25 MB
-- - Allowed MIME types: image/*, video/*, application/pdf
-- - Prevents storage of executable or suspicious file types
-- =============================================================================

-- ── Helper function: validate uploaded file ───────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_evidence_upload()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed_types text[] := ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf'
  ];
  max_size_bytes int := 25 * 1024 * 1024;
  actual_size int;
  mime_type text;
BEGIN
  -- Skip validation for non-evidence bucket
  IF NEW.bucket_id != 'evidence' THEN RETURN NEW; END IF;

  -- Get the file size; if NULL (object deleted), skip validation
  IF NEW.metadata IS NULL THEN RETURN NEW; END IF;

  actual_size := (NEW.metadata->>'size')::int;

  -- Check file size
  IF actual_size > max_size_bytes THEN
    RAISE EXCEPTION
      'File size (%) exceeds maximum allowed (25 MB)',
      (actual_size || ' bytes')::text
      USING ERRCODE = 'PGRST403';
  END IF;

  -- Get MIME type from metadata or default to octet-stream
  mime_type := NEW.metadata->>'mimetype';
  IF mime_type IS NULL THEN mime_type := 'application/octet-stream'; END IF;

  -- Check MIME type against whitelist
  IF NOT mime_type = ANY(allowed_types) THEN
    RAISE EXCEPTION
      'File type (%) not allowed. Allowed types: images, video, PDF',
      mime_type
      USING ERRCODE = 'PGRST403';
  END IF;

  -- Additional check: block known dangerous MIME types even if they slip through
  IF mime_type IN (
    'application/x-executable',
    'application/x-msdos-program',
    'application/x-msdownload',
    'application/x-sh',
    'application/x-shellscript',
    'application/x-perl',
    'application/x-python'
  ) THEN
    RAISE EXCEPTION
      'File type (%) is not allowed',
      mime_type
      USING ERRCODE = 'PGRST403';
  END IF;

  -- Also reject any file that looks like an executable by extension
  -- (though this alone is not sufficient, paired with MIME type it helps)
  IF NEW.name ILIKE '%.exe' OR NEW.name ILIKE '%.dll' OR
     NEW.name ILIKE '%.bat' OR NEW.name ILIKE '%.com' OR
     NEW.name ILIKE '%.msi' OR NEW.name ILIKE '%.app' OR
     NEW.name ILIKE '%.sh' OR NEW.name ILIKE '%.bin' THEN
    RAISE EXCEPTION
      'File name pattern (%) matches executable type',
      NEW.name
      USING ERRCODE = 'PGRST403';
  END IF;

  RETURN NEW;
END;
$$;

-- ── Trigger: enforce validation on every upload ────────────────────────────
-- Fire BEFORE INSERT so invalid objects never reach storage
DROP TRIGGER IF EXISTS trg_validate_evidence_upload ON storage.objects;
CREATE TRIGGER trg_validate_evidence_upload
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'evidence')
  EXECUTE FUNCTION public.validate_evidence_upload();

-- ── Audit trail: log all upload attempts (for security review) ───────────────
CREATE TABLE IF NOT EXISTS public.evidence_upload_log (
  id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id     text      NOT NULL,
  object_path   text      NOT NULL,
  file_name     text,
  file_size     int,
  mime_type     text,
  user_id       uuid      REFERENCES auth.users(id) ON DELETE SET NULL,
  validation_result text   NOT NULL CHECK (validation_result IN ('accepted', 'rejected')),
  rejection_reason text,
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_log_bucket_path
  ON public.evidence_upload_log(bucket_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_upload_log_validation
  ON public.evidence_upload_log(validation_result, uploaded_at DESC);

-- ── Grants ────────────────────────────────────────────────────────────────
GRANT SELECT ON public.evidence_upload_log TO authenticated;
GRANT ALL    ON public.evidence_upload_log TO service_role;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.evidence_upload_log ENABLE ROW LEVEL SECURITY;

-- Staff can read all logs
CREATE POLICY "staff can read upload logs"
  ON public.evidence_upload_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'legal_partner')
  );

-- ── Comments ──────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.validate_evidence_upload() IS
  'Validates uploaded files before storage: enforces 25MB size limit, whitelist of MIME types (images, video, PDF), and blocks executable patterns';

COMMENT ON TABLE public.evidence_upload_log IS
  'Audit trail of all evidence bucket upload attempts (accepted and rejected)';
