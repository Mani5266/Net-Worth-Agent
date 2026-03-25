"use client";

import { Section, Select, Input, InfoBadge } from "@/components/ui";
import { PURPOSE_OPTIONS, COUNTRIES } from "@/constants";
import { useFormContext } from "@/hooks/useFormContext";
import type { PurposeValue } from "@/types";

export function StepPurpose() {
  const { data, updateField, isForeign } = useFormContext();

  return (
    <Section title="Purpose of Net Worth Certificate">
      <div className="flex flex-col gap-4">
        <Select
          label="Select Purpose"
          required
          value={data.purpose}
          onChange={(e) => updateField("purpose", e.target.value as PurposeValue)}
          options={PURPOSE_OPTIONS}
          placeholder="Choose purpose..."
        />

        {isForeign && (
          <>
            <Select
              label="Destination Country"
              required
              value={data.country}
              onChange={(e) => updateField("country", e.target.value)}
              options={COUNTRIES}
              placeholder="Select country..."
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
          onChange={(e) => updateField("certDate", e.target.value)}
        />
      </div>
    </Section>
  );
}
