import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { createLimiter, getClientIdentifier, rateLimitResponse } from "@/lib/ratelimit";
import crypto from "crypto";

// Rate limit: 10 verify attempts per hour per phone (brute-force protection)
const verifyOtpRateLimit = createLimiter("verify-otp", { requests: 10, window: "1 h" });

export async function POST(request: Request) {
  // No CSRF check — public endpoint, rate limiting is sufficient

  let phone: string;
  let otp: string;
  try {
    ({ phone, otp } = await request.json());
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  // Validate inputs
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json(
      { success: false, error: "Invalid phone number." },
      { status: 400 }
    );
  }
  if (!otp || !/^\d{6}$/.test(otp)) {
    return NextResponse.json(
      { success: false, error: "Enter a valid 6-digit OTP." },
      { status: 400 }
    );
  }

  // Rate limit
  const ipId = getClientIdentifier(request);
  const result = await verifyOtpRateLimit.check(`${ipId}:${phone}`);
  if (!result.success) return rateLimitResponse(result.reset);

  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    return NextResponse.json(
      { success: false, error: "OTP service not configured." },
      { status: 500 }
    );
  }

  // Verify OTP with MSG91
  try {
    const res = await fetch(
      `https://control.msg91.com/api/v5/otp/verify?mobile=91${phone}&otp=${otp}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
      }
    );

    const data = await res.json();

    if (data.type !== "success") {
      console.error(`[verify-otp] MSG91 verify failed: ${JSON.stringify(data)}`);
      return NextResponse.json(
        { success: false, error: "Invalid or expired OTP. Please try again." },
        { status: 401 }
      );
    }
  } catch (err) {
    console.error("[verify-otp] MSG91 fetch error:", err);
    return NextResponse.json(
      { success: false, error: "OTP service unavailable." },
      { status: 502 }
    );
  }

  // OTP verified — find or create Supabase user
  const admin = createSupabaseAdminClient();
  const phoneEmail = `${phone}@phone.networth.local`;

  // Deterministic password from phone (user never types this — only used internally)
  // Uses a dedicated secret — NOT the service role key — to limit blast radius if either leaks
  const phoneAuthSecret = process.env.PHONE_AUTH_SECRET;
  if (!phoneAuthSecret) {
    console.error("[verify-otp] PHONE_AUTH_SECRET not configured");
    return NextResponse.json(
      { success: false, error: "Auth service misconfigured." },
      { status: 500 }
    );
  }
  const phonePassword = crypto
    .createHmac("sha256", phoneAuthSecret)
    .update(`phone-auth:${phone}`)
    .digest("hex");

  try {
    // Check if user exists by listing users and matching email
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
    let user = listData?.users?.find(
      (u: { email?: string }) => u.email === phoneEmail
    );

    if (!user) {
      // Create new user — auto-confirmed, phone-verified
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email: phoneEmail,
        password: phonePassword,
        email_confirm: true,
        app_metadata: {
          custom_email_verified: true,
          auth_method: "phone",
          phone: phone,
        },
        user_metadata: {
          phone: phone,
          auth_method: "phone",
        },
      });

      if (createError) {
        console.error("[verify-otp] Failed to create user:", createError.message);
        return NextResponse.json(
          { success: false, error: "Failed to create account. Please try again." },
          { status: 500 }
        );
      }
      user = createData.user;
      console.log(`[verify-otp] Created phone user: ${user.id}`);
    } else {
      // Ensure existing user has custom_email_verified
      if (!user.app_metadata?.custom_email_verified) {
        await admin.auth.admin.updateUser(user.id, {
          app_metadata: {
            ...user.app_metadata,
            custom_email_verified: true,
          },
        });
      }
    }

    // Sign in server-side and set session cookies directly — no password sent to client
    const serverClient = createSupabaseServerClient();
    const { error: signInError } = await serverClient.auth.signInWithPassword({
      email: phoneEmail,
      password: phonePassword,
    });

    if (signInError) {
      console.error("[verify-otp] Server sign-in failed:", signInError.message);
      return NextResponse.json(
        { success: false, error: "Login failed after verification. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[verify-otp] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
