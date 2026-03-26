import { createClient } from "@supabase/supabase-js";

// ─── Admin Client ─────────────────────────────────────────────────────────────
// Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for audit log inserts.
// This key must NEVER be exposed to the browser (no NEXT_PUBLIC_ prefix).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Whether audit logging is active.
 * If the service role key is not configured, audit logging is silently disabled
 * (allows local development without the service key).
 */
const isConfigured = Boolean(supabaseUrl && serviceRoleKey);

function getAdminClient() {
  if (!isConfigured) return null;
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ─── Action Types ─────────────────────────────────────────────────────────────

export type AuditAction =
  | "certificate_created"
  | "certificate_updated"
  | "certificate_renamed"
  | "certificate_deleted"
  | "document_uploaded"
  | "document_deleted"
  | "ocr_processed"
  | "login"
  | "failed_auth"
  | "auto_cleanup"
  | "data_export_requested"
  | "account_deletion_requested";

// ─── Log Function ─────────────────────────────────────────────────────────────

interface LogActionParams {
  userId: string;
  action: AuditAction;
  documentType?: string;
  documentId?: string;
  request?: Request;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a sensitive action to the audit_logs table.
 *
 * Uses the service role key to bypass RLS (users cannot INSERT audit logs
 * directly — only this server-side function can).
 *
 * Fails silently if the service role key is not configured (dev environment)
 * or if the insert fails (audit logging should never break user flows).
 */
export async function logAction({
  userId,
  action,
  documentType,
  documentId,
  request,
  metadata = {},
}: LogActionParams): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return; // Silently skip in dev

  const ip = request?.headers.get("x-forwarded-for")
    ?? request?.headers.get("x-real-ip")
    ?? "unknown";
  const userAgent = request?.headers.get("user-agent") ?? "unknown";

  try {
    await admin.from("audit_logs").insert({
      user_id: userId,
      action,
      document_type: documentType,
      document_id: documentId,
      ip_address: ip.split(",")[0]?.trim(), // Take first IP if multiple
      user_agent: userAgent,
      metadata,
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[Audit] Failed to log action:", err);
  }
}
