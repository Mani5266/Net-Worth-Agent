"use client";

import { useState, useCallback } from "react";
import { Section, Input, Select, Button, InfoBadge } from "@/components/ui";
import { SALUTATIONS } from "@/constants";
import { useFormContext } from "@/hooks/useFormContext";
import type { SalutationType } from "@/types";

type DocumentType = "passport" | "aadhaar";

const MAX_IMAGE_DIM = 1200;
const JPEG_QUALITY = 0.7;

/**
 * Compress an image file using canvas.
 * Uses createImageBitmap which auto-applies EXIF orientation.
 * PDFs are returned as-is (can't canvas-resize a PDF).
 */
async function compressImage(file: File): Promise<Blob> {
  // PDFs can't be drawn to canvas — return as-is
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Scale down if either dimension exceeds MAX_IMAGE_DIM
  if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
    const scale = MAX_IMAGE_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file; // fallback: return original
  }

  // White background (handles transparent PNGs converted to JPEG)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
  return blob;
}

export function StepApplicant() {
  const { data, updateField } = useFormContext();

  // Passport upload state
  const [passportExtracting, setPassportExtracting] = useState(false);
  const [passportStatus, setPassportStatus] = useState<"idle" | "success" | "error">("idle");
  const [passportError, setPassportError] = useState("");

  // Aadhaar upload state
  const [aadhaarExtracting, setAadhaarExtracting] = useState(false);
  const [aadhaarStatus, setAadhaarStatus] = useState<"idle" | "success" | "error">("idle");
  const [aadhaarError, setAadhaarError] = useState("");

  const handleDocumentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, docType: DocumentType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPassport = docType === "passport";
    const setExtracting = isPassport ? setPassportExtracting : setAadhaarExtracting;
    const setStatusFn = isPassport ? setPassportStatus : setAadhaarStatus;
    const setErrorFn = isPassport ? setPassportError : setAadhaarError;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setStatusFn("error");
      setErrorFn("File too large. Maximum 5MB.");
      return;
    }

    // Validate file type — support images and PDFs
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidType && !hasValidExtension) {
      setStatusFn("error");
      setErrorFn("Unsupported file type. Please upload a JPEG, PNG, WebP, or PDF file.");
      return;
    }

    setExtracting(true);
    setStatusFn("idle");
    setErrorFn("");

    try {
      // Compress image (PDFs pass through unchanged)
      const compressed = await compressImage(file);

      // Build FormData — field names must match backend exactly
      const formData = new FormData();
      formData.append("file", compressed, file.name);
      formData.append("documentType", docType);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — browser auto-sets multipart boundary
      });

      if (res.status === 429) {
        setStatusFn("error");
        setErrorFn("Too many requests. Please try again later.");
        return;
      }

      if (res.status === 413) {
        setStatusFn("error");
        setErrorFn("File too large. Please use a smaller file (under 5MB).");
        return;
      }

      if (res.status === 401) {
        setStatusFn("error");
        setErrorFn("Session expired. Please refresh the page and log in again.");
        return;
      }

      const json = await res.json();

      if (json.success) {
        if (docType === "passport") {
          if (json.fullName) updateField("fullName", json.fullName);
          if (json.passportNumber) updateField("passportNumber", json.passportNumber.toUpperCase());
        } else {
          // Aadhaar
          if (json.name) updateField("fullName", json.name);
        }
        setStatusFn("success");
      } else {
        setStatusFn("error");
        setErrorFn(json.error || `Could not extract details from the ${docType === "passport" ? "passport" : "Aadhaar card"}.`);
      }
    } catch (err) {
      setStatusFn("error");
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorFn(`Upload failed: ${msg}. Please check your connection and try again.`);
    } finally {
      setExtracting(false);
      // Reset the file input so the same file can be re-uploaded
      e.target.value = "";
    }
  }, [updateField]);

  return (
    <Section title="Applicant Details">
      <div className="flex flex-col gap-5">

        {/* Secure Document Extraction */}
        <div className="bg-navy-50/50 border border-navy-100 rounded-xl p-4">
          <p className="text-xs font-bold text-navy-800 uppercase tracking-widest mb-3 flex items-center gap-2">
            Secure Document Auto-Fill
          </p>

          {/* Upload buttons row */}
          <div className="flex flex-wrap items-start gap-4">
            {/* Passport Upload */}
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(e) => handleDocumentUpload(e, "passport")}
                  disabled={passportExtracting || aadhaarExtracting}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Button variant="outline" size="sm" disabled={passportExtracting || aadhaarExtracting}>
                  {passportExtracting ? "Extracting..." : "Upload Passport"}
                </Button>
              </div>
              {passportStatus === "success" && (
                <p className="text-[11px] text-navy-700 font-bold animate-pulse">
                  Passport details extracted!
                </p>
              )}
              {passportStatus === "error" && (
                <p className="text-[11px] text-red-600 font-bold max-w-[200px]">
                  {passportError || "Extraction failed."}
                </p>
              )}
            </div>

            {/* Aadhaar Upload */}
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(e) => handleDocumentUpload(e, "aadhaar")}
                  disabled={passportExtracting || aadhaarExtracting}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Button variant="outline" size="sm" disabled={passportExtracting || aadhaarExtracting}>
                  {aadhaarExtracting ? "Extracting..." : "Upload Aadhaar Card"}
                </Button>
              </div>
              {aadhaarStatus === "success" && (
                <p className="text-[11px] text-navy-700 font-bold animate-pulse">
                  Aadhaar details extracted!
                </p>
              )}
              {aadhaarStatus === "error" && (
                <p className="text-[11px] text-red-600 font-bold max-w-[200px]">
                  {aadhaarError || "Extraction failed."}
                </p>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-tight self-center">
              Extract name &amp; details automatically from<br/>
              Passport (PDF/Image) or Aadhaar Card (PDF/Image).<br/>
              <span className="text-navy-700 font-medium">Processed securely on our server</span>
            </p>
          </div>

          <InfoBadge>
            <strong>Privacy &amp; Security:</strong> Your document image is sent securely to our server for extraction via AI Vision and is <strong>never stored</strong>. No image data is logged.
          </InfoBadge>
        </div>

        <div className="grid grid-cols-[120px_1fr] gap-4">
          <Select
            label="Salutation"
            required
            value={data.salutation}
            onChange={(e) => updateField("salutation", e.target.value as SalutationType)}
            options={SALUTATIONS}
          />
          <Input
            label="Full Name"
            required
            placeholder="Full legal name (as per Passport / Aadhaar)"
            value={data.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
          />
        </div>

        <Input
          label="Passport Number"
          placeholder="J1234567"
          value={data.passportNumber}
          onChange={(e) => updateField("passportNumber", e.target.value.toUpperCase())}
          maxLength={8}
        />
      </div>
    </Section>
  );
}
