import { supabase } from "./supabase";

/**
 * Logs an audit event for a certificate mutation.
 * Called from db.ts (browser Supabase client → RLS applies).
 *
 * SECURITY: RLS policies on `audit_logs` and `certificate_versions` MUST be
 * INSERT-only for the authenticated role. Users must NOT be able to UPDATE or
 * DELETE their own audit trail. Verify with:
 *   - ALTER POLICY ON audit_logs FOR DELETE TO authenticated USING (false);
 *   - Same for certificate_versions.
 *
 * Never throws — audit logging failures must not break the user's operation.
 */
export function logAudit(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  beforeData?: Record<string, unknown> | null,
  afterData?: Record<string, unknown> | null
): void {
  // Fire-and-forget
  try {
    const client = supabase;
    Promise.resolve(
      client
        .from("audit_logs")
        .insert({
          user_id: userId,
          action,
          entity,
          entity_id: entityId,
          before_data: beforeData ?? null,
          after_data: afterData ?? null,
        })
    ).then(({ error }) => {
      if (error) {
        console.error("[AUDIT_LOG_FAIL]", { action, entity, entityId, error });
      }
    }).catch((err: unknown) => {
      console.error("[AUDIT_LOG_FAIL]", { action, entity, entityId, err });
    });
  } catch (err) {
    console.error("[AUDIT_LOG_FAIL]", { action, entity, entityId, err });
  }
}

/**
 * Saves a version snapshot of certificate form_data BEFORE a mutation.
 * Uses browser client — RLS must be INSERT-only (see note above).
 *
 * Never throws — version snapshot failures must not break the user's operation.
 */
export function snapshotVersion(
  userId: string,
  certificateId: string,
  snapshot: Record<string, unknown>
): void {
  // Fire-and-forget
  try {
    const client = supabase;
    Promise.resolve(
      client
        .from("certificate_versions")
        .insert({
          user_id: userId,
          certificate_id: certificateId,
          snapshot,
        })
    ).then(({ error }) => {
      if (error) {
        console.error("[VERSION_SNAPSHOT_FAIL]", { certificateId, error });
      }
    }).catch((err: unknown) => {
      console.error("[VERSION_SNAPSHOT_FAIL]", { certificateId, err });
    });
  } catch (err) {
    console.error("[VERSION_SNAPSHOT_FAIL]", { certificateId, err });
  }
}
