"use client";

import { Section, Checkbox, Input, Textarea, Button } from "@/components/ui";
import { AnnexureTable } from "@/components/ui/AnnexureTable";
import { FileUpload } from "@/components/ui/FileUpload";
import {
  INCOME_TYPES, IMMOVABLE_TYPES, MOVABLE_TYPES, SAVINGS_TYPES, SUPPORTING_DOCS,
} from "@/constants";
import {
  deriveAssessmentYear, buildSavingsRows, buildMovableRows,
} from "@/lib/utils";
import type { FormData, UploadedDoc } from "@/types";

// ─── Shared Props ─────────────────────────────────────────────────────────────

interface AnnexureStepProps {
  data: FormData;
  isForeign: boolean;
  toggleType: (item: string) => void;
  updateRow: (index: number, value: string) => void;
  updateForeignRow: (index: number, value: string) => void;
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  updateLabel: (type: string, value: string) => void;
  usdRate?: number | null;
}

const INCOME_PLACEHOLDERS: Record<string, string> = {
  "Salary / Employment Income": "e.g. Salary from ABC Pvt Ltd",
  "Business / Professional Income": "e.g. Income from medical / legal practice",
  "Rental Income": "e.g. Rent from property at Banjara Hills",
  "Interest Income": "e.g. Interest from FD at SBI Bank",
  "Dividend Income": "e.g. Dividends from equity holdings",
  "Capital Gains (if realized during the year)": "e.g. Gains from sale of property / shares",
  "Other Income (If any)": "e.g. Agricultural income / freelance income",
};

// ─── Step 3 — Annexure I: Current Income ──────────────────────────────────────

interface StepIncomeProps extends AnnexureStepProps {
  addIncomeDocs: (incomeType: string, files: File[]) => void;
  removeIncomeDoc: (incomeType: string, index: number) => void;
}

