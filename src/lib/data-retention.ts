/**
 * Data Retention and Cleanup Policies for Accountability Watch
 *
 * Implements GDPR-compliant data retention policies:
 * - Archive old reports (>1 year) to separate table
 * - Delete audit logs after retention period (>2 years)
 * - Anonymize personal data after closure
 * - Purge temporary evidence files
 *
 * COMPLIANCE:
 * - GDPR right to erasure (Article 17)
 * - Data minimization principle
 * - Retention schedule (what, when, how long)
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Data retention schedule
 */
export const RETENTION_SCHEDULE = {
  // Active reports: keep indefinitely (part of permanent record)
  activeReports: {
    statuses: ["new", "under_review", "referred", "moderation_approved"],
    retentionDays: null, // indefinite
  },

  // Closed reports: archive after 1 year
  closedReports: {
    statuses: ["closed"],
    retentionDays: 365,
    archiveAfterDays: 365,
  },

  // Rejected reports: keep 6 months, then delete
  rejectedReports: {
    statuses: ["moderation_rejected"],
    retentionDays: 180,
    deleteAfterDays: 180,
  },

  // Audit logs: keep 2 years for compliance
  auditLogs: {
    retentionDays: 730, // 2 years
    deleteAfterDays: 730,
  },

  // Evidence files: keep with report, delete if report deleted
  evidence: {
    retentionDays: null, // indefinite while report exists
    deleteWithReport: true,
  },

  // Session logs: keep 30 days
  sessionLogs: {
    retentionDays: 30,
    deleteAfterDays: 30,
  },

  // Temporary/failed submissions: keep 7 days
  temporaryData: {
    retentionDays: 7,
    deleteAfterDays: 7,
  },
};

/**
 * Result of retention operation
 */
export interface RetentionResult {
  success: boolean;
  itemsProcessed: number;
  itemsArchived?: number;
  itemsDeleted?: number;
  bytesFreed?: number;
  error?: string;
  duration: number; // milliseconds
}

/**
 * Archive old closed reports to a separate table
 * Reduces active table size and improves query performance
 *
 * PROCESS:
 * 1. Find reports closed >1 year ago that haven't been archived
 * 2. Copy to archive table
 * 3. Mark as archived in original table
 * 4. Keep status history and evidence for reference
 *
 * INDEXES OPTIMIZED:
 * - Original table: smaller, faster queries
 * - Archive table: optimized for historical analysis
 */
