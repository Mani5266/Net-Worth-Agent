"use client";

import { Section, Select, Input, InfoBadge } from "@/components/ui";
import { PURPOSE_OPTIONS, COUNTRIES } from "@/constants";
import { isForeignPurpose } from "@/lib/utils";
import type { FormData, PurposeValue } from "@/types";

interface StepPurposeProps {
  data: FormData;
  onChange: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
}

export function StepPurpose({ data, onChange }: StepPurposeProps) {
  const isF = isForeignPurpose(data.purpose);

  return (
    <Section title="🎯 Purpose of Net Worth Certificate">
      <div className="flex flex-col gap-4">
        <Select
          label="Select Purpose"
          required
          value={data.purpose}
          onChange={(e) => onChange("purpose", e.target.value as PurposeValue)}
          options={PURPOSE_OPTIONS}
          placeholder="Choose purpose…"
        />

        {isF && (
          <>
            <Select
              label="Destination Country"
              required
              value={data.country}
              onChange={(e) => onChange("country", e.target.value)}
              options={COUNTRIES}
              placeholder="Select country…"
            />
            <InfoBadge>
              Dual-currency columns (INR + Foreign) will appear in the certificate for this purpose.
            </InfoBadge>
          </>
        )}

        <Input
          label="Certificate Date (as on)"
          required
          type="date"
          value={data.certDate}
          onChange={(e) => onChange("certDate", e.target.value)}
        />
      </div>
    </Section>
  );
}
