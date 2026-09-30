# Database Architecture

Accountability Watch uses **SQLite** for persistent storage of all incident reports, evidence, and administrative data.

## Why SQLite?

SQLite is chosen for this project because:

- ✅ **Zero Configuration** - No separate server to install or manage
- ✅ **Single File** - Easy to backup, version control, distribute
- ✅ **ACID Transactions** - Data consistency guaranteed
- ✅ **Full-Text Search** - Built-in FTS5 for semantic queries
- ✅ **Type Safety** - Schema enforcement
- ✅ **Excellent for Academic Projects** - Easy to understand and deploy

For production civic infrastructure at scale, consider PostgreSQL or other enterprise databases.

## Database Location

SQLite database is stored at:

```
accountability-watch.db  (root directory)
```

This file is:

- ❌ Not tracked by Git (.gitignore)
- ✅ Created automatically on first run
- ✅ Portable (can copy between machines)
- ✅ Human-readable (can inspect with SQLite tools)

## Schema Overview

### Entity Relationship Diagram

```
┌─────────────────────────────┐
│   incident_reports          │
├─────────────────────────────┤
│ id (PK)                     │
│ report_code (UNIQUE)        │
│ incident_at                 │
│ location_text               │
│ description                 │
│ status                      │
│ submission_mode             │
│ urgent_flag                 │
│ reporter_name (encrypted)   │
│ reporter_contact (enc)      │
│ witness_name (encrypted)    │
│ witness_contact (encrypted) │
│ created_at                  │
│ updated_at                  │
└──────────────┬──────────────┘
               │ (1:N)
               │
┌──────────────▼──────────────┐
│   report_evidence           │
├─────────────────────────────┤
│ id (PK)                     │
│ report_id (FK)              │
│ storage_path                │
│ file_name                   │
│ content_type                │
│ size_bytes                  │
│ sha256 (integrity)          │
│ media_timestamp             │
│ created_at                  │
└─────────────────────────────┘

┌──────────────────────────────┐
│ report_status_history        │
├──────────────────────────────┤
│ id (PK)                      │
│ report_id (FK)               │
│ from_status                  │
│ to_status                    │
│ changed_by (user_id)         │
│ note                         │
│ changed_at                   │
└──────────────────────────────┘

┌──────────────────────────────┐
│   user_roles                 │
├──────────────────────────────┤
│ id (PK)                      │
│ user_id (UNIQUE)             │
│ role (enum)                  │
│ assigned_at                  │
└──────────────────────────────┘

┌──────────────────────────────┐
│   audit_log                  │
├──────────────────────────────┤
│ id (PK)                      │
│ action                       │
│ table_name                   │
│ record_id                    │
│ changes (JSON)               │
│ user_id                      │
│ created_at                   │
└──────────────────────────────┘
```

## Tables

### incident_reports

Core table for incident documentation.

| Column             | Type    | Description                               | Constraints         |
| ------------------ | ------- | ----------------------------------------- | ------------------- |
| `id`               | TEXT    | Unique report identifier                  | PRIMARY KEY         |
| `report_code`      | TEXT    | User-facing code (AW-12345)               | UNIQUE, NOT NULL    |
| `incident_at`      | TEXT    | When incident occurred (ISO 8601)         | NOT NULL            |
| `location_text`    | TEXT    | Incident location description             | NOT NULL, >0 length |
| `city`             | TEXT    | City/area                                 | Optional            |
| `incident_type`    | TEXT    | Category (excessive_force, etc.)          | IN enum             |
| `description`      | TEXT    | Detailed incident description             | NOT NULL, >0 length |
| `injury_details`   | TEXT    | Description of injuries                   | Optional            |
| `badge_or_unit`    | TEXT    | Officer identification                    | Optional            |
| `submission_mode`  | TEXT    | anonymous \| identified                   | NOT NULL            |
| `urgent_flag`      | BOOLEAN | Priority flag                             | NOT NULL, DEFAULT 0 |
| `status`           | TEXT    | Current status (pending_moderation, etc.) | NOT NULL, IN enum   |
| `consent_given`    | BOOLEAN | User consent to share (anonymized)        | NOT NULL, DEFAULT 1 |
| `reporter_name`    | TEXT    | Reporter name (ENCRYPTED)                 | Optional            |
| `reporter_contact` | TEXT    | Reporter email/phone (ENCRYPTED)          | Optional            |
| `witness_name`     | TEXT    | Witness name (ENCRYPTED)                  | Optional            |
| `witness_contact`  | TEXT    | Witness contact (ENCRYPTED)               | Optional            |
| `gps_latitude`     | REAL    | Incident latitude                         | Optional            |
| `gps_longitude`    | REAL    | Incident longitude                        | Optional            |
| `gps_accuracy`     | REAL    | GPS accuracy in meters                    | Optional            |
| `created_at`       | TEXT    | Report submission time                    | NOT NULL            |
| `updated_at`       | TEXT    | Last modification time                    | NOT NULL            |

