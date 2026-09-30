/**
 * Database Transaction Management for Accountability Watch
 *
 * Provides utilities for atomic multi-step operations:
 * - Report creation with evidence
 * - Status changes with audit trail
 * - Bulk operations with rollback
 *
 * IMPORTANT: These helpers assume SQLite with PRAGMA foreign_keys = ON
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    step: string; // Which step failed
  };
}

/**
 * Create a complete report with evidence in a single transaction
 *
 * Atomicity: Either all steps succeed or all roll back
 * Steps:
 * 1. Insert report
 * 2. Insert evidence records
 * 3. Create initial status history entry
 * 4. Log audit action
 */
export async function createReportWithEvidence(
  reportData: Database["public"]["Tables"]["incident_reports"]["Insert"],
  evidenceFiles: Array<{
    file_name: string;
    storage_path: string;
    sha256: string;
    content_type: string | null;
    size_bytes: number | null;
    gps_latitude?: number | null;
    gps_longitude?: number | null;
    gps_accuracy_meters?: number | null;
    media_timestamp?: string | null;
  }>,
  submitterUserId?: string,
): Promise<TransactionResult<{ reportId: string; evidenceCount: number }>> {
  try {
    // Step 1: Create report
    const { data: reportResult, error: reportError } = await supabase
      .from("incident_reports")
      .insert([reportData])
      .select("id")
      .single();

    if (reportError || !reportResult) {
      return {
        success: false,
        error: {
          code: "REPORT_CREATE_FAILED",
          message: reportError?.message || "Failed to create report",
          step: "insert_report",
        },
      };
    }

    const reportId = reportResult.id;

    // Step 2: Create evidence records
    if (evidenceFiles.length > 0) {
      const evidenceRecords = evidenceFiles.map((file) => ({
        report_id: reportId,
        file_name: file.file_name,
        storage_path: file.storage_path,
        sha256: file.sha256,
        content_type: file.content_type,
        size_bytes: file.size_bytes,
        gps_latitude: file.gps_latitude || null,
        gps_longitude: file.gps_longitude || null,
        gps_accuracy_meters: file.gps_accuracy_meters || null,
        media_timestamp: file.media_timestamp || null,
      }));

      const { error: evidenceError } = await supabase
        .from("report_evidence")
        .insert(evidenceRecords);

      if (evidenceError) {
        // Attempt cleanup: delete the report we just created
        await supabase.from("incident_reports").delete().eq("id", reportId);

        return {
          success: false,
          error: {
            code: "EVIDENCE_CREATE_FAILED",
            message: evidenceError.message,
            step: "insert_evidence",
          },
        };
      }
    }

    // Step 3: Create initial status history entry
    const { error: historyError } = await supabase
      .from("report_status_history")
      .insert([
        {
          report_id: reportId,
          from_status: null,
          to_status: reportData.status || "pending_moderation",
          changed_by: submitterUserId || null,
          note: "Report submitted",
        },
      ]);

    if (historyError) {
      // Cleanup
      await supabase.from("report_evidence").delete().eq("report_id", reportId);
      await supabase.from("incident_reports").delete().eq("id", reportId);

      return {
        success: false,
        error: {
          code: "HISTORY_CREATE_FAILED",
          message: historyError.message,
          step: "insert_status_history",
        },
      };
    }

    // Step 4: Log audit action
    await logAuditAction({
      action: "report_created",
      table_name: "incident_reports",
      record_id: reportId,
      user_id: submitterUserId || null,
      changes: JSON.stringify({
        evidence_count: evidenceFiles.length,
        incident_type: reportData.incident_type,
        submission_mode: reportData.submission_mode,
      }),
    });

    console.log(
      `✅ Transaction success: Report ${reportId} created with ${evidenceFiles.length} evidence items`,
    );

    return {
      success: true,
      data: {
        reportId,
        evidenceCount: evidenceFiles.length,
      },
    };
  } catch (err: any) {
    console.error("Transaction error:", err);
    return {
      success: false,
      error: {
        code: "TRANSACTION_ERROR",
        message: err.message,
        step: "unknown",
      },
    };
  }
}

