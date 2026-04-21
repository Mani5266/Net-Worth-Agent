import { NextResponse } from "next/server";
import { createLimiter, getClientIdentifier, rateLimitResponse } from "@/lib/ratelimit";

// Rate limit: 5 OTP sends per hour per phone, 10 per IP
const otpPhoneRateLimit = createLimiter("otp-phone", { requests: 5, window: "1 h" });
const otpIpRateLimit = createLimiter("otp-ip", { requests: 10, window: "1 h" });

export async function POST(request: Request) {
  // No CSRF check — public endpoint (like forgot-password), rate limiting is sufficient

  const { phone } = await request.json();

  // Validate Indian mobile: 10 digits starting with 6-9
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json(
      { success: false, error: "Enter a valid 10-digit Indian mobile number." },
      { status: 400 }
    );
  }

  // Rate limit by phone
  const phoneResult = await otpPhoneRateLimit.check(`phone:${phone}`);
  if (!phoneResult.success) return rateLimitResponse(phoneResult.reset);

  // Rate limit by IP
  const ipId = getClientIdentifier(request);
  const ipResult = await otpIpRateLimit.check(ipId);
  if (!ipResult.success) return rateLimitResponse(ipResult.reset);

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    console.error("[send-otp] MSG91_AUTH_KEY or MSG91_TEMPLATE_ID not configured");
    return NextResponse.json(
      { success: false, error: "OTP service not configured." },
      { status: 500 }
    );
  }

  // Send OTP via MSG91
  try {
    const res = await fetch(
      "https://control.msg91.com/api/v5/otp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify({
          template_id: templateId,
          mobile: `91${phone}`,
          otp_length: 6,
        }),
      }
    );

    const data = await res.json();
    console.log(`[send-otp] MSG91 raw (status ${res.status}):`, JSON.stringify(data));

    // Debug: also return MSG91 response to client temporarily
    if (data.type === "success" || data.type === "otp_sent" || data.message === "OTP sent successfully") {
      console.log(`[send-otp] OTP sent to 91${phone.slice(0, 2)}****${phone.slice(-2)}`);
      return NextResponse.json({ success: true, _debug: { msg91Status: res.status, msg91Response: data } });
    }

    console.error(`[send-otp] MSG91 error: ${JSON.stringify(data)}`);
    return NextResponse.json(
      { success: false, error: `OTP failed: ${data.message || JSON.stringify(data)}`, _debug: { msg91Status: res.status, msg91Response: data } },
      { status: 502 }
    );
  } catch (err) {
    console.error("[send-otp] MSG91 fetch error:", err);
    return NextResponse.json(
      { success: false, error: "OTP service unavailable. Please try again." },
      { status: 502 }
    );
  }
}
