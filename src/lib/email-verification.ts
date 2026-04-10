// ─── Email Verification Logic ─────────────────────────────────────────────
// Token creation, hashing, and verification.
// ONLY file that uses createSupabaseAdminClient.
// Raw tokens are NEVER stored — only SHA-256 hashes.

import crypto from "crypto";
import { createSupabaseAdminClient } from "./supabase-server";
import { sendEmail } from "./email";

// ─── Token Hashing ────────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationResult =
  | { success: true; provider: string }
  | { success: false; error: string };

type TokenVerifyResult =
  | { success: true }
  | { success: false; error: string };

// ─── Create & Send Verification ───────────────────────────────────────────────

/**
 * Creates a verification token and sends a verification email.
 * 1. Fetches user email from DB (NEVER trusts caller)
 * 2. Deletes any existing tokens for this user
 * 3. Generates a new token, hashes it, stores the hash
 * 4. Sends the verification email with the raw token in the link
 */
export async function createAndSendVerification(
  userId: string
): Promise<VerificationResult> {
  const admin = createSupabaseAdminClient();

  // 1. Get user email from DB — never trust the caller
  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(userId);

  if (userError || !userData?.user?.email) {
    console.error("[EMAIL_VERIFY] Failed to fetch user", {
      userId,
      hasError: Boolean(userError),
    });
    return { success: false, error: "User not found" };
  }

  const email = userData.user.email;

  // 2. Delete existing tokens for this user (cleanup before re-issue)
  const { error: deleteError } = await Promise.resolve(
    admin
      .from("email_verifications")
      .delete()
      .eq("user_id", userId)
  );

  if (deleteError) {
    console.error("[EMAIL_VERIFY] Failed to delete old tokens", {
      userId,
      error: deleteError.message,
    });
    // Non-fatal — continue with insert (unique constraint on token_hash protects us)
  }

  // 3. Generate raw token and hash it
  const rawToken = crypto.randomUUID();
  const tokenHash = hashToken(rawToken);

  // 4. Insert hashed token (expires in 15 minutes)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await Promise.resolve(
    admin.from("email_verifications").insert({
      user_id: userId,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
  );

  if (insertError) {
    console.error("[EMAIL_VERIFY] Failed to insert token", {
      userId,
      error: insertError.message,
      code: insertError.code,
    });
    return { success: false, error: "Failed to create verification token" };
  }

  console.log("[EMAIL_VERIFY] Token inserted", {
    userId,
    tokenHashPrefix: tokenHash.slice(0, 8),
    expiresAt: expiresAt,
  });

  // 5. Build verification link with raw token
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyLink = `${appUrl}/api/verify-email?token=${rawToken}`;

  // 6. Send email
  const emailResult = await sendEmail({
    to: email,
    subject: "Verify your email — OnEasy",
    html: buildVerificationEmail(verifyLink),
  });

  if (!emailResult.success) {
    console.error("[EMAIL_VERIFY] Email send failed", { userId });
    return { success: false, error: "Failed to send verification email" };
  }

  console.log("[EMAIL_VERIFY] Verification email sent", {
    userId,
    provider: emailResult.provider,
  });

  return { success: true, provider: emailResult.provider };
}

// ─── Verify Token ─────────────────────────────────────────────────────────────

/**
 * Verifies a raw token:
 * 1. Hashes the raw token
 * 2. Atomic DELETE ... WHERE token_hash = hash AND expires_at > now() ... RETURNING
 * 3. If row returned → marks user email as confirmed
 * 4. Token is single-use (deleted on verification)
 */
export async function verifyToken(rawToken: string): Promise<TokenVerifyResult> {
  const admin = createSupabaseAdminClient();
  const tokenHash = hashToken(rawToken);

  // Atomic: delete the token row if it exists and hasn't expired, return it
  const { data, error } = await Promise.resolve(
    admin
      .from("email_verifications")
      .delete()
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .select("user_id")
      .single()
  );

  if (error || !data) {
    console.error("[EMAIL_VERIFY] Token verification failed", {
      reason: error ? "db-error" : "no-matching-row",
      errorMessage: error?.message ?? "none",
      errorCode: error?.code ?? "none",
      tokenHashPrefix: tokenHash.slice(0, 8),
    });
    return { success: false, error: "invalid-or-expired" };
  }

  // Mark user email as confirmed in Supabase Auth
  const { error: updateError } = await admin.auth.admin.updateUserById(
    data.user_id,
    { email_confirm: true }
  );

  if (updateError) {
    console.error("[EMAIL_VERIFY] Failed to confirm user email", {
      userId: data.user_id,
      error: updateError.message,
    });
    return { success: false, error: "Failed to confirm email" };
  }

  console.log("[EMAIL_VERIFY] Email verified successfully", {
    userId: data.user_id,
  });

  return { success: true };
}

// ─── Email Template ───────────────────────────────────────────────────────────

function buildVerificationEmail(verifyLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:24px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:32px;height:32px;background-color:#f0b929;border-radius:8px;text-align:center;vertical-align:middle;font-weight:900;color:#0f172a;font-size:14px;">O</td>
                  <td style="padding-left:12px;color:#ffffff;font-size:16px;font-weight:800;letter-spacing:-0.02em;">OnEasy</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Verify your email address</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">
                Click the button below to verify your email and activate your account. This link expires in 15 minutes.
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${verifyLink}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
                If you didn't create an account on OnEasy, you can safely ignore this email.
              </p>
              <p style="margin:12px 0 0;font-size:11px;line-height:1.6;color:#cbd5e1;word-break:break-all;">
                If the button doesn't work, copy and paste this link: ${verifyLink}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:center;">
                &copy; 2026 OnEasy. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