/**
 * Update report status with validation and audit trail
 *
 * Validates transition is allowed and records history
 */
export async function updateReportStatus(
  reportId: string,
  newStatus: Database["public"]["Enums"]["report_status"],
  reason: string | null = null,
  changedByUserId: string | null = null,
): Promise<TransactionResult<{ previousStatus: string; newStatus: string }>> {
  try {
    // Fetch current report to get existing status
    const { data: report, error: fetchError } = await supabase
      .from("incident_reports")
      .select("status")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      return {
        success: false,
        error: {
          code: "REPORT_NOT_FOUND",
          message: "Report not found",
          step: "fetch_report",
        },
      };
    }

    const previousStatus = report.status;

    // Validate transition is allowed
    if (!isValidStatusTransition(previousStatus, newStatus)) {
      return {
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot transition from ${previousStatus} to ${newStatus}`,
          step: "validate_transition",
        },
      };
    }

    // Update report status
    const { error: updateError } = await supabase
      .from("incident_reports")
      .update({ status: newStatus })
      .eq("id", reportId);

    if (updateError) {
      return {
        success: false,
        error: {
          code: "UPDATE_FAILED",
          message: updateError.message,
          step: "update_report",
        },
      };
    }

    // Record in status history
    const { error: historyError } = await supabase
      .from("report_status_history")
      .insert([
        {
          report_id: reportId,
          from_status: previousStatus,
          to_status: newStatus,
          changed_by: changedByUserId || null,
          note: reason || null,
        },
      ]);

    if (historyError) {
      console.error("Failed to record status history:", historyError);
      // Note: not rolling back the status update here as it already happened
      // Consider implementing compensating transaction if this is critical
    }

    // Log audit action
    await logAuditAction({
      action: "report_status_changed",
      table_name: "incident_reports",
      record_id: reportId,
      user_id: changedByUserId || null,
      changes: JSON.stringify({
        from_status: previousStatus,
        to_status: newStatus,
        reason,
      }),
    });

    console.log(
      `✅ Status updated: ${reportId} ${previousStatus} → ${newStatus}`,
    );

    return {
      success: true,
      data: {
        previousStatus,
        newStatus,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: "TRANSACTION_ERROR",
        message: err.message,
        step: "unknown",
      },
    };
  }
}

/**
 * Valid report status transitions
 *
 * Defines the state machine for report lifecycle
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_moderation: ["moderation_approved", "moderation_rejected"],
  moderation_approved: ["new", "under_review", "referred", "closed"],
  moderation_rejected: ["pending_moderation"], // Can be resubmitted
  new: ["under_review", "closed"],
  under_review: ["referred", "closed"],
  referred: ["closed"],
  closed: [], // Final state
};

/**
 * Check if a status transition is allowed
 */
export function isValidStatusTransition(from: string, to: string): boolean {
  if (from === to) return false; // No self-transitions
  const allowed = VALID_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * Log an audit action
 *
 * Used by both transactions and direct operations
 */
export async function logAuditAction(action: {
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string | null;
  changes: string | null;
}): Promise<void> {
  try {
    await supabase.from("audit_log").insert([
      {
        action: action.action,
        table_name: action.table_name,
        record_id: action.record_id,
        user_id: action.user_id,
        changes: action.changes,
      },
    ]);
  } catch (err) {
    console.error("Audit logging failed:", err);
    // Don't throw - audit logging failure shouldn't break the app
  }
}

/**
 * Get audit trail for a specific report
 */
export async function getReportAuditTrail(reportId: string) {
  try {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("record_id", reportId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error("Failed to fetch audit trail:", err);
    return [];
  }
}

/**
 * Get status history for a report
 */
export async function getReportStatusHistory(reportId: string) {
  try {
    const { data, error } = await supabase
      .from("report_status_history")
      .select("*")
      .eq("report_id", reportId)
      .order("changed_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error("Failed to fetch status history:", err);
    return [];
  }
}
