"use client";

import { useState, useCallback } from "react";
import Tesseract from "tesseract.js";
import { Section, Input, Select, Button, InfoBadge } from "@/components/ui";
import { SALUTATIONS } from "@/constants";
import type { FormData, SalutationType } from "@/types";

interface StepApplicantProps {
  data: FormData;
  onChange: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
}

export function StepApplicant({ data, onChange }: StepApplicantProps) {
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handlePanUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setStatus("idle");
    
    try {
      // Step 1: Client-side OCR
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      
      // Step 2: Server-side AI parsing
      const res = await fetch("/api/extract-pan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      
      if (json.success) {
        if (json.fullName) onChange("fullName", json.fullName);
        if (json.pan) onChange("pan", json.pan.toUpperCase());
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      setStatus("error");
    } finally {
      setExtracting(false);
    }
  }, [onChange]);

  return (
    <Section title="👤 Applicant Details">
      <div className="flex flex-col gap-5">
        
        {/* Secure PAN Extraction */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-3 flex items-center gap-2">
            🛡️ Secure PAN Auto-Fill
          </p>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handlePanUpload}
                disabled={extracting}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button variant="outline" size="sm" disabled={extracting}>
                {extracting ? "⚡ Extracting..." : "📷 Upload PAN Card"}
              </Button>
            </div>
            <p className="text-[11px] text-gray-500 leading-tight">
              Extract name &amp; PAN automatically.<br/>
              <span className="text-emerald-700 font-medium">✨ Fast &amp; Secure</span>
            </p>
          </div>
          {status === "success" && (
            <p className="mt-2 text-[11px] text-emerald-700 font-bold animate-pulse">
              ✅ Details extracted and auto-filled!
            </p>
          )}
          {status === "error" && (
            <p className="mt-2 text-[11px] text-red-600 font-bold">
              ❌ Extraction failed. Please fill details manually.
            </p>
          )}
          <InfoBadge>
            <strong>Privacy &amp; Security:</strong> Your PAN card is processed securely in-memory and is <strong>not stored</strong> on our servers.
          </InfoBadge>
        </div>

        <div className="grid grid-cols-[120px_1fr] gap-4">
          <Select
            label="Salutation"
            required
            value={data.salutation}
            onChange={(e) => onChange("salutation", e.target.value as SalutationType)}
            options={SALUTATIONS}
          />
          <Input
            label="Full Name"
            required
            placeholder="Full legal name (as per PAN Card)"
            value={data.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
          />
        </div>

        <Input
          label="PAN Number"
          placeholder="ABCDE1234F"
          value={data.pan}
          onChange={(e) => onChange("pan", e.target.value.toUpperCase())}
          maxLength={10}
        />

        <Input
          label="UDIN"
          hint="Can be added after CA signing"
          placeholder="UDIN number"
          value={data.udin}
          onChange={(e) => onChange("udin", e.target.value)}
        />
      </div>
    </Section>
  );
}
