import { supabase } from "./supabase";
import { FormDataSchema } from "./schemas";
import { INITIAL_STATE } from "@/hooks/useFormData";
import { logAudit, snapshotVersion } from "./audit";
import type { FormData, CertificateRecord, DocumentRecord } from "@/types";

/**
 * Gets the current authenticated user's ID.
 * Throws if the user is not authenticated.
 */
async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user.id;
}

/**
 * Safely parses form_data from DB JSON with Zod validation.
 * Falls back to raw cast if validation fails (for backward compatibility with legacy data).
 */
function parseFormData(raw: unknown): FormData {
  const result = FormDataSchema.safeParse(raw);
  if (result.success) return result.data;
  // Fallback: merge with INITIAL_STATE defaults for legacy records missing new fields
  const merged = { ...INITIAL_STATE, ...(raw as Record<string, unknown>) };
  return merged as FormData;
}

/**
 * Saves a new certificate draft.
 * Upserts the client first, then creates the certificate record.
 */
export async function saveCertificateDraft(formData: FormData): Promise<string> {
  const userId = await requireUserId();

  // 1. Upsert Client (based on user + passport number, stored in pan_number column)
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .upsert({
      full_name: formData.fullName,
      salutation: formData.salutation,
      pan_number: formData.passportNumber.toUpperCase(),
      user_id: userId,
    }, { onConflict: 'user_id,pan_number' })
    .select()
    .single();

  if (clientError) throw clientError;

  // 2. Create Certificate
  const { data: cert, error: certError } = await supabase
    .from("certificates")
    .insert({
      client_id: client.id,
      purpose: formData.purpose,
      country: formData.country,
      cert_date: formData.certDate,
      udin: formData.udin,
      nickname: formData.nickname || formData.purpose,
      status: "draft",
      form_data: formData as unknown as Record<string, unknown>,
      user_id: userId,
    })
    .select()
    .single();

  if (certError) throw certError;

  // Phase 5: Audit log — record certificate creation
  logAudit(
    userId,
    "create",
    "certificate",
    cert.id,
    null,
    formData as unknown as Record<string, unknown>
  );

  return cert.id;
}

/**
 * Updates an existing certificate draft.
 */
