import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

// ─── POST /api/check-verification ─────────────────────────────────────────────
// Server-side check of email_confirmed_at using admin client.
// Returns { verified: boolean } — never exposes user details.

export async function POST(req: NextRequest) {
  try {
    let body: { userId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { verified: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { userId } = body;
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json(
        { verified: false, error: "User ID is required." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);

    if (error || !data?.user) {
      return NextResponse.json({ verified: false });
    }

    return NextResponse.json({
      verified: Boolean(data.user.email_confirmed_at),
    });
  } catch (err) {
    console.error("[CHECK_VERIFICATION] Unexpected error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ verified: false }, { status: 500 });
  }
}
