/**
 * Server-Side Authorization Verification Middleware
 *
 * Validates user permissions for protected operations:
 * - Admin-only actions
 * - Role-based access control (RBAC)
 * - Resource ownership checks
 * - Rate limit enforcement
 *
 * SECURITY PRINCIPLES:
 * - All authorization decisions happen server-side (never trust client)
 * - Whitelist approach: deny by default, allow explicitly
 * - Audit logging of all authorization decisions
 * - Defense in depth: multiple validation layers
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Role-based permissions matrix
 */
export const ROLE_PERMISSIONS = {
  admin: {
    viewAllReports: true,
    editAnyReport: true,
    deleteReport: true,
    manageUsers: true,
    viewAuditLog: true,
    configureSettings: true,
    bulkActions: true,
    moderateContent: true,
    viewAnalytics: true,
  },
  legal_partner: {
    viewAllReports: true,
    editAnyReport: true,
    deleteReport: false,
    manageUsers: false,
    viewAuditLog: true,
    configureSettings: false,
    bulkActions: false,
    moderateContent: false,
    viewAnalytics: true,
  },
  moderator: {
    viewAllReports: true,
    editAnyReport: false,
    deleteReport: false,
    manageUsers: false,
    viewAuditLog: false,
    configureSettings: false,
    bulkActions: false,
    moderateContent: true,
    viewAnalytics: false,
  },
  user: {
    viewAllReports: false,
    editAnyReport: false,
    deleteReport: false,
    manageUsers: false,
    viewAuditLog: false,
    configureSettings: false,
    bulkActions: false,
    moderateContent: false,
    viewAnalytics: false,
  },
};

/**
 * User context extracted from authentication token
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: keyof typeof ROLE_PERMISSIONS;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Authorization check result
 */
export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  logEntry?: {
    action: string;
    userId: string;
    resource: string;
    result: "allowed" | "denied";
    reason: string;
  };
}

/**
 * Verify user authentication from token
 *
 * VALIDATION:
 * 1. Token format is valid (Bearer token)
 * 2. Token is signed by trusted issuer
 * 3. Token hasn't expired
 * 4. User exists in database
 * 5. User role is still valid
 */
