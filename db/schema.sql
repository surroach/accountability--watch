-- Accountability Watch - SQLite Schema
-- Complete database schema for local development
-- 
-- IMPORTANT: Enable foreign key enforcement with:
-- PRAGMA foreign_keys = ON;
--
-- This must be set on EVERY database connection.

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS incident_reports (
  id TEXT PRIMARY KEY,
  report_code TEXT UNIQUE NOT NULL,
  incident_at TEXT NOT NULL,
  location_text TEXT NOT NULL,
  city TEXT,
  incident_type TEXT,
  description TEXT NOT NULL,
  injury_details TEXT,
  badge_or_unit TEXT,
  submission_mode TEXT NOT NULL DEFAULT 'anonymous',
  urgent_flag BOOLEAN NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_moderation',
  consent_given BOOLEAN NOT NULL DEFAULT 1,
  witness_name TEXT,
  witness_contact TEXT,
  reporter_name TEXT,
  reporter_contact TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- Constraints for data quality
  CHECK (length(location_text) > 0),
  CHECK (length(description) > 0),
  CHECK (submission_mode IN ('anonymous', 'identified')),
  CHECK (status IN ('new', 'under_review', 'referred', 'closed', 'pending_moderation', 'moderation_approved', 'moderation_rejected')),
  CHECK (incident_type IS NULL OR incident_type IN ('excessive_force', 'unlawful_detention', 'property_damage', 'harassment', 'wrongful_arrest', 'illegal_search', 'lack_of_due_process', 'other'))
);

CREATE TABLE IF NOT EXISTS report_evidence (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy_meters REAL,
  media_timestamp TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES incident_reports(id) ON DELETE CASCADE,
  CHECK (length(file_name) > 0),
  CHECK (sha256 IS NULL OR length(sha256) = 64)
);

CREATE TABLE IF NOT EXISTS report_status_history (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  note TEXT,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES incident_reports(id) ON DELETE CASCADE,
  CHECK (to_status IN ('new', 'under_review', 'referred', 'closed', 'pending_moderation', 'moderation_approved', 'moderation_rejected'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  CHECK (role IN ('admin', 'legal_partner', 'moderator'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  changes TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL
);

-- Indexes for performance optimization
-- Important: Indexes on frequently queried columns only

-- Reports filtered by status and creation date (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_incident_reports_status_created 
  ON incident_reports(status, created_at DESC);

-- Moderation queue (pending reports)
CREATE INDEX IF NOT EXISTS idx_incident_reports_moderation_urgent 
  ON incident_reports(is_moderated, urgent_flag, created_at DESC);

-- Geographic filtering for dashboard
CREATE INDEX IF NOT EXISTS idx_incident_reports_city_created 
  ON incident_reports(city, created_at DESC) 
  WHERE status IN ('moderation_approved', 'referred');

-- Evidence lookup by report
CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id_created 
  ON report_evidence(report_id, created_at DESC);

-- Evidence hash lookup (integrity verification)
CREATE INDEX IF NOT EXISTS idx_report_evidence_sha256
  ON report_evidence(sha256);

-- Incident timeline
CREATE INDEX IF NOT EXISTS idx_incident_reports_incident_at 
  ON incident_reports(incident_at DESC);

-- User roles lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
  ON user_roles(user_id);

-- Audit trail (for compliance)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_record_id
  ON audit_log(record_id);

-- Status history timeline
CREATE INDEX IF NOT EXISTS idx_report_status_history_report_id
  ON report_status_history(report_id, changed_at DESC);
