"use client";

import { useState, useCallback } from "react";
import { Section, Input, Select, Button, InfoBadge } from "@/components/ui";
import { SALUTATIONS } from "@/constants";
import { useFormContext } from "@/hooks/useFormContext";
import type { SalutationType } from "@/types";

export function StepApplicant() {
  const { data, updateField } = useFormContext();
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handlePassportUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setStatus("error");
      setErrorMessage("File too large. Maximum 5MB.");
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setStatus("error");
      setErrorMessage("Unsupported file type. Please upload a JPEG, PNG, or PDF.");
      return;
    }

    setExtracting(true);
    setStatus("idle");
    setErrorMessage("");

    try {
      const base64 = await fileToBase64(file);

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          documentType: "passport",
        }),
      });

      if (res.status === 429) {
        setStatus("error");
        setErrorMessage("Too many requests. Please try again later.");
        return;
      }

      if (res.status === 413) {
        setStatus("error");
        setErrorMessage("Image too large. Please use a smaller file.");
        return;
      }

      const json = await res.json();

      if (json.success) {
        if (json.fullName) updateField("fullName", json.fullName);
        if (json.passportNumber) updateField("passportNumber", json.passportNumber.toUpperCase());
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(json.error || "Could not extract details from the image.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please check your connection and try again.");
    } finally {
      setExtracting(false);
    }
  }, [updateField]);

  return (
    <Section title="Applicant Details">
      <div className="flex flex-col gap-5">

        {/* Secure Passport Extraction */}
        <div className="bg-navy-50/50 border border-navy-100 rounded-xl p-4">
          <p className="text-xs font-bold text-navy-800 uppercase tracking-widest mb-3 flex items-center gap-2">
            Secure Passport Auto-Fill
          </p>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handlePassportUpload}
                disabled={extracting}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button variant="outline" size="sm" disabled={extracting}>
                {extracting ? "Extracting..." : "Upload Passport"}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Extract name &amp; passport number automatically.<br/>
              <span className="text-navy-700 font-medium">Processed securely on our server</span>
            </p>
          </div>
          {status === "success" && (
            <p className="mt-2 text-[11px] text-navy-700 font-bold animate-pulse">
              Details extracted and auto-filled!
            </p>
          )}
          {status === "error" && (
            <p className="mt-2 text-[11px] text-red-600 font-bold">
              {errorMessage || "Extraction failed. Please fill details manually."}
            </p>
          )}
          <InfoBadge>
            <strong>Privacy &amp; Security:</strong> Your passport image is sent securely to our server for extraction via AI Vision and is <strong>never stored</strong>. No image data is logged.
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
            placeholder="Full legal name (as per Passport)"
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as base64"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
