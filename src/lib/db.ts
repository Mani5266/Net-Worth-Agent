import { supabase } from "./supabase";
import { FormDataSchema } from "./schemas";
import { INITIAL_STATE } from "@/hooks/useFormData";
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

  return cert.id;
}

/**
 * Updates an existing certificate draft.
 */
export async function updateCertificateDraft(id: string, formData: FormData): Promise<void> {
  const { error } = await supabase
    .from("certificates")
    .update({
      form_data: formData as unknown as Record<string, unknown>,
      nickname: formData.nickname,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Fetches a certificate by ID.
 */
export async function getCertificate(id: string): Promise<FormData> {
  const { data, error } = await supabase
    .from("certificates")
    .select("form_data")
    .eq("id", id)
    .single();

  if (error) throw error;
  return parseFormData(data.form_data);
}

/**
 * Fetches all certificates (history page).
 */
export async function getAllCertificates(): Promise<CertificateRecord[]> {
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
  const { data: cert, error: fetchError } = await supabase
    .from("certificates")
    .select("form_data")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  const updatedFormData = {
    ...(cert.form_data as Record<string, unknown>),
    nickname: newName
  };

  const { error: updateError } = await supabase
    .from("certificates")
    .update({
      nickname: newName,
      form_data: updatedFormData,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (updateError) throw updateError;
}

/**
 * Uploads a document to Supabase Storage and records it in the DB.
 * Returns the storage path and DB row ID (for later deletion).
 */
export async function uploadDocument(
  certificateId: string,
  annexureType: string,
  category: string,
  file: File
): Promise<{ path: string; documentId: string }> {
  const userId = await requireUserId();
  const fileName = `${Date.now()}-${file.name}`;
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
 */
export async function deleteDocument(documentId: string, filePath: string): Promise<void> {
  // 1. Delete from Storage
  const { error: storageError } = await supabase.storage
    .from("networth-documents")
    .remove([filePath]);

  if (storageError) throw storageError;

  // 2. Delete from DB
  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (dbError) throw dbError;
}

/**
 * Fetches all documents associated with a certificate.
 */
export async function getDocuments(certificateId: string): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("certificate_id", certificateId);

  if (error) throw error;

  // Generate signed URLs for each
  // NOTE: Signed URLs bypass storage RLS once generated. 60s expiry is ideal
  // for security but may cause UX issues if users review documents slowly.
  // Current: 300s (5 min). Future hardening: reduce to 60s.
  const docsWithUrls = await Promise.all(
    data.map(async (doc) => {
      const { data: signedUrlData } = await supabase.storage
        .from("networth-documents")
        .createSignedUrl(doc.file_url, 300);
      
      return {
        ...doc,
        fileUrl: signedUrlData?.signedUrl || "",
      };
    })
  );

  return docsWithUrls.map((doc: Record<string, unknown>) => ({
    id: doc.id as string,
    certificateId: doc.certificate_id as string,
    annexureType: doc.annexure_type as string,
    category: doc.category as string,
    fileUrl: doc.fileUrl as string,
    fileName: doc.file_name as string,
    fileType: doc.file_type as string,
    uploadedAt: doc.uploaded_at as string,
  }));
}

/**
 * Deletes a certificate and its associated documents from DB and Storage.
 */
export async function deleteCertificate(id: string): Promise<void> {
  // 1. Get documents to delete from storage
  const { data: docs } = await supabase
    .from("documents")
    .select("file_url")
    .eq("certificate_id", id);
    
  if (docs && docs.length > 0) {
    const paths = docs.map(d => d.file_url);
    const { error: storageErr } = await supabase.storage.from("networth-documents").remove(paths);
    if (storageErr) {
      console.error("Failed to delete storage files:", storageErr);
    }
  }

  // 2. Delete from certificates (DB will handle cascading to documents table)
  const { error } = await supabase
    .from("certificates")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
