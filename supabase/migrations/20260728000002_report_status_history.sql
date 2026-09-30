-- =============================================================================
-- Migration: report_status_history
-- Creates an append-only audit log of every status transition on a report.
-- Rows are written by a trigger on incident_reports so no application code
-- can accidentally skip the log.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.report_status_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid        NOT NULL
                              REFERENCES public.incident_reports(id)
                              ON DELETE CASCADE,
  -- The status the report moved FROM (NULL on the very first insert)
  from_status   public.report_status,
  -- The status the report moved TO
  to_status     public.report_status NOT NULL,
  -- auth.uid() of the person who made the change, NULL for system/anon inserts
  changed_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Free-text note (e.g. "Referred to HRLN — case #2024-087")
  note          text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the two most common access patterns
CREATE INDEX IF NOT EXISTS idx_status_history_report_id
  ON public.report_status_history(report_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_changed_by
  ON public.report_status_history(changed_by);

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT ON public.report_status_history TO authenticated;
GRANT ALL    ON public.report_status_history TO service_role;
-- Anon users cannot read history (no PII risk, but defence-in-depth)

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;

-- Staff (admin + legal_partner) can read all history rows
CREATE POLICY "staff can view status history"
  ON public.report_status_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'legal_partner')
  );

-- Only admins can delete history rows (break-glass; should almost never be used)
CREATE POLICY "admins can delete status history"
  ON public.report_status_history
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Trigger: auto-log every status change ─────────────────────────────────────
-- Fires AFTER UPDATE so NEW.status is the committed value.
-- Also fires AFTER INSERT to record the initial status.
CREATE OR REPLACE FUNCTION public.log_report_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.report_status_history (report_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.report_status_history (report_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

-- INSERT trigger (captures initial status on report creation)
DROP TRIGGER IF EXISTS trg_log_status_on_insert ON public.incident_reports;
CREATE TRIGGER trg_log_status_on_insert
  AFTER INSERT ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.log_report_status_change();

-- UPDATE trigger (captures every subsequent status transition)
DROP TRIGGER IF EXISTS trg_log_status_on_update ON public.incident_reports;
CREATE TRIGGER trg_log_status_on_update
  AFTER UPDATE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.log_report_status_change();