**Indexes:**

- `idx_incident_reports_status_created` - For dashboard filtering
- `idx_incident_reports_moderation_urgent` - For moderation queue
- `idx_incident_reports_city_created` - For geographic analysis
- `idx_incident_reports_incident_at` - For timeline queries

### report_evidence

Stores metadata about uploaded evidence files.

| Column                | Type    | Description                             |
| --------------------- | ------- | --------------------------------------- |
| `id`                  | TEXT    | Unique evidence identifier              | PRIMARY KEY           |
| `report_id`           | TEXT    | Reference to incident_reports           | FK, NOT NULL, CASCADE |
| `storage_path`        | TEXT    | File storage location                   | NOT NULL              |
| `file_name`           | TEXT    | Original filename                       | NOT NULL              |
| `content_type`        | TEXT    | MIME type (image/jpeg, video/mp4, etc.) | Optional              |
| `size_bytes`          | INTEGER | File size in bytes                      | Optional              |
| `sha256`              | TEXT    | SHA-256 hash for integrity verification | 64 chars              |
| `gps_latitude`        | REAL    | Geolocation metadata                    | Optional              |
| `gps_longitude`       | REAL    | Geolocation metadata                    | Optional              |
| `gps_accuracy_meters` | REAL    | GPS accuracy                            | Optional              |
| `media_timestamp`     | TEXT    | When media was captured                 | Optional              |
| `created_at`          | TEXT    | When uploaded                           | NOT NULL              |
| `updated_at`          | TEXT    | Last modification                       | NOT NULL              |

**Purpose:**

- Stores file metadata (not the actual file, which lives on filesystem)
- SHA-256 enables integrity verification
- GPS data preserved for location analysis

**Indexes:**

- `idx_report_evidence_report_id_created` - Find evidence by report
- `idx_report_evidence_sha256` - Detect duplicate files

### report_status_history

Audit trail of status changes.

| Column        | Type | Description                   |
| ------------- | ---- | ----------------------------- |
| `id`          | TEXT | Unique entry identifier       | PRIMARY KEY                         |
| `report_id`   | TEXT | Reference to incident_reports | FK, NOT NULL, CASCADE               |
| `from_status` | TEXT | Previous status               | Optional (null for first)           |
| `to_status`   | TEXT | New status                    | NOT NULL, IN enum                   |
| `changed_by`  | TEXT | User who made change          | Optional (admin/system)             |
| `note`        | TEXT | Reason for status change      | Optional                            |
| `changed_at`  | TEXT | Timestamp                     | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Purpose:**

- Complete audit trail of all status transitions
- Legal compliance (track who did what when)
- User can see why their report status changed

**Indexes:**

- `idx_report_status_history_report_id` - Timeline for specific report

### user_roles

Maps users to authorization levels.

| Column        | Type | Description               |
| ------------- | ---- | ------------------------- |
| `id`          | TEXT | Unique role assignment ID | PRIMARY KEY                          |
| `user_id`     | TEXT | User identifier           | UNIQUE, NOT NULL                     |
| `role`        | TEXT | Role name                 | IN (admin, legal_partner, moderator) |
| `assigned_at` | TEXT | When role was assigned    | NOT NULL                             |

**Roles:**

- `admin` - System administration, user management
- `legal_partner` - Access to moderation queue, case export
- `moderator` - Can review and approve/reject reports

**Indexes:**

- `idx_user_roles_user_id` - Quick permission lookups

### audit_log

Complete record of all system actions.

| Column       | Type | Description          |
| ------------ | ---- | -------------------- |
| `id`         | TEXT | Unique log entry ID  | PRIMARY KEY |
| `action`     | TEXT | Action performed     | NOT NULL    |
| `table_name` | TEXT | Affected table       | Optional    |
| `record_id`  | TEXT | Affected record ID   | Optional    |
| `changes`    | TEXT | JSON of changes made | Optional    |
| `user_id`    | TEXT | Who performed action | Optional    |
| `created_at` | TEXT | When action occurred | NOT NULL    |

**Purpose:**

- GDPR compliance (track data access/modification)
- Security auditing (detect unauthorized access)
- Debugging (understand system state changes)

**Indexes:**

