import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyToken } from "@/lib/email-verification";

// ─── GET /api/verify-email?token=xxx ──────────────────────────────────────────
// Clicked from the verification email link.
// Verifies the token atomically, then redirects to login with status params.

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/login?error=invalid", appUrl)
      );
    }

    const result = await verifyToken(token);

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
