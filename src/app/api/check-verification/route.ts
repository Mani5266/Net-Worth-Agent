import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { createLimiter, getClientIdentifier, rateLimitResponse } from "@/lib/ratelimit";

const checkVerifLimit = createLimiter("check-verif", { requests: 20, window: "1 h" });

// ─── POST /api/check-verification ─────────────────────────────────────────────
// Server-side check of custom_email_verified using admin client.
// Requires authenticated session — userId is derived from session, not request body.
// Returns { verified: boolean } — never exposes user details.

export async function POST(req: NextRequest) {
  // Rate limit
  const ipId = getClientIdentifier(req);
  const rl = await checkVerifLimit.check(ipId);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    // 1. Require authenticated session
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { verified: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    // 2. Look up verification status via admin client using session userId
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(user.id);

    if (error || !data?.user) {
      console.log("[CHECK_VERIFICATION] User lookup failed", {
        userId: user.id,
        error: error?.message ?? "no user",
      });
      return NextResponse.json({ verified: false });
    }

    const confirmed = data.user.app_metadata?.custom_email_verified === true;
    console.log("[CHECK_VERIFICATION]", {
      userId: user.id,
      custom_email_verified: data.user.app_metadata?.custom_email_verified ?? "NOT_SET",
      verified: confirmed,
    });

    return NextResponse.json({ verified: confirmed });
  } catch (err) {
    console.error("[CHECK_VERIFICATION] Unexpected error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ verified: false }, { status: 500 });
  }
}
