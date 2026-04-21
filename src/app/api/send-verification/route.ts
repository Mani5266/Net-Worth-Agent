import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  emailVerifyRateLimit,
  emailVerifyIpRateLimit,
  getClientIdentifier,
  rateLimitResponse,
} from "@/lib/ratelimit";
import { createAndSendVerification, clearEmailConfirmation } from "@/lib/email-verification";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";

// ─── POST /api/send-verification ──────────────────────────────────────────────
// Two modes:
//   1. Authenticated: userId derived from session (no body needed)
//   2. Post-signup (signed out): accepts { email, userId } but VERIFIES email matches userId

export async function POST(req: NextRequest) {
  try {
    // 1. Try to get authenticated session first
    const supabase = createSupabaseServerClient();
    const { data: { user: sessionUser } } = await supabase.auth.getUser();

    let targetUserId: string;
    let rateLimitEmail: string;

    if (sessionUser) {
      // Authenticated — use session userId, ignore body
      targetUserId = sessionUser.id;
      rateLimitEmail = sessionUser.email ?? sessionUser.id;
    } else {
      // Unauthenticated (post-signup) — require email + userId, then verify they match
      let body: { email?: unknown; userId?: unknown };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body." },
          { status: 400 }
        );
      }

      const { email, userId } = body;
      if (typeof email !== "string" || !email || typeof userId !== "string" || !userId) {
        return NextResponse.json(
          { success: false, error: "Email and User ID are required." },
          { status: 400 }
        );
      }

      // Verify that the provided email actually belongs to this userId
      const admin = createSupabaseAdminClient();
      const { data: userData, error: lookupError } = await admin.auth.admin.getUserById(userId);
      if (lookupError || !userData?.user || userData.user.email !== email) {
        // Don't reveal whether the user exists
        return NextResponse.json({ success: true, provider: "none" });
      }

      targetUserId = userId;
      rateLimitEmail = email;
    }

    // 2. Dual rate limit — BOTH must pass
    const ip = getClientIdentifier(req);
    const [emailLimit, ipLimit] = await Promise.all([
      emailVerifyRateLimit.check(`email-verify:${rateLimitEmail}`),
      emailVerifyIpRateLimit.check(ip),
    ]);

    if (!emailLimit.success) return rateLimitResponse(emailLimit.reset);
    if (!ipLimit.success) return rateLimitResponse(ipLimit.reset);

    // 3. Clear email_confirmed_at so user starts as unverified
    await clearEmailConfirmation(targetUserId);

    // 4. Create and send verification
    const result = await createAndSendVerification(targetUserId);

    console.log("[SEND_VERIFICATION] Result", {
      success: result.success,
      provider: result.success ? result.provider : undefined,
      error: !result.success ? result.error : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
    });
  } catch (err) {
    console.error("[SEND_VERIFICATION] Unexpected error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