- `idx_audit_log_created_at` - Query by time
- `idx_audit_log_record_id` - Find all actions on specific record

## Data Constraints

### Referential Integrity

All foreign keys have `ON DELETE CASCADE`:

- If a report is deleted, all evidence and history is automatically deleted
- Maintains referential integrity

### Check Constraints

- `incident_reports.location_text` - Must have non-zero length
- `incident_reports.description` - Must have non-zero length
- `incident_reports.submission_mode` - Must be 'anonymous' or 'identified'
- `incident_reports.status` - Must be valid status
- `incident_reports.incident_type` - Must be valid category or NULL
- `report_evidence.sha256` - If present, must be exactly 64 characters

### Valid Status Values

```
'new'
'under_review'
'pending_moderation'
'moderation_approved'
'moderation_rejected'
'referred'
'closed'
```

### Valid Incident Types

```
'excessive_force'
'unlawful_detention'
'property_damage'
'harassment'
'wrongful_arrest'
'illegal_search'
'lack_of_due_process'
'other'
```

## Important Features

### PRAGMA Directives

Must be set on every database connection:

```sql
PRAGMA foreign_keys = ON;     -- Enable referential integrity
PRAGMA journal_mode = WAL;    -- Write-ahead logging for concurrency
```

### Encrypted Columns

These columns store encrypted data (AES-256-GCM):

- `reporter_name`
- `reporter_contact`
- `witness_name`
- `witness_contact`

Encryption is transparent to SQL queries but raw values are ciphertext + IV + salt.

### Indexes Strategy

Indexes optimize these query patterns:

1. **Dashboard filtering** - Filter by status and date
2. **Moderation queue** - Get pending, urgent reports
3. **Geographic search** - Filter by city/location
4. **Evidence lookup** - Find files by report
5. **Duplicate detection** - Find files by SHA-256 hash
6. **Timeline queries** - Sort by incident date
7. **Compliance** - Audit log lookups

Minimize unnecessary indexes to maintain write performance.

## Queries

### Common Queries

**Get pending moderation queue:**

```sql
SELECT id, report_code, created_at, urgent_flag
FROM incident_reports
WHERE status = 'pending_moderation'
ORDER BY urgent_flag DESC, created_at ASC;
```

**Find reports for a location:**

```sql
SELECT id, incident_at, description
FROM incident_reports
WHERE city = 'Seattle'
  AND status IN ('moderation_approved', 'referred')
ORDER BY incident_at DESC;
```

**Get evidence for a report:**

```sql
SELECT id, file_name, sha256, created_at
FROM report_evidence
WHERE report_id = ?
ORDER BY created_at ASC;
```

**Audit trail for a report:**

```sql
SELECT from_status, to_status, changed_by, note, changed_at
FROM report_status_history
WHERE report_id = ?
ORDER BY changed_at ASC;
```

**Find duplicate evidence (same SHA-256):**

```sql
SELECT sha256, COUNT(*) as count
FROM report_evidence
WHERE sha256 IS NOT NULL
GROUP BY sha256
HAVING count > 1;
```

## Transactions

Critical operations use transactions for consistency:

```typescript
BEGIN TRANSACTION;
  INSERT INTO incident_reports (...) VALUES (...);
  INSERT INTO report_evidence (...) VALUES (...);
  INSERT INTO report_status_history (...) VALUES (...);
  INSERT INTO audit_log (...) VALUES (...);
COMMIT;
```

If any step fails, entire transaction rolls back (no partial writes).

## Backups

SQLite database file can be backed up by:

1. Copying `accountability-watch.db` file
2. Using `VACUUM INTO` for optimized copy
3. Using automated backup tools

## Performance Considerations

- SQLite performs well for this project's scale
- Single-file format simplifies deployment
- WAL mode improves concurrent access
- Indexes on high-frequency queries
- No n+1 query problems (see code reviews)

For millions of reports at scale, consider migrating to PostgreSQL with:

- Connection pooling
- Replication
- Advanced partitioning
- Full-text search optimization

## Migrations

As of v1.0, no migration system is used (single schema version). For future versions:

1. Add schema versioning table
2. Create migration files with up/down SQL
3. Track applied migrations
4. Document breaking changes

Example migration pattern:

```sql
-- migrations/001_initial_schema.sql
CREATE TABLE ...
```

## Testing

Database tests verify:

- Schema integrity
- Constraint enforcement
- Transaction atomicity
- Foreign key cascades
- Index performance
- Duplicate detection

See `tests/` directory for test suites.

---

**Database Schema Version**: 1.0  
**Last Updated**: 2026
