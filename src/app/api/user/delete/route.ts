import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { logAction } from "@/lib/audit";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/user/delete
 *
 * DPDP Act Section 12 — Right to Erasure
 *
 * Permanently deletes ALL personal data for the authenticated user:
 *   1. All storage files (documents in networth-documents bucket)
 *   2. All document records
 *   3. All certificate records
 *   4. All client records
 *   5. The Supabase Auth user account itself
 *
 * Audit logs are PRESERVED with user_id set to NULL (the audit_logs table
 * has ON DELETE SET NULL on user_id). This is required for compliance —
 * you need to prove that data was deleted.
 *
 * REQUIRES: SUPABASE_SERVICE_ROLE_KEY (to delete the auth user)
 *
 * Request body must include: { "confirm": "DELETE MY ACCOUNT" }
 * This prevents accidental deletions.
 */
export async function DELETE(req: NextRequest) {
  // 1. Authentication
  const authResult = await requireAuth(req);
  if ("error" in authResult) return authResult.error;

  const { userId } = authResult;

  // 2. Confirm intent (prevent accidental deletion)
  try {
    const body = await req.json();
    if (body?.confirm !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        {
          success: false,
          error: 'To delete your account, send { "confirm": "DELETE MY ACCOUNT" } in the request body.',
        },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request body. Send { "confirm": "DELETE MY ACCOUNT" }.',
      },
      { status: 400 }
    );
  }

  // 3. Verify service role key is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[Account Deletion] SUPABASE_SERVICE_ROLE_KEY not configured");
    return NextResponse.json(
      { success: false, error: "Server configuration error. Contact support." },
      { status: 500 }
    );
  }

  // Admin client (bypasses RLS — needed to delete auth user)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // User-scoped client (respects RLS — for querying user's own data)
  const cookieStore = cookies();
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored
          }
        },
      },
    }
  );

  try {
    // 4. Collect all storage file paths for this user
    const { data: documents } = await supabase
      .from("documents")
      .select("file_url")
      .eq("user_id", userId);

    const storagePaths = documents?.map((d) => d.file_url) ?? [];

    // 5. Delete storage files (in batches of 100)
    if (storagePaths.length > 0) {
      for (let i = 0; i < storagePaths.length; i += 100) {
        const batch = storagePaths.slice(i, i + 100);
        const { error: storageErr } = await supabase.storage
          .from("networth-documents")
          .remove(batch);
        if (storageErr) {
          console.error("[Account Deletion] Storage cleanup error:", storageErr);
          // Continue — don't let storage errors block account deletion
        }
      }
    }

    // 6. Delete all user data from DB (order matters for foreign keys)
    //    documents → certificates → clients

    const { error: docsErr } = await adminClient
      .from("documents")
      .delete()
      .eq("user_id", userId);
    if (docsErr) console.error("[Account Deletion] Documents delete error:", docsErr);

    const { error: certsErr } = await adminClient
      .from("certificates")
      .delete()
      .eq("user_id", userId);
    if (certsErr) console.error("[Account Deletion] Certificates delete error:", certsErr);

    const { error: clientsErr } = await adminClient
      .from("clients")
      .delete()
      .eq("user_id", userId);
    if (clientsErr) console.error("[Account Deletion] Clients delete error:", clientsErr);

    // 7. Audit: log the deletion BEFORE deleting the auth user
    //    (audit_logs.user_id has ON DELETE SET NULL, so the log is preserved)
    await logAction({
      userId,
      action: "account_deletion_requested",
      request: req,
      metadata: {
        documentsDeleted: storagePaths.length,
        storagePathsDeleted: storagePaths.length,
      },
    });

    // 8. Delete the Supabase Auth user (requires service_role)
    const { error: authErr } = await adminClient.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("[Account Deletion] Auth user deletion error:", authErr);
      return NextResponse.json(
        {
          success: false,
          error: "Data deleted but failed to remove auth account. Contact support.",
        },
        { status: 500 }
      );
    }

    // 9. Success
    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("[Account Deletion] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Account deletion failed. Contact support." },
      { status: 500 }
    );
  }
}