export function StepIncome({
  data,
  isForeign,
  toggleType,
  updateRow,
  updateForeignRow,
  updateField,
  updateLabel,
  addIncomeDocs,
  removeIncomeDoc,
  usdRate,
}: StepIncomeProps) {
  const assessmentYear = deriveAssessmentYear(data.certDate);
  const incomeLabel = `Income of the Applicant – ${data.fullName || "[Name of Applicant]"} for the Assessment Year ${assessmentYear}`;
  
  const rows = data.incomeRows.map((row, i) => {
    if (i === 0 && (row.label === "Income of the Applicant" || row.label.startsWith("Income of the Applicant –"))) {
      return { ...row, label: incomeLabel };
    }
    return row;
  });

  return (
    <Section title="💰 Annexure I — Current Income">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
            Select Income Sources
          </p>
          {INCOME_TYPES.map((t) => {
            const isChecked = data.incomeTypes.includes(t);
            return (
              <div key={t}>
                <Checkbox
                  label={t}
                  checked={isChecked}
                  onToggle={() => toggleType(t)}
                  customLabel={data.incomeLabels[t] ?? ""}
                  onCustomLabelChange={isChecked ? (v) => updateLabel(t, v) : undefined}
                  customPlaceholder={INCOME_PLACEHOLDERS[t] || "e.g. add specific details…"}
                />
                {/* Document upload zone per income type */}
                {isChecked && (
                  <div className="ml-6 mb-1">
                    <FileUpload
                      label={data.incomeLabels[t] || t}
                      docs={data.incomeDocs[t] ?? []}
                      onAdd={(files) => addIncomeDocs(t, files)}
                      onRemove={(i) => removeIncomeDoc(t, i)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
            Income Amounts <span className="text-red-500">*</span>
          </p>
          <AnnexureTable
            rows={rows}
            onChangeInr={updateRow}
            isForeign={isForeign}
            countryLabel={data.country || "Foreign"}
            foreignRows={data.incomeFR}
            onChangeForeign={updateForeignRow}
            usdRate={usdRate}
          />
          <p className="text-xs text-gray-400 mt-1">Assessment Year: {assessmentYear}</p>
        </div>

        {isForeign && (
          <div className="mt-3">
            <Input
              label="Exchange Rate (as on last savings date) *"
              placeholder="e.g. 1 USD = 84.50 INR"
              value={data.exchangeRate}
              onChange={(e) => updateField("exchangeRate", e.target.value)}
              hint="Foreign currency column is auto-calculated by dividing INR total by this rate"
            />
          </div>
        )}
      </div>
    </Section>
  );
}

const IMMOVABLE_PLACEHOLDERS: Record<string, string> = {
  "Residential Property": "e.g. Flat No. 301, Green Valley Apartments",
  "Commercial Property": "e.g. Shop No. 12, MG Road Commercial Complex",
  "Land": "e.g. Survey No. 45, Shamshabad Village",
  "Under-Construction Property": "e.g. Plot No. 7, Prestige Township Phase 2",
  "Jointly Owned Property": "e.g. Joint ownership with spouse / family member",
};

interface StepImmovableProps extends AnnexureStepProps {
  addImmovableDocs: (type: string, files: File[]) => void;
  removeImmovableDoc: (type: string, index: number) => void;
}

export function StepImmovable({
  data,
  isForeign,
  toggleType,
  updateRow,
  updateForeignRow,
  updateField,
  updateLabel,
  addImmovableDocs,
  removeImmovableDoc,
  usdRate,
}: StepImmovableProps) {
  const immovableTableLabel = data.propertyAddress
    ? `Address of the immovable property — ${data.propertyAddress}`
    : "Address of the immovable property and its details.";

  const rows = data.immovableRows.map((row, i) => {
    if (i === 0 && (row.label === "Address of the immovable property and its details." || row.label.startsWith("Address of the immovable property —"))) {
      return { ...row, label: immovableTableLabel };
    }
    return row;
  });

  return (
    <Section title="🏠 Annexure II — Immovable Assets">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
            Property Types
          </p>
          {IMMOVABLE_TYPES.map((t) => {
            const isChecked = data.immovableTypes.includes(t);
            return (
              <div key={t}>
                <Checkbox
                  label={t}
                  checked={isChecked}
                  onToggle={() => toggleType(t)}
                  customLabel={data.immovableLabels[t] ?? ""}
                  onCustomLabelChange={isChecked ? (v) => updateLabel(t, v) : undefined}
                  customPlaceholder={IMMOVABLE_PLACEHOLDERS[t] || "e.g. plot no., area…"}
                />
                {isChecked && (
                  <div className="ml-6 mb-1">
                    <FileUpload
                      label={data.immovableLabels[t] || t}
                      hint="Upload property valuation report, sale deed or self-declaration (PDF or JPG)"
                      docs={data.immovableDocs[t] ?? []}
                      onAdd={(files) => addImmovableDocs(t, files)}
                      onRemove={(i) => removeImmovableDoc(t, i)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data.immovableTypes.length > 0 && (
          <Textarea
            label="Address of Property / Business Premises"
            hint="Door No/Plot No · Area · District · State · India · Pincode"
            rows={3}
            placeholder="Full property address…"
            value={data.propertyAddress}
            onChange={(e) => updateField("propertyAddress", e.target.value)}
          />
        )}

        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
            Asset Amounts <span className="text-red-500">*</span>
          </p>
          <AnnexureTable
            rows={rows}
            onChangeInr={updateRow}
            isForeign={isForeign}
            countryLabel={data.country || "Foreign"}
            foreignRows={data.immovableFR}
            onChangeForeign={updateForeignRow}
            usdRate={usdRate}
          />
        </div>

        {isForeign && (
          <div className="mt-3">
            <Input
              label="Exchange Rate (as on last savings date)"
              placeholder="e.g. 1 USD = 84.50 INR"
              value={data.exchangeRate}
              onChange={(e) => updateField("exchangeRate", e.target.value)}
              hint="Foreign currency column is auto-calculated by dividing INR total by this rate"
            />
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Step 5 — Annexure III: Movable Properties ───────────────────────────────

const MOVABLE_PLACEHOLDERS: Record<string, string> = {
  "Gold & Jewellery": "e.g. Gold necklace, bangles, earrings",
  "Vehicles": "e.g. Honda City 2022, Registration No. TS09AB1234",
  "Household Assets (if required)": "e.g. Furniture, electronics, appliances",
  "Other Movable Assets": "e.g. Artwork, antiques, machinery",
};

interface StepMovableProps extends AnnexureStepProps {
  addMovableDocs: (type: string, files: File[]) => void;
  removeMovableDoc: (type: string, index: number) => void;
}

export function StepMovable({
  data,
  isForeign,
  toggleType,
  updateRow,
  updateForeignRow,
  updateField,
  updateLabel,
  addMovableDocs,
  removeMovableDoc,
  usdRate,
}: StepMovableProps) {
  const hasGold = data.movableTypes.includes("Gold & Jewellery");
  const rows = buildMovableRows(data);
  
  // Map the amounts from current state back to dynamic rows
  const preparedRows = rows.map((row, i) => {
    // Attempt to preserve amounts if possible (matching indices)
    return { ...row, inr: data.movableRows[i]?.inr || "" };
  });

  return (
    <Section title="🚗 Annexure III — Movable Properties">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
            Asset Types
          </p>
          <p className="text-[10px] text-gray-400 -mt-2 mb-2 italic">Specify value in Rupees</p>
          {MOVABLE_TYPES.map((t) => {
            const isChecked = data.movableTypes.includes(t);
            return (
              <div key={t}>
                <Checkbox
                  label={t}
                  checked={isChecked}
                  onToggle={() => toggleType(t)}
                  customLabel={data.movableLabels[t] ?? ""}
                  onCustomLabelChange={isChecked ? (v) => updateLabel(t, v) : undefined}
                  customPlaceholder={MOVABLE_PLACEHOLDERS[t] || "e.g. make, model, year…"}
                />
                {isChecked && (
                  <div className="ml-6 mb-1">
                    <FileUpload
                      label={data.movableLabels[t] || t}
                      hint="Upload valuation certificate, RC copy or purchase invoice (PDF or JPG)"
                      docs={data.movableDocs[t] ?? []}
                      onAdd={(files) => addMovableDocs(t, files)}
                      onRemove={(i) => removeMovableDoc(t, i)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasGold && (
          <Input
            label="Gold Weight (grams)"
            type="number"
            placeholder="e.g. 50"
            value={data.goldGrams}
            onChange={(e) => updateField("goldGrams", e.target.value)}
          />
        )}

        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
            Asset Amounts <span className="text-red-500">*</span>
          </p>
          <AnnexureTable
            rows={preparedRows}
            onChangeInr={updateRow}
            isForeign={isForeign}
            countryLabel={data.country || "Foreign"}
            foreignRows={data.movableFR}
            onChangeForeign={updateForeignRow}
            usdRate={usdRate}
          />
        </div>

        {isForeign && (
          <div className="mt-3">
            <Input
              label="Exchange Rate (as on last savings date)"
              placeholder="e.g. 1 USD = 84.50 INR"
              value={data.exchangeRate}
              onChange={(e) => updateField("exchangeRate", e.target.value)}
              hint="Foreign currency column is auto-calculated by dividing INR total by this rate"
            />
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Step 6 — Annexure IV: Current Savings ───────────────────────────────────

interface StepSavingsProps {
  data: FormData;
  isForeign: boolean;
  toggleType: (item: string) => void;
  toggleDoc: (item: string) => void;
  updateSavingsRow: (index: number, value: string) => void;
  updateSavingsFR: (index: number, value: string) => void;
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  updateLabel: (type: string, value: string) => void;
  addPolicy: () => void;
  updatePolicy: (index: number, value: string) => void;
  removePolicy: (index: number) => void;
  addSavingsDocs: (type: string, files: File[]) => void;
  removeSavingsDoc: (type: string, index: number) => void;
  usdRate?: number | null;
}

export function StepSavings({
  data,
  isForeign,
  toggleType,
  toggleDoc,
  updateSavingsRow,
  updateSavingsFR,
  updateField,
  updateLabel,
  addPolicy,
  updatePolicy,
  removePolicy,
  addSavingsDocs,
  removeSavingsDoc,
  usdRate,
}: StepSavingsProps) {
  const hasBank  = data.savingsTypes.includes("Bank-Related Assets");
  const hasInsur = data.savingsTypes.includes("Insurance");

  const initialRows = buildSavingsRows(data);
  // Merge the amounts from state if they exist
  const rows = initialRows.map((row, i) => ({
    ...row,
    inr: data.savingsRows?.[i]?.inr || "",
  }));

  const frRows = data.savingsFR.length === rows.length
    ? data.savingsFR
    : rows.map(() => "");

  // Placeholder hints per savings type
  const SAVINGS_PLACEHOLDERS: Record<string, string> = {
    "Bank-Related Assets": "e.g. SBI Bank A/c No. XXXXXXXXXXXXXXX (in the name of Applicant)",
    "Investment Instruments": "e.g. Mutual Funds, PPF, NPS, Bonds",
    "Insurance": "e.g. LIC Policy — enter policy number below",
    "Physical Assets": "e.g. Safe deposit box, gold coins, collectibles",
    "Other Additions": "e.g. Chit funds, loans given, any other asset",
  };

  const handleToggleTypeWithAutoTick = (type: string) => {
    const isNowTicked = !data.savingsTypes.includes(type);
    toggleType(type);
    
    if (isNowTicked) {
      if (type === "Bank-Related Assets" && !data.supportingDocs.includes("Bank statements")) {
        toggleDoc("Bank statements");
      }
      if (type === "Insurance" && !data.supportingDocs.includes("Insurance policy copies")) {
        toggleDoc("Insurance policy copies");
      }
      if (type === "Investment Instruments" && !data.supportingDocs.includes("Investment / Mutual Fund statements")) {
        toggleDoc("Investment / Mutual Fund statements");
      }
    }
  };

  return (
    <Section title="🏦 Annexure IV — Current Savings">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
            Savings Categories
          </p>
          {SAVINGS_TYPES.map((t) => {
            const isChecked = data.savingsTypes.includes(t);
            return (
              <div key={t}>
                <Checkbox
                  label={t}
                  checked={isChecked}
                  onToggle={() => handleToggleTypeWithAutoTick(t)}
                  customLabel={data.savingsLabels[t] ?? ""}
                  onCustomLabelChange={isChecked ? (v) => updateLabel(t, v) : undefined}
                  customPlaceholder={SAVINGS_PLACEHOLDERS[t] ?? "add details…"}
                />
                {isChecked && (
                  <div className="ml-6 mb-1">
                    <FileUpload
                      label={data.savingsLabels[t] || t}
                      hint={
                        t === "Bank-Related Assets" ? "Upload bank statement (PDF or JPG)" :
                        t === "Insurance" ? "Upload policy copy (PDF or JPG)" :
                        t === "Investment Instruments" ? "Upload fund statement (PDF or JPG)" :
                        t === "Physical Assets" ? "Upload valuation certificate (PDF or JPG)" :
                        "Upload any supporting document (PDF or JPG)"
                      }
                      docs={data.savingsDocs[t] ?? []}
                      onAdd={(files) => addSavingsDocs(t, files)}
                      onRemove={(i) => removeSavingsDoc(t, i)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasBank && (
          <Input
            label="Bank Account Details"
            required
            placeholder="e.g. SBI Bank having A/c No. XXXXXXXXXXXXXXX (Account in the name of the Applicant)"
            value={data.bankDetails}
            onChange={(e) => updateField("bankDetails", e.target.value)}
          />
        )}

        {hasInsur && (
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
              Insurance Policies
            </p>
            <p className="text-[10px] text-gray-400 mb-2 italic">Add each LIC / insurance policy separately with its policy number</p>
            {data.policies.map((pol, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  placeholder={`LIC Policy — Policy Number ${i + 1}`}
                  value={pol}
                  onChange={(e) => updatePolicy(i, e.target.value)}
                />
                {i > 0 && (
                  <Button variant="danger" size="sm" onClick={() => removePolicy(i)}>✕</Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPolicy}>
              + Add Policy
            </Button>
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
            Savings Amounts <span className="text-red-500">*</span>
          </p>
          <AnnexureTable
            rows={rows}
            onChangeInr={updateSavingsRow}
            isForeign={isForeign}
            countryLabel={data.country || "Foreign"}
            foreignRows={frRows}
            onChangeForeign={updateSavingsFR}
            usdRate={usdRate}
          />
        </div>

        {isForeign && (
          <div className="mt-3">
            <Input
              label="Exchange Rate (as on last savings date)"
              placeholder="e.g. 1 USD = 84.50 INR"
              value={data.exchangeRate}
              onChange={(e) => updateField("exchangeRate", e.target.value)}
              hint="Foreign currency column is auto-calculated by dividing INR total by this rate"
            />
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
            Supporting Documents Attached
          </p>
          {SUPPORTING_DOCS.map((doc) => (
            <Checkbox
              key={doc}
              label={doc}
              checked={data.supportingDocs.includes(doc)}
              onToggle={() => toggleDoc(doc)}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
