/**
 * Server-side SQLite report repository.
 * 
 * Accepts an already-open SQLite database connection.
 * Does not open, initialize, or manage the database connection.
 * 
 * Provides:
 * - Insert report (generates ID and report code)
 * - Read report by ID
 * 
 * All database operations use parameterized prepared statements.
 * No personal data or report contents are logged.
 */

import { randomUUID } from 'node:crypto';

/**
 * Create a report repository bound to an open SQLite connection.
 * 
 * @param {import('node:sqlite').DatabaseSync} database - Open SQLite connection
 * @returns {Object} Repository with insert and read methods
 */
export function createReportRepository(database) {
  if (!database) {
    throw new Error('Database connection is required');
  }

  return {
    /**
     * Insert a report and return the created record.
     * 
     * @param {Object} reportData - Report data matching schema
     * @returns {Object} Inserted record with id and report_code
     * @throws {Error} If required fields are missing or database error occurs
     */
    insertReport(reportData) {
      // Validate required fields
      if (!reportData.incident_at) {
        throw new Error('incident_at is required');
      }
      if (!reportData.location_text) {
        throw new Error('location_text is required');
      }
      if (!reportData.description) {
        throw new Error('description is required');
      }

      // Compute effective submission_mode ONCE
      // Default to 'anonymous' if omitted, null, or empty
      const effectiveMode = reportData.submission_mode || 'anonymous';
      
      // Reject unsupported modes
      if (effectiveMode !== 'anonymous' && effectiveMode !== 'identified') {
        throw new Error(`Unsupported submission_mode: ${effectiveMode}. Must be 'anonymous' or 'identified'.`);
      }

      // Generate server-side ID and report code
      // Use separate randomUUID for reference code to guarantee uniqueness
      const id = randomUUID();
      const reportCode = `RPT-${randomUUID()}`;
      const now = new Date().toISOString();
      
      // For anonymous reports, never persist contact details
      // Use the SAME effective mode that will be stored
      const isAnonymous = (effectiveMode === 'anonymous');
      const witnessName = isAnonymous ? null : (reportData.witness_name || null);
      const witnessContact = isAnonymous ? null : (reportData.witness_contact || null);
      const reporterName = isAnonymous ? null : (reportData.reporter_name || null);
      const reporterContact = isAnonymous ? null : (reportData.reporter_contact || null);

      // Prepare statement with all parameters
      const stmt = database.prepare(`
        INSERT INTO incident_reports (
          id,
          report_code,
          incident_at,
          location_text,
          city,
          incident_type,
          description,
          injury_details,
          badge_or_unit,
          submission_mode,
          urgent_flag,
          status,
          consent_given,
          witness_name,
          witness_contact,
          reporter_name,
          reporter_contact,
          gps_latitude,
          gps_longitude,
          gps_accuracy,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        stmt.run(
          id,
          reportCode,
          reportData.incident_at,
          reportData.location_text,
          reportData.city || null,
          reportData.incident_type || null,
          reportData.description,
          reportData.injury_details || null,
          reportData.badge_or_unit || null,
          effectiveMode,
          reportData.urgent_flag ? 1 : 0,
          reportData.status || 'pending_moderation',
          reportData.consent_given ? 1 : 0,
          witnessName,
          witnessContact,
          reporterName,
          reporterContact,
          reportData.gps_latitude || null,
          reportData.gps_longitude || null,
          reportData.gps_accuracy || null,
          now,
          now
        );

        // Return the created record info (not full data)
        return {
          id,
          report_code: reportCode,
          created_at: now,
        };
      } catch (err) {
        throw new Error(`Failed to insert report: ${err.message}`);
      }
    },

    /**
     * Read a report by its ID.
     * 
     * @param {string} reportId - The report UUID
     * @returns {Object|null} The report record or null if not found
     * @throws {Error} If database error occurs
     */
    readReportById(reportId) {
      if (!reportId) {
        throw new Error('reportId is required');
      }

      const stmt = database.prepare(`
        SELECT
          id,
          report_code,
          incident_at,
          location_text,
          city,
          incident_type,
          description,
          injury_details,
          badge_or_unit,
          submission_mode,
          urgent_flag,
          status,
          consent_given,
          witness_name,
          witness_contact,
          reporter_name,
          reporter_contact,
          created_at,
          updated_at
        FROM incident_reports
        WHERE id = ?
      `);

      try {
        const result = stmt.get(reportId);
        // Convert SQLite integer booleans back to JavaScript booleans
        if (result) {
          result.urgent_flag = Boolean(result.urgent_flag);
          result.consent_given = Boolean(result.consent_given);
        }
        return result || null;
      } catch (err) {
        throw new Error(`Failed to read report: ${err.message}`);
      }
    },
  };
}
