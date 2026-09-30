-- Accountability Watch - SQLite Schema
-- Complete database schema for local development

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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(location_text) > 0),
  CHECK (length(description) > 0)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incident_reports_city_created 
  ON incident_reports(city, created_at DESC) 
  WHERE status != 'pending_moderation';

CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id_created 
  ON report_evidence(report_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_reports_incident_at 
  ON incident_reports(incident_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
  ON user_roles(user_id);
