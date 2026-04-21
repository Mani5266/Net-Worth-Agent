// ─── Password Reset Logic ─────────────────────────────────────────────────
// Token creation, verification, and password update.
// Follows same pattern as email-verification.ts:
// - Raw tokens NEVER stored — only SHA-256 hashes
// - Single-use tokens with 15-minute expiry
// - PII-safe logging (no emails or tokens logged)

import crypto from "crypto";
import { createSupabaseAdminClient } from "./supabase-server";
import { sendEmail } from "./email";

// ─── Token Hashing ────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ResetResult =
  | { success: true; provider: string }
  | { success: false; error: string };

type VerifyResetResult =
  | { success: true }
  | { success: false; error: string };

// ─── Create & Send Password Reset ─────────────────────────────────────────────

/**
 * Creates a password reset token and sends a reset email.
 * 1. Looks up user by email via admin API
 * 2. Deletes any existing reset tokens for this user
 * 3. Generates a new token, hashes it, stores the hash
 * 4. Sends the reset email with the raw token in the link
 *
 * Returns success even if user doesn't exist (prevents email enumeration).
 */
export async function createAndSendPasswordReset(
  email: string
): Promise<ResetResult> {
  const admin = createSupabaseAdminClient();
  const t0 = Date.now();

  // Minimum response time to prevent timing-based user enumeration.
  // Whether the user exists or not, the function takes at least this long.
  const MIN_RESPONSE_MS = 800;

  async function ensureMinTime<T>(result: T): Promise<T> {
    const elapsed = Date.now() - t0;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
    }
    return result;
  }

  // 1. Look up user by email
  const normalizedEmail = email.toLowerCase().trim();

  // Try getUserById-style lookup — Supabase JS v2 doesn't have getUserByEmail,
  // so query the admin user list filtering manually across all pages.
  // Instead, use a more reliable approach: query via REST API filter.
  let user: { id: string; email?: string } | null = null;

  // Supabase admin SDK v2.99+ supports listing with filter params
  // Paginate through users to find the match
  let page = 1;
  const perPage = 50;
  while (!user) {
    const { data: listData, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (listError) {
      console.error("[PASSWORD_RESET] Failed to query users", {
        error: listError.message,
      });
      return ensureMinTime({ success: true as const, provider: "noop" });
    }

    const found = listData?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail
    );

    if (found) {
      user = found;
      break;
    }

    // No more pages
    if (!listData?.users?.length || listData.users.length < perPage) break;
    page++;
  }

  if (!user) {
    console.log("[PASSWORD_RESET] No user found for email (safe noop)");
    return ensureMinTime({ success: true as const, provider: "noop" });  }

  const userId = user.id;

  // 2. Delete existing reset tokens for this user
  const { error: deleteError } = await Promise.resolve(
    admin.from("password_resets").delete().eq("user_id", userId)
  );

  if (deleteError) {
    console.error("[PASSWORD_RESET] Failed to delete old tokens", {
      userId,
      error: deleteError.message,
    });
    // Non-fatal — continue
  }

  // 3. Generate raw token and hash it
  const rawToken = crypto.randomUUID();
  const tokenHash = hashToken(rawToken);

  // 4. Insert hashed token (expires in 15 minutes)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await Promise.resolve(
    admin.from("password_resets").insert({
      user_id: userId,
      email: normalizedEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
  );

  if (insertError) {
    console.error("[PASSWORD_RESET] Failed to insert token", {
      userId,
      error: insertError.message,
      code: insertError.code,
    });
    return { success: false, error: "Failed to create reset token" };
  }

  console.log("[PASSWORD_RESET] Token inserted", {
    userId,
    tokenHashPrefix: tokenHash.slice(0, 8),
    expiresAt,
  });

  // 5. Build reset link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

  // 6. Send email
  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: "Reset your password — OnEasy",
    html: buildResetEmail(resetLink),
  });

  if (!emailResult.success) {
    console.error("[PASSWORD_RESET] Email send failed", { userId });
    return { success: false, error: "Failed to send reset email" };
  }

  console.log("[PASSWORD_RESET] Reset email sent", {
    userId,
    provider: emailResult.provider,
  });

  return { success: true, provider: emailResult.provider };
}

// ─── Verify Token & Update Password ──────────────────────────────────────────

/**
 * Verifies a raw reset token and updates the user's password:
 * 1. Hashes the raw token
 * 2. Looks up the token row by hash
 * 3. Checks expiry
 * 4. Deletes the row (single-use)
 * 5. Updates the user's password via admin API
 */
export async function verifyResetAndUpdatePassword(
  rawToken: string,
  newPassword: string
): Promise<VerifyResetResult> {
  const admin = createSupabaseAdminClient();
  const tokenHash = hashToken(rawToken);

  console.log("[PASSWORD_RESET] Looking up token", {
    tokenHashPrefix: tokenHash.slice(0, 8),
  });

  // Atomic: DELETE the token by hash and return it in one query.
  // This prevents TOCTOU race conditions where two concurrent requests
  // could both consume the same token with different passwords.
  const { data: deletedRows, error: deleteError } = await Promise.resolve(
    admin
      .from("password_resets")
      .delete()
      .eq("token_hash", tokenHash)
      .select("id, user_id, expires_at")
  );

  const row = deletedRows?.[0];

  if (deleteError || !row) {
    console.error("[PASSWORD_RESET] Token not found or already consumed", {
      errorMessage: deleteError?.message ?? "none",
      tokenHashPrefix: tokenHash.slice(0, 8),
    });
    return { success: false, error: "Invalid or expired reset link." };
  }

  // Check expiry (token already deleted — if expired, just reject)
  if (new Date(row.expires_at) <= new Date()) {
    console.error("[PASSWORD_RESET] Token expired", {
      expiresAt: row.expires_at,
      tokenHashPrefix: tokenHash.slice(0, 8),
    });
    return { success: false, error: "Reset link has expired. Please request a new one." };
  }

  // Step 3: Update user's password
  const { error: updateError } = await admin.auth.admin.updateUserById(
    row.user_id,
    { password: newPassword }
  );

  if (updateError) {
    console.error("[PASSWORD_RESET] Failed to update password", {
      userId: row.user_id,
      error: updateError.message,
    });
    return { success: false, error: "Failed to update password. Please try again." };
  }

  console.log("[PASSWORD_RESET] Password updated successfully", {
    userId: row.user_id,
  });

  return { success: true };
}

// ─── Email Template ───────────────────────────────────────────────────────────

function buildResetEmail(resetLink: string): string {
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
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Reset your password</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">
                We received a request to reset your password. Click the button below to set a new password. This link expires in 15 minutes.
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display:inline-block;background-color:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              <p style="margin:12px 0 0;font-size:11px;line-height:1.6;color:#cbd5e1;word-break:break-all;">
                If the button doesn't work, copy and paste this link: ${resetLink}
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
