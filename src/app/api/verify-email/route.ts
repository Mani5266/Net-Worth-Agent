import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyToken } from "@/lib/email-verification";
import { createLimiter, getClientIdentifier } from "@/lib/ratelimit";

const verifyEmailLimit = createLimiter("verify-email", { requests: 15, window: "1 h" });

// ─── GET /api/verify-email?token=xxx ──────────────────────────────────────────
// Clicked from the verification email link.
// Verifies the token atomically, then redirects to login with status params.

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Rate limit
  const ipId = getClientIdentifier(req);
  const rl = await verifyEmailLimit.check(ipId);
  if (!rl.success) {
    return NextResponse.redirect(new URL("/login?error=ratelimit", appUrl));
  }

  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      console.log("[VERIFY_EMAIL] No token in query params");
      return NextResponse.redirect(
        new URL("/login?error=invalid", appUrl)
      );
    }

    console.log("[VERIFY_EMAIL] Attempting verification", {
      tokenLength: token.length,
      tokenPrefix: token.slice(0, 8),
    });

    const result = await verifyToken(token);

    console.log("[VERIFY_EMAIL] Result", { success: result.success });

    if (result.success) {
      return NextResponse.redirect(
        new URL("/login?verified=true", appUrl)
      );
    }

    return NextResponse.redirect(
      new URL("/login?error=expired", appUrl)
    );
  } catch (err) {
    console.error("[VERIFY_EMAIL] Unexpected error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.redirect(
      new URL("/login?error=expired", appUrl)
    );
  }
}