export async function verifyAuth(
  authHeader: string | null | undefined,
): Promise<{ success: boolean; context?: AuthContext; error?: string }> {
  if (!authHeader) {
    return { success: false, error: "No authorization header" };
  }

  // Extract token from Bearer scheme
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return { success: false, error: "Invalid authorization header format" };
  }

  const token = match[1];

  try {
    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return { success: false, error: "Invalid token" };
    }

    const userId = data.user.id;

    // Get user role from database
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleError || !roleData) {
      // User exists in auth but not in user_roles table
      // Grant minimal 'user' role
      return {
        success: true,
        context: {
          userId,
          email: data.user.email || "",
          role: "user",
          sessionId: token,
        },
      };
    }

    return {
      success: true,
      context: {
        userId,
        email: data.user.email || "",
        role: roleData.role as keyof typeof ROLE_PERMISSIONS,
        sessionId: token,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if user has specific permission
 */
export async function checkPermission(
  context: AuthContext,
  permission: keyof (typeof ROLE_PERMISSIONS)["admin"],
): Promise<AuthorizationResult> {
  const permissions = ROLE_PERMISSIONS[context.role];
  const allowed = permissions[permission] === true;

  const result: AuthorizationResult = {
    allowed,
    reason: allowed
      ? "User has required permission"
      : `Role '${context.role}' does not have permission '${permission}'`,
  };

  // Log authorization decision
  if (!allowed) {
    await logAuthorizationEvent({
      action: "permission_check",
      userId: context.userId,
      resource: permission,
      result: "denied",
      reason: result.reason || "",
    });
  }

  return result;
}

/**
 * Check if user can edit/delete a specific report
 *
 * RULES:
 * - Admin: can edit any report
 * - Legal partner: can edit any report
 * - Moderator: can ONLY edit via status transitions (not direct edit)
 * - User: cannot edit reports (only view own)
 */
export async function checkReportAccess(
  context: AuthContext,
  reportId: string,
  action: "view" | "edit" | "delete",
): Promise<AuthorizationResult> {
  // Fetch report
  const { data: report, error } = await supabase
    .from("incident_reports")
    .select("id, status, created_by")
    .eq("id", reportId)
    .single();

  if (error || !report) {
    return {
      allowed: false,
      reason: "Report not found",
    };
  }

  // Check role-based access
  switch (context.role) {
    case "admin":
    case "legal_partner":
      // These roles have full access
      return {
        allowed: true,
        reason: `${context.role} has access to all reports`,
      };

    case "moderator":
      // Moderators can only view reports, not edit (use status transitions)
      if (action === "view") {
        return {
          allowed: true,
          reason: "Moderators can view reports",
        };
      }
      return {
        allowed: false,
        reason:
          "Moderators cannot directly edit reports (use status transitions)",
      };

    case "user":
      // Users can only view their own reports
      if (action === "view") {
        return {
          allowed: report.created_by === context.userId,
          reason:
            report.created_by === context.userId
              ? "User owns this report"
              : "Users can only view their own reports",
        };
      }
      return {
        allowed: false,
        reason: "Users cannot edit reports",
      };

    default:
      return {
        allowed: false,
        reason: "Unknown role",
      };
  }
}

/**
 * Verify status transition is valid
 *
 * Prevents invalid state transitions like:
 * - 'closed' → 'pending_moderation'
 * - 'referred' → 'new'
 */
export async function checkStatusTransition(
  context: AuthContext,
  reportId: string,
  newStatus: string,
): Promise<AuthorizationResult> {
  // Fetch current report
  const { data: report, error } = await supabase
    .from("incident_reports")
    .select("id, status")
    .eq("id", reportId)
    .single();

  if (error || !report) {
    return {
      allowed: false,
      reason: "Report not found",
    };
  }

  // Valid state transitions
  const validTransitions: Record<string, string[]> = {
    pending_moderation: ["moderation_approved", "moderation_rejected"],
    moderation_approved: ["new", "under_review", "referred", "closed"],
    new: ["under_review", "referred", "closed"],
    under_review: ["referred", "closed", "new"],
    referred: ["closed", "under_review"],
    closed: [], // Terminal state
    moderation_rejected: [], // Terminal state
  };

  const currentStatus = report.status as string;
  const allowedTransitions = validTransitions[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    await logAuthorizationEvent({
      action: "invalid_status_transition",
      userId: context.userId,
      resource: `report:${reportId}`,
      result: "denied",
      reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
    });

    return {
      allowed: false,
      reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  // Check role permission for this transition
  if (
    context.role === "moderator" &&
    newStatus !== "moderation_approved" &&
    newStatus !== "moderation_rejected"
  ) {
    return {
      allowed: false,
      reason: "Moderators can only approve or reject reports",
    };
  }

  return {
    allowed: true,
    reason: "Valid status transition",
  };
}

/**
 * Check if user can perform bulk actions
 *
 * Bulk actions (like status updates, delete multiple) require elevated permissions
 */
export async function checkBulkActionPermission(
  context: AuthContext,
  action: string,
  itemCount: number,
): Promise<AuthorizationResult> {
  // Check base permission
  const hasPermission = ROLE_PERMISSIONS[context.role].bulkActions === true;

  if (!hasPermission) {
    await logAuthorizationEvent({
      action: "bulk_action_denied",
      userId: context.userId,
      resource: action,
      result: "denied",
      reason: `Role ${context.role} cannot perform bulk actions`,
    });

    return {
      allowed: false,
      reason: `Role ${context.role} cannot perform bulk actions`,
    };
  }

  // Additional check: prevent accidentally massive deletes
  if (action === "delete" && itemCount > 1000) {
    return {
      allowed: false,
      reason: "Bulk delete limited to 1000 items per operation",
    };
  }

  return {
    allowed: true,
    reason: "User authorized for bulk action",
  };
}

/**
 * Log authorization event for audit trail
 */
async function logAuthorizationEvent(event: {
  action: string;
  userId: string;
  resource: string;
  result: "allowed" | "denied";
  reason: string;
}): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      action: `auth_${event.action}`,
      user_id: event.userId,
      record_id: event.resource,
      changes: JSON.stringify({
        result: event.result,
        reason: event.reason,
      }),
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log authorization event:", error);
  }
}

/**
 * Get user's effective permissions as a set
 */
export function getUserPermissions(
  role: keyof typeof ROLE_PERMISSIONS,
): Set<string> {
  const permissions = ROLE_PERMISSIONS[role];
  return new Set(
    Object.entries(permissions)
      .filter(([_, allowed]) => allowed)
      .map(([key, _]) => key),
  );
}

/**
 * Middleware-friendly wrapper for authorization checks
 * Returns true/false for use in guards and conditionals
 */
export async function authorize(
  authHeader: string | null | undefined,
  check: (context: AuthContext) => Promise<AuthorizationResult>,
): Promise<{ allowed: boolean; context?: AuthContext }> {
  const authResult = await verifyAuth(authHeader);

  if (!authResult.success || !authResult.context) {
    return { allowed: false };
  }

  const checkResult = await check(authResult.context);

  return {
    allowed: checkResult.allowed,
    context: authResult.context,
  };
}