export async function updateCertificateDraft(id: string, formData: FormData): Promise<void> {
  const userId = await requireUserId();

  // Phase 5: Fetch old form_data for audit log + version snapshot
  const { data: oldCert } = await supabase
    .from("certificates")
    .select("form_data")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (oldCert) {
    snapshotVersion(userId, id, oldCert.form_data as Record<string, unknown>);
  }

  const { error } = await supabase
    .from("certificates")
    .update({
      form_data: formData as unknown as Record<string, unknown>,
      nickname: formData.nickname,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;

  // Phase 5: Audit log — record certificate update
  logAudit(
    userId,
    "update",
    "certificate",
    id,
    oldCert?.form_data as Record<string, unknown> ?? null,
    formData as unknown as Record<string, unknown>
  );
}

/**
 * Fetches a certificate by ID.
 */
export async function getCertificate(id: string): Promise<FormData> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("certificates")
    .select("form_data")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return parseFormData(data.form_data);
}

/**
 * Fetches all certificates (history page).
 */
export async function getAllCertificates(): Promise<CertificateRecord[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("certificates")
    .select(`
      id,
      purpose,
      nickname,
      cert_date,
      status,
      created_at,
      clients (
        full_name
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    clientName: (item.clients as Record<string, unknown> | null)?.full_name as string || "Unknown",
    nickname: item.nickname as string | undefined,
    purpose: item.purpose as string,
    certDate: item.cert_date as string,
    status: item.status as "draft" | "completed",
    createdAt: item.created_at as string,
  }));
}

/**
 * Renames a certificate (updates both column and JSON).
 */
export async function renameCertificate(id: string, newName: string): Promise<void> {
  const userId = await requireUserId();
  const { data: cert, error: fetchError } = await supabase
    .from("certificates")
    .select("form_data")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError) throw fetchError;

  const oldFormData = cert.form_data as Record<string, unknown>;

  // Phase 5: Snapshot the current version before rename
  snapshotVersion(userId, id, oldFormData);

  const updatedFormData = {
    ...oldFormData,
    nickname: newName
  };

  const { error: updateError } = await supabase
    .from("certificates")
    .update({
      nickname: newName,
      form_data: updatedFormData,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) throw updateError;

  // Phase 5: Audit log — record certificate rename
  logAudit(userId, "rename", "certificate", id, oldFormData, updatedFormData);
}

/**
 * Uploads a document to Supabase Storage and records it in the DB.
 * Returns the storage path and DB row ID (for later deletion).
 */

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function uploadDocument(
  certificateId: string,
  annexureType: string,
  category: string,
  file: File
): Promise<{ path: string; documentId: string }> {
  const userId = await requireUserId();

  // Phase 3 FIX 5: Validate file before upload
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new Error("File too large (max 5 MB).");
  }
  if (!UPLOAD_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Invalid file type. Accepted: PDF, JPEG, PNG, WebP.");
  }

  // Sanitize filename — strip anything that isn't alphanumeric, dot, or hyphen
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  const filePath = `${userId}/${certificateId}/${annexureType}/${category}/${fileName}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from("networth-documents")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // 2. Save metadata to DB (return the row id for future deletion)
  const { data: row, error: dbError } = await supabase.from("documents").insert({
    certificate_id: certificateId,
    annexure_type: annexureType,
    category: category,
    file_url: filePath,
    file_name: file.name,
    file_type: file.type,
    user_id: userId,
  }).select("id").single();

  if (dbError) {
    // Rollback: best-effort cleanup of the orphaned storage file
    await supabase.storage.from("networth-documents").remove([filePath]).catch(() => {});
    throw dbError;
  }

  return { path: filePath, documentId: row.id };
}

/**
 * Deletes a document from storage and DB.
 * Looks up file_url from DB by (documentId + user_id) — never trusts caller-supplied paths.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const userId = await requireUserId();

  // 1. Look up the document row (scoped to this user)
  const { data: doc, error: lookupError } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (lookupError || !doc) {
    throw new Error("Document not found or access denied.");
  }

  // 2. Delete from DB first (reversible if storage fails — orphaned file is harmless)
  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (dbError) throw dbError;

  // 3. Delete from Storage using the DB-sourced path
  const { error: storageError } = await supabase.storage
    .from("networth-documents")
    .remove([doc.file_url]);

  if (storageError) {
    // Log but don't throw — DB row is already deleted, orphaned file is acceptable
    console.error("Failed to delete storage file (orphaned):", storageError);
  }
}

/**
 * Fetches all documents associated with a certificate.
 */
export async function getDocuments(certificateId: string): Promise<DocumentRecord[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("certificate_id", certificateId)
    .eq("user_id", userId);

  if (error) throw error;

  // PERF FIX 2: Batch signed URL generation — 1 API call instead of N.
  // Supabase JS v2 supports createSignedUrls (plural) for batch operations.
  const paths = data.map((doc) => doc.file_url);
  let signedUrlMap: Record<string, string> = {};

  if (paths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("networth-documents")
      .createSignedUrls(paths, 300);

    if (signedUrls) {
      for (const item of signedUrls) {
        if (item.signedUrl && item.path) {
          signedUrlMap[item.path] = item.signedUrl;
        }
      }
    }
  }

  return data.map((doc: Record<string, unknown>) => ({
    id: doc.id as string,
    certificateId: doc.certificate_id as string,
    annexureType: doc.annexure_type as string,
    category: doc.category as string,
    fileUrl: signedUrlMap[doc.file_url as string] || "",
    fileName: doc.file_name as string,
    fileType: doc.file_type as string,
    uploadedAt: doc.uploaded_at as string,
  }));
}

/**
 * Deletes a certificate and its associated documents from DB and Storage.
 */
export async function deleteCertificate(id: string): Promise<void> {
  const userId = await requireUserId();

  // 1. Collect storage paths AND form_data BEFORE deleting from DB
  const { data: docs } = await supabase
    .from("documents")
    .select("file_url")
    .eq("certificate_id", id)
    .eq("user_id", userId);

  // Phase 5: Fetch form_data for audit snapshot before deletion
  const { data: cert } = await supabase
    .from("certificates")
    .select("form_data")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  // 2. Delete from DB first — cascades to documents table.
  //    If this fails, nothing has been deleted — safe to re-try.
  const { error } = await supabase
    .from("certificates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;

  // Phase 5: Audit log — record certificate deletion (before-state only)
  logAudit(
    userId,
    "delete",
    "certificate",
    id,
    cert?.form_data as Record<string, unknown> ?? null,
    null
  );

  // 3. Best-effort storage cleanup — orphaned blobs are harmless.
  if (docs && docs.length > 0) {
    const paths = docs.map(d => d.file_url);
    const { error: storageErr } = await supabase.storage.from("networth-documents").remove(paths);
    if (storageErr) {
      console.error("Storage cleanup failed (orphaned files are harmless):", storageErr);
    }
  }
}
