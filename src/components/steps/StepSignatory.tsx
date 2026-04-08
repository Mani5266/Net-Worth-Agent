"use client";

import { Section, Input, InfoBadge } from "@/components/ui";
import { useFormContext } from "@/hooks/useFormContext";

export function StepSignatory() {
  const { data, updateField } = useFormContext();

  return (
    <div className="space-y-2">
      <Section title="CA Firm Details">
        <div className="space-y-4">
          <Input
            label="Firm Name"
            placeholder="e.g. Smith & Associates"
            value={data.firmName}
            onChange={(e) => updateField("firmName", e.target.value)}
          />
          <Input
            label="Firm Registration Number (FRN)"
            placeholder="e.g. 012345S"
            value={data.firmFRN}
            onChange={(e) => updateField("firmFRN", e.target.value)}
          />
        </div>
      </Section>

      <Section title="Signatory (Partner / Proprietor)">
        <div className="space-y-4">
          <Input
            label="Signatory Name"
            hint="This name appears in the certificate body and signature block (e.g. CA Ramesh Kumar)"
            placeholder="e.g. CA Ramesh Kumar"
            value={data.signatoryName}
            onChange={(e) => updateField("signatoryName", e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Designation / Title"
              placeholder="e.g. Partner"
              value={data.signatoryTitle}
              onChange={(e) => updateField("signatoryTitle", e.target.value)}
            />
            <Input
              label="ICAI Membership Number"
              placeholder="e.g. 123456"
              value={data.membershipNo}
              onChange={(e) => updateField("membershipNo", e.target.value)}
            />
          </div>
          <Input
            label="Place of Signing"
            placeholder="e.g. Mumbai"
            value={data.signPlace}
            onChange={(e) => updateField("signPlace", e.target.value)}
          />
        </div>
      </Section>

      <InfoBadge>
        These details will appear in the certificate body paragraph and signature block.
        The signatory name is used as-is — include the &quot;CA&quot; prefix if desired.
      </InfoBadge>
    </div>
  );
}
