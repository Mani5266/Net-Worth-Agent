import { supabase } from "./supabase";
import type { FormData, CertificateRecord, DocumentRecord } from "@/types";

/**
 * Saves a new certificate draft.
 * Upserts the client first, then creates the certificate record.
 */
export async function saveCertificateDraft(formData: FormData): Promise<string> {
  // 1. Upsert Client
  // 1. Upsert Client (based on PAN)
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .upsert({
      full_name: formData.fullName,
      salutation: formData.salutation,
      pan_number: formData.pan.toUpperCase(),
      user_id: (await supabase.auth.getUser()).data.user?.id, // Get from session if not passed
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
      status: "draft",
      form_data: formData as any,
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
      form_data: formData as any,
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
  return data.form_data as unknown as FormData;
}

/**
 * Fetches all certificates for the history page.
 */
export async function getAllCertificates(): Promise<CertificateRecord[]> {
  const { data, error } = await supabase
    .from("certificates")
    .select(`
      id,
      purpose,
      cert_date,
      status,
      created_at,
      clients (
        full_name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((item: any) => ({
    id: item.id,
    clientName: item.clients?.full_name || "Unknown",
    purpose: item.purpose,
    certDate: item.cert_date,
    status: item.status,
    createdAt: item.created_at,
  }));
}

/**
 * Uploads a document to Supabase Storage and records it in the DB.
 */
export async function uploadDocument(
  certificateId: string,
  annexureType: string,
  category: string,
  file: File
): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${certificateId}/${annexureType}/${category}/${fileName}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from("networth-documents")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // 2. Get Signed URL (1 hour)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("networth-documents")
    .createSignedUrl(filePath, 3600);

  if (signedError) throw signedError;

  // 3. Save to DB
  const { error: dbError } = await supabase.from("documents").insert({
    certificate_id: certificateId,
    user_id: (await supabase.auth.getUser()).data.user?.id,
    annexure_type: annexureType,
    category: category,
    file_url: filePath,
    file_name: file.name,
    file_type: file.type,
  });

  if (dbError) throw dbError;

  return signedData.signedUrl;
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
  const docsWithUrls = await Promise.all(
    data.map(async (doc) => {
      const { data: signedUrlData } = await supabase.storage
        .from("networth-documents")
        .createSignedUrl(doc.file_url, 3600);
      
      return {
        ...doc,
        fileUrl: signedUrlData?.signedUrl || "",
      };
    })
  );

  return docsWithUrls.map((doc: any) => ({
    id: doc.id,
    certificateId: doc.certificate_id,
    annexureType: doc.annexure_type,
    category: doc.category,
    fileUrl: doc.fileUrl,
    fileName: doc.file_name,
    fileType: doc.file_type,
    uploadedAt: doc.uploaded_at,
  }));
}
