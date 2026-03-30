import { supabase } from "./supabase";
import { FormDataSchema } from "./schemas";
import { logAction } from "./audit";
import { INITIAL_STATE } from "@/hooks/useFormData";
import type { FormData, CertificateRecord, DocumentRecord } from "@/types";

/**
 * Gets the authenticated user ID or throws an error.
 */
async function getRequiredUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Authentication required. Please sign in again.");
  }
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
  const userId = await getRequiredUserId();

  // 1. Upsert Client (based on Passport Number, stored in pan_number column)
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .upsert({
      full_name: formData.fullName,
      salutation: formData.salutation,
      pan_number: formData.passportNumber.toUpperCase(),
      user_id: userId,
    }, { onConflict: 'pan_number' })
    .select()
    .single();

  if (clientError) throw clientError;

  // 2. Create Certificate
  const { data: cert, error: certError } = await supabase
    .from("certificates")
    .insert({
      client_id: client.id,
      user_id: client.user_id, // Match client's user
      purpose: formData.purpose,
      country: formData.country,
      cert_date: formData.certDate,
      udin: formData.udin,
      nickname: formData.nickname || formData.purpose,
      status: "draft",
      form_data: formData as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (certError) throw certError;

  // Audit: certificate created
  logAction({
    userId,
    action: "certificate_created",
    documentType: "certificate",
    documentId: cert.id,
    metadata: { purpose: formData.purpose, country: formData.country },
  });

  return cert.id;
}

/**
 * Updates an existing certificate draft.
 * Scoped by user_id as defense-in-depth (in addition to RLS).
 */
export async function updateCertificateDraft(id: string, formData: FormData): Promise<void> {
  const userId = await getRequiredUserId();
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

  // Audit: certificate updated
  logAction({
    userId,
    action: "certificate_updated",
    documentType: "certificate",
    documentId: id,
  });
}

/**
 * Fetches a certificate by ID.
 * Scoped by user_id as defense-in-depth (in addition to RLS).
 */
export async function getCertificate(id: string): Promise<FormData> {
  const userId = await getRequiredUserId();
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
 * Fetches all certificates for the current user (history page).
 * Explicitly scoped by user_id as defense-in-depth (in addition to RLS).
 */
export async function getAllCertificates(): Promise<CertificateRecord[]> {
  const userId = await getRequiredUserId();
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
 * Scoped by user_id as defense-in-depth (in addition to RLS).
 */
export async function renameCertificate(id: string, newName: string): Promise<void> {
  const userId = await getRequiredUserId();

  // We need to update both the top-level column and the JSON inside form_data
  const { data: cert, error: fetchError } = await supabase
    .from("certificates")
    .select("form_data")
    .eq("id", id)
    .eq("user_id", userId)
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
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) throw updateError;

  // Audit: certificate renamed
  logAction({
    userId,
    action: "certificate_renamed",
    documentType: "certificate",
    documentId: id,
    metadata: { newName },
  });
}

/**
 * Uploads a document to Supabase Storage and records it in the DB.
 * File path is prefixed with userId/ to enforce storage RLS ownership.
 */
export async function uploadDocument(
  certificateId: string,
  annexureType: string,
  category: string,
  file: File
): Promise<string> {
  const userId = await getRequiredUserId();
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${userId}/${certificateId}/${annexureType}/${category}/${fileName}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from("networth-documents")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // 2. Get Signed URL (5 minutes — short-lived for security)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("networth-documents")
    .createSignedUrl(filePath, 300);

  if (signedError) throw signedError;

  // 3. Save to DB
  const { error: dbError } = await supabase.from("documents").insert({
    certificate_id: certificateId,
    user_id: userId,
    annexure_type: annexureType,
    category: category,
    file_url: filePath,
    file_name: file.name,
    file_type: file.type,
  });

  if (dbError) throw dbError;

  // Audit: document uploaded
  logAction({
    userId,
    action: "document_uploaded",
    documentType: annexureType,
    documentId: certificateId,
    metadata: { category, fileName: file.name, fileType: file.type },
  });

  return signedData.signedUrl;
}

/**
 * Deletes a document from storage and DB.
 * Scoped by user_id as defense-in-depth (in addition to RLS).
 */
export async function deleteDocument(documentId: string, filePath: string): Promise<void> {
  const userId = await getRequiredUserId();

  // 1. Delete from Storage
  const { error: storageError } = await supabase.storage
    .from("networth-documents")
    .remove([filePath]);

  if (storageError) throw storageError;

  // 2. Delete from DB — scoped to current user
  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (dbError) throw dbError;

  // Audit: document deleted
  logAction({
    userId,
    action: "document_deleted",
    documentType: "document",
    documentId: documentId,
    metadata: { filePath },
  });
}

/**
 * Fetches all documents associated with a certificate.
 * Scoped by user_id as defense-in-depth (in addition to RLS).
 */
export async function getDocuments(certificateId: string): Promise<DocumentRecord[]> {
  const userId = await getRequiredUserId();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("certificate_id", certificateId)
    .eq("user_id", userId);

  if (error) throw error;

  // Generate signed URLs for each (5 minutes — short-lived for security)
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
 * Scoped by user_id as defense-in-depth (in addition to RLS).
 */
export async function deleteCertificate(id: string): Promise<void> {
  const userId = await getRequiredUserId();

  // 1. Get documents to delete from storage (scoped to current user)
  const { data: docs } = await supabase
    .from("documents")
    .select("file_url")
    .eq("certificate_id", id)
    .eq("user_id", userId);
    
  if (docs && docs.length > 0) {
    const paths = docs.map(d => d.file_url);
    const { error: storageErr } = await supabase.storage.from("networth-documents").remove(paths);
    if (storageErr) {
      // Log but don't throw - we still want to delete the DB record
      console.error("Failed to delete storage files:", storageErr);
    }
  }

  // 2. Delete from certificates (DB will handle cascading to documents table)
  const { error } = await supabase
    .from("certificates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;

  // Audit: certificate deleted (includes doc count for forensics)
  logAction({
    userId,
    action: "certificate_deleted",
    documentType: "certificate",
    documentId: id,
    metadata: { documentsRemoved: docs?.length ?? 0 },
  });
}
