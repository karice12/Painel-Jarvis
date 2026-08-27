import { saveAuditLogToDb } from "./supabaseDb";
import { User } from "../types";

export interface LogActionParams {
  action: string;
  details: string;
  resource?: string;
  status?: "success" | "warning" | "denied";
  metadata?: any;
  user?: User | null;
  tenantId?: string;
  ip?: string;
}

/**
 * Global helper to record an audit action synchronously across UI, Supabase and Express Backend
 */
export function recordAuditAction({
  action,
  details,
  resource,
  status = "success",
  metadata,
  user,
  tenantId,
  ip = "189.40.122.15",
}: LogActionParams): void {
  const currentTenantId = tenantId || user?.tenantId || "tenant_omni_01";
  const currentUserId = user?.id || "usr_master_01";
  const currentUserName = user?.name || "Karice Pelegrino";
  const currentUserEmail = user?.email || "pelegrinokarol@gmail.com";
  const currentUserRole = user?.role || "master_admin";

  const logPayload = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    tenantId: currentTenantId,
    userId: currentUserId,
    userName: currentUserName,
    userEmail: currentUserEmail,
    userRole: currentUserRole,
    action,
    details,
    resource: resource || details,
    status,
    ip,
    metadata: metadata || null,
  };

  // Persists to Supabase + Backend + Dispatches client event
  saveAuditLogToDb(logPayload).catch((err) => {
    console.warn("Error recording audit action:", err);
  });
}
