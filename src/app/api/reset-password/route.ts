import { NextRequest, NextResponse } from "next/server";
import { verifyResetAndUpdatePassword } from "@/lib/password-reset";
import {
  createLimiter,
  getClientIdentifier,
  rateLimitResponse,
  checkCsrfOrigin,
} from "@/lib/ratelimit";

const resetPasswordRateLimit = createLimiter("reset-password", {
  requests: 5,
  window: "1 h",
});

export async function POST(request: NextRequest) {
  try {
    // CSRF check
    const csrfBlock = checkCsrfOrigin(request);
    if (csrfBlock) return csrfBlock;

    // Rate limit by IP
    const ip = getClientIdentifier(request);
    const limit = await resetPasswordRateLimit.check(ip);
    if (!limit.success) return rateLimitResponse(limit.reset);

    const body = await request.json();
    const { token, password } = body ?? {};

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: "Reset token is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const result = await verifyResetAndUpdatePassword(token, password);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("[RESET_PASSWORD] Unexpected error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
