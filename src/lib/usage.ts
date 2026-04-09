import { createSupabaseServerClient } from "./supabase-server";

/**
 * Logs a usage event (fire-and-forget).
 * Called from API route handlers AFTER a successful response.
 * Uses the server-side Supabase client (cookie-based auth → RLS applies).
 *
 * Never throws — logging failures must not break the user's request.
 */
export function logUsage(
  userId: string,
  feature: string,
  metadata: Record<string, unknown> = {}
): void {
  // Fire-and-forget — wrapped in Promise.resolve() because Supabase returns PromiseLike
  try {
    const supabase = createSupabaseServerClient();
    Promise.resolve(
      supabase
        .from("usage_logs")
        .insert({ user_id: userId, feature, metadata })
    ).then(({ error }) => {
      if (error) {
        console.error("[USAGE_LOG_FAIL]", { feature, error });
      }
    }).catch((err: unknown) => {
      console.error("[USAGE_LOG_FAIL]", { feature, err });
    });
  } catch (err) {
    // Even constructing the client could fail — swallow it
    console.error("[USAGE_LOG_FAIL]", { feature, err });
  }
}