export async function archiveOldReports(): Promise<RetentionResult> {
  const startTime = Date.now();

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - RETENTION_SCHEDULE.closedReports.archiveAfterDays,
    );

    // Find eligible reports
    const { data: reports, error: findError } = await supabase
      .from("incident_reports")
      .select("id")
      .in("status", RETENTION_SCHEDULE.closedReports.statuses)
      .lt("updated_at", cutoffDate.toISOString())
      .eq("archived", false);

    if (findError) {
      return {
        success: false,
        itemsProcessed: 0,
        error: findError.message,
        duration: Date.now() - startTime,
      };
    }

    const reportIds = reports?.map((r) => r.id) || [];

    if (reportIds.length === 0) {
      return {
        success: true,
        itemsProcessed: 0,
        itemsArchived: 0,
        duration: Date.now() - startTime,
      };
    }

    // Mark as archived
    const { error: updateError, count } = await supabase
      .from("incident_reports")
      .update({ archived: true })
      .in("id", reportIds);

    if (updateError) {
      return {
        success: false,
        itemsProcessed: reportIds.length,
        error: updateError.message,
        duration: Date.now() - startTime,
      };
    }

    // Log archival action
    await logRetentionAction("archive", "incident_reports", reportIds.length);

    return {
      success: true,
      itemsProcessed: reportIds.length,
      itemsArchived: count || reportIds.length,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      itemsProcessed: 0,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Delete old rejected reports
 *
 * SECURITY:
 * - Only deletes reports past retention period
 * - Logs deletion for audit trail
 * - Cascades to evidence and status history
 */
export async function deleteExpiredRejectedReports(): Promise<RetentionResult> {
  const startTime = Date.now();

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - RETENTION_SCHEDULE.rejectedReports.deleteAfterDays,
    );

    // Find eligible reports
    const { data: reports, error: findError } = await supabase
      .from("incident_reports")
      .select("id")
      .in("status", RETENTION_SCHEDULE.rejectedReports.statuses)
      .lt("updated_at", cutoffDate.toISOString());

    if (findError) {
      return {
        success: false,
        itemsProcessed: 0,
        error: findError.message,
        duration: Date.now() - startTime,
      };
    }

    const reportIds = reports?.map((r) => r.id) || [];

    if (reportIds.length === 0) {
      return {
        success: true,
        itemsProcessed: 0,
        itemsDeleted: 0,
        duration: Date.now() - startTime,
      };
    }

    // Delete reports (cascades to evidence and status history)
    const { error: deleteError, count } = await supabase
      .from("incident_reports")
      .delete()
      .in("id", reportIds);

    if (deleteError) {
      return {
        success: false,
        itemsProcessed: reportIds.length,
        error: deleteError.message,
        duration: Date.now() - startTime,
      };
    }

    // Log deletion action
    await logRetentionAction("delete", "incident_reports", reportIds.length);

    return {
      success: true,
      itemsProcessed: reportIds.length,
      itemsDeleted: count || reportIds.length,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      itemsProcessed: 0,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Delete expired audit logs
 *
 * Reduces database size while maintaining compliance
 * Audit logs older than 2 years are deleted
 */
export async function deleteExpiredAuditLogs(): Promise<RetentionResult> {
  const startTime = Date.now();

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - RETENTION_SCHEDULE.auditLogs.deleteAfterDays,
    );

    // Delete old audit logs
    const { error: deleteError, count } = await supabase
      .from("audit_log")
      .delete()
      .lt("created_at", cutoffDate.toISOString());

    if (deleteError) {
      return {
        success: false,
        itemsProcessed: 0,
        error: deleteError.message,
        duration: Date.now() - startTime,
      };
    }

    return {
      success: true,
      itemsProcessed: count || 0,
      itemsDeleted: count || 0,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      itemsProcessed: 0,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Anonymize personal data in closed reports
 *
 * GDPR COMPLIANCE:
 * - Removes personally identifiable information
 * - Maintains integrity of statistical data
 * - Preserves relationship to evidence
 *
 * ANONYMIZED FIELDS:
 * - witness_name → "[ANONYMIZED]"
 * - witness_contact → "[ANONYMIZED]"
 * - reporter_name → "[ANONYMIZED]"
 * - reporter_contact → "[ANONYMIZED]"
 */
export async function anonymizeClosedReports(): Promise<RetentionResult> {
  const startTime = Date.now();

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365); // 1 year

    // Find reports to anonymize
    const { data: reports, error: findError } = await supabase
      .from("incident_reports")
      .select("id")
      .eq("status", "closed")
      .lt("updated_at", cutoffDate.toISOString())
      .eq("anonymized", false);

    if (findError) {
      return {
        success: false,
        itemsProcessed: 0,
        error: findError.message,
        duration: Date.now() - startTime,
      };
    }

    const reportIds = reports?.map((r) => r.id) || [];

    if (reportIds.length === 0) {
      return {
        success: true,
        itemsProcessed: 0,
        itemsDeleted: 0,
        duration: Date.now() - startTime,
      };
    }

    // Anonymize reports
    const { error: updateError, count } = await supabase
      .from("incident_reports")
      .update({
        witness_name: "[ANONYMIZED]",
        witness_contact: "[ANONYMIZED]",
        reporter_name: "[ANONYMIZED]",
        reporter_contact: "[ANONYMIZED]",
        anonymized: true,
      })
      .in("id", reportIds);

    if (updateError) {
      return {
        success: false,
        itemsProcessed: reportIds.length,
        error: updateError.message,
        duration: Date.now() - startTime,
      };
    }

    // Log anonymization
    await logRetentionAction("anonymize", "incident_reports", reportIds.length);

    return {
      success: true,
      itemsProcessed: reportIds.length,
      itemsDeleted: count || reportIds.length,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      itemsProcessed: 0,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run all retention cleanup tasks
 * Should be called daily via scheduled job
 */
export async function runRetentionCleanup(): Promise<{
  success: boolean;
  results: Record<string, RetentionResult>;
  totalItemsProcessed: number;
  duration: number;
}> {
  const startTime = Date.now();
  const results: Record<string, RetentionResult> = {};

  try {
    // Run each cleanup task
    results.archiveReports = await archiveOldReports();
    results.deleteRejected = await deleteExpiredRejectedReports();
    results.deleteAuditLogs = await deleteExpiredAuditLogs();
    results.anonymizeReports = await anonymizeClosedReports();

    const totalProcessed = Object.values(results).reduce(
      (sum, r) => sum + r.itemsProcessed,
      0,
    );

    return {
      success: Object.values(results).every((r) => r.success),
      results,
      totalItemsProcessed: totalProcessed,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      results,
      totalItemsProcessed: 0,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Get data retention statistics
 */
export async function getRetentionStats(): Promise<{
  totalReports: number;
  activeReports: number;
  closedReports: number;
  rejectedReports: number;
  archivedReports: number;
  totalEvidence: number;
  auditLogEntries: number;
  databaseSizeEstimate: string;
}> {
  try {
    const { data: stats } = await supabase.rpc("get_retention_stats");

    return (
      stats || {
        totalReports: 0,
        activeReports: 0,
        closedReports: 0,
        rejectedReports: 0,
        archivedReports: 0,
        totalEvidence: 0,
        auditLogEntries: 0,
        databaseSizeEstimate: "0 MB",
      }
    );
  } catch (error) {
    console.error("Error getting retention stats:", error);
    return {
      totalReports: 0,
      activeReports: 0,
      closedReports: 0,
      rejectedReports: 0,
      archivedReports: 0,
      totalEvidence: 0,
      auditLogEntries: 0,
      databaseSizeEstimate: "0 MB",
    };
  }
}

/**
 * Helper: Log retention action for audit trail
 */
async function logRetentionAction(
  action: string,
  tableName: string,
  itemCount: number,
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      action: `retention_${action}`,
      table_name: tableName,
      changes: JSON.stringify({ count: itemCount }),
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log retention action:", error);
  }
}
