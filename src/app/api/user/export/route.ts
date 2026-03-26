import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { logAction } from "@/lib/audit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/export
 *
 * DPDP Act Section 11 — Right to Access Personal Data
 *
 * Returns ALL personal data associated with the authenticated user as a
 * JSON download. This includes:
 *   - Client records (name, passport number)
 *   - Certificate records (form data, status, dates)
 *   - Document metadata (file names, types — not the actual files)
 *   - Audit logs (actions performed by/on this user)
 *
 * The response is a downloadable JSON file with Content-Disposition header.
 */
export async function GET(req: NextRequest) {
  // 1. Authentication
  const authResult = await requireAuth(req);
  if ("error" in authResult) return authResult.error;

  const { userId } = authResult;

  // 2. Create server-side Supabase client (not the browser singleton)
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
            // Ignored in read-only context
          }
        },
      },
    }
  );

  try {
    // 3. Fetch all user data in parallel
    const [clientsRes, certificatesRes, documentsRes, auditRes] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("user_id", userId),
      supabase
        .from("certificates")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("id, certificate_id, annexure_type, category, file_name, file_type, uploaded_at")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("audit_logs")
        .select("action, document_type, document_id, created_at, metadata")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      userId,
      clients: clientsRes.data ?? [],
      certificates: certificatesRes.data ?? [],
      documents: documentsRes.data ?? [],
      auditLogs: auditRes.data ?? [],
    };

    // 4. Audit: log the export request
    logAction({
      userId,
      action: "data_export_requested",
      request: req,
      metadata: {
        clientCount: exportData.clients.length,
        certificateCount: exportData.certificates.length,
        documentCount: exportData.documents.length,
        auditLogCount: exportData.auditLogs.length,
      },
    });

    // 5. Return as downloadable JSON
    const filename = `networth-data-export-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[Data Export] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export data. Please try again." },
      { status: 500 }
    );
  }
}
