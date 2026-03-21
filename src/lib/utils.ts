import type { AnnexureRow, FormData, CertificateTotals, PurposeValue } from "@/types";
import { FOREIGN_PURPOSES, CA_FIRM } from "@/constants";

// ─── Number Formatting ────────────────────────────────────────────────────────

export function formatINR(value: number): string {
  if (!value) return "XXXX";
  return value.toLocaleString("en-IN");
}

export function formatForeign(value: number): string {
  if (!value) return "XXXX";
  return value.toLocaleString("en-US");
}

export function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, "")) || 0;
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function formatCertDate(isoDate: string): string {
  if (!isoDate) return "DD-MM-YYYY";
  const d = new Date(isoDate);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}
export function deriveAssessmentYear(isoDate: string): string {
  if (!isoDate) return "2025-26";
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  
  // In India, financial year starts in April. 
  // If date is Jan-Mar 2024, FY is 2023-24, AY is 2024-25.
  // If date is Apr-Dec 2024, FY is 2024-25, AY is 2025-26.
  if (month <= 3) {
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `${year + 1}-${String(year + 2).slice(-2)}`;
  }
}
// ─── Purpose Phrase ───────────────────────────────────────────────────────────

export function getPurposePhrase(purpose: PurposeValue | "", country: string): string {
  switch (purpose) {
    case "travel_visa":
      return `to establish their financial ability for visiting ${country || "the destination country"}`;
    case "study_loan":
      return `to establish their financial ability for studying abroad in ${country || "the destination country"}`;
    case "bank_finance":
      return "for the renewal of the loan";
    case "disputes":
      return "for the purpose of Disputes";
    case "tender":
      return "for the purpose of Tender Participation";
    case "franchise":
      return "for the purpose of Franchise Application";
    case "foreign_collab":
      return `for the purpose of Foreign Collaboration / Joint Venture with ${country || "the foreign entity"}`;
    case "nbfc":
      return "for the purpose of Financial Institutions / NBFC Registration";
    case "insolvency":
      return "for the purpose of Insolvency / Financial Restructuring";
    case "personal_planning":
      return "for the purpose of Personal Financial Planning";
    case "business_valuation":
      return "for the purpose of Business Valuation";
    default:
      return "for the purpose as mentioned above";
  }
}

// ─── Foreign Currency Check ───────────────────────────────────────────────────

export function isForeignPurpose(purpose: PurposeValue | ""): boolean {
  return FOREIGN_PURPOSES.includes(purpose as PurposeValue);
}

// ─── Annexure Row Summation ───────────────────────────────────────────────────

export function sumRows(rows: AnnexureRow[]): number {
  return rows.reduce((sum, row) => sum + parseAmount(row.inr), 0);
}

export function sumForeignRows(rows: string[]): number {
  return rows.reduce((sum, val) => sum + parseAmount(val), 0);
}

// ─── Resolve label: use custom label if set, fall back to default ─────────────

export function resolveLabel(defaultLabel: string, customLabel?: string): string {
  return customLabel?.trim() ? customLabel.trim() : defaultLabel;
}

// ─── Build Movable Rows ──────────────────────────────────────────────────────

export function buildMovableRows(d: FormData): AnnexureRow[] {
  const rows: AnnexureRow[] = [];

  d.movableTypes.forEach((type) => {
    let label = resolveLabel(type, d.movableLabels?.[type]);
    if (type === "Gold & Jewellery") {
      const grams = d.goldGrams || "___";
      label = `Gold ornaments weighing ${grams} gms (In the Name of the Applicant)`;
      const sub = d.movableLabels?.["Gold & Jewellery"]?.trim();
      if (sub) label += ` — ${sub}`;
    }
    rows.push({ label, inr: "" });
  });

  if (rows.length === 0) {
    rows.push({ label: "Specify movable asset details", inr: "" });
  }

  return rows;
}

// ─── Build Savings Rows ───────────────────────────────────────────────────────

export function buildSavingsRows(d: FormData): AnnexureRow[] {
  const hasBank  = d.savingsTypes.includes("Bank-Related Assets");
  const hasInsur = d.savingsTypes.includes("Insurance");
  
  const rows: AnnexureRow[] = [];

  if (hasBank) {
    const customLabel = d.savingsLabels?.["Bank-Related Assets"]?.trim();
    rows.push({
      label: d.bankDetails
        ? `${d.bankDetails} (Account in the name of the Applicant)`
        : (customLabel ? `${customLabel} (Account in the name of the Applicant)` : "Bank Account Details (Account in the name of the Applicant)"),
      inr: "",
    });
  }

  if (hasInsur) {
    if (d.policies.length > 0) {
      d.policies.forEach((policy, i) => {
        rows.push({
          label: policy
            ? `Sum Assured in LIC Policy in the name of the Applicant Having Policy Number ${policy}`
            : `Sum Assured in LIC/Insurance Policy ${i + 1}`,
          inr: "",
        });
      });
    } else {
      const customLabel = resolveLabel("Insurance Policy", d.savingsLabels?.["Insurance"]);
      rows.push({ label: customLabel, inr: "" });
    }
  }

  // Ticked categories excluding special ones handled above
  d.savingsTypes.forEach((type) => {
    if (type !== "Bank-Related Assets" && type !== "Insurance") {
      const customLabel = resolveLabel(type, d.savingsLabels?.[type]);
      rows.push({ label: customLabel, inr: "" });
    }
  });

  if (rows.length === 0) {
    rows.push({ label: "Savings Details", inr: "" });
  }

  return rows;
}

// ─── Compute Certificate Totals ───────────────────────────────────────────────

export function computeTotals(d: FormData): CertificateTotals {
  const incomeRows   = d.incomeRows;
  const immovRows    = d.immovableRows;
  const movRows      = d.movableRows;
  const savRows      = d.savingsRows ?? buildSavingsRows(d);

  const incomeINR    = sumRows(incomeRows);
  const immovableINR = sumRows(immovRows);
  const movableINR   = sumRows(movRows);
  const savingsINR   = sumRows(savRows);

  const incomeForeign    = sumForeignRows(d.incomeFR);
  const immovableForeign = sumForeignRows(d.immovableFR);
  const movableForeign   = sumForeignRows(d.movableFR);
  const savingsForeign   = sumForeignRows(d.savingsFR);

  return {
    incomeINR,
    immovableINR,
    movableINR,
    savingsINR,
    grandINR: incomeINR + immovableINR + movableINR + savingsINR,
    incomeForeign,
    immovableForeign,
    movableForeign,
    savingsForeign,
    grandForeign: incomeForeign + immovableForeign + movableForeign + savingsForeign,
  };
}

// ─── Certificate Text Builder (for copy/print) ────────────────────────────────

export function buildCertificateText(d: FormData): string {
  const totals = computeTotals(d);
  const isForeign = isForeignPurpose(d.purpose);
  const applicantName = `${d.salutation} ${d.fullName}`;
  const dateStr = formatCertDate(d.certDate);
  const purposeTxt = getPurposePhrase(d.purpose, d.country);
  const savRows = d.savingsRows ?? buildSavingsRows(d);
  const docs = d.supportingDocs.length > 0
    ? d.supportingDocs
    : ["Income tax return copies of Applicant.", "Valuation/self-declaration documents of immovable properties."];

  let text = `TO WHOMSOEVER IT MAY CONCERN\n\nNETWORTH CERTIFICATE\n\n`;
  text += `I, BODDU ABHISHEK, member of The Institute of Chartered Accountants of India, do hereby certify that I have reviewed the financial condition of the Applicant, ${applicantName}, with the view to furnish his net worth ${purposeTxt}. The Below detail of the assets are obtained as on ${dateStr}\n\n`;

  if (!isForeign) {
    text += `Sl. No. | SOURCES OF FUNDS       | INDIAN (Rs.)  | REFERENCE (ANNEXURES)\n`;
    text += `--------|------------------------|---------------|----------------------\n`;
    text += `1       | Current Income         | ${formatINR(totals.incomeINR).padEnd(13)} | I\n`;
    text += `2.      | Immovable Assets       | ${formatINR(totals.immovableINR).padEnd(13)} | II\n`;
    text += `3.      | Movable Properties     | ${formatINR(totals.movableINR).padEnd(13)} | III\n`;
    text += `4.      | Current Savings        | ${formatINR(totals.savingsINR).padEnd(13)} | IV\n`;
    text += `        | Total                  | ${formatINR(totals.grandINR).padEnd(13)} |\n\n`;
  } else {
    text += `Sl. No. | SOURCES OF FUNDS       | INDIAN (Rs.)  | ${d.country.padEnd(14)} | REFERENCE\n`;
    text += `--------|------------------------|---------------|----------------|----------\n`;
    text += `1       | Current Income         | ${formatINR(totals.incomeINR).padEnd(13)} | ${formatForeign(totals.incomeForeign).padEnd(14)} | I\n`;
    text += `2.      | Immovable Assets       | ${formatINR(totals.immovableINR).padEnd(13)} | ${formatForeign(totals.immovableForeign).padEnd(14)} | II\n`;
    text += `3.      | Movable Properties     | ${formatINR(totals.movableINR).padEnd(13)} | ${formatForeign(totals.movableForeign).padEnd(14)} | III\n`;
    text += `4.      | Current Savings        | ${formatINR(totals.savingsINR).padEnd(13)} | ${formatForeign(totals.savingsForeign).padEnd(14)} | IV\n`;
    text += `        | Total                  | ${formatINR(totals.grandINR).padEnd(13)} | ${formatForeign(totals.grandForeign).padEnd(14)} |\n\n`;
  }

  text += `The above figures are compiled from the following documents and certificates submitted before me:\n`;
  docs.forEach((doc, i) => { text += `${i + 1}. ${doc}\n`; });

  text += `\nANNEXURE-I    CURRENT INCOME\n`;
  text += `Particulars                                         | Indian (Rs.)\n`;
  d.incomeRows.forEach(row => { text += `${row.label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`; });
  text += `Total                                               | ${formatINR(totals.incomeINR)}\n`;

  text += `\nANNEXURE – II    IMMOVABLE ASSETS\n`;
  text += `Particulars                                         | Indian (Rs.)\n`;
  d.immovableRows.forEach(row => { text += `${row.label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`; });
  text += `Total                                               | ${formatINR(totals.immovableINR)}\n`;

  text += `\nANNEXURE – III    MOVABLE PROPERTIES\n`;
  text += `Particulars                                         | Indian (Rs.)\n`;
  d.movableRows.forEach((row, i) => {
    const label = (i === 0 && d.goldGrams) ? `Gold ornaments weighing ${d.goldGrams} gms (In the Name of the Applicant)` : row.label;
    text += `${label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`;
  });
  text += `Total                                               | ${formatINR(totals.movableINR)}\n`;

  text += `\nANNEXURE – IV    CURRENT SAVINGS\n`;
  text += `Particulars                                         | Indian (Rs.)\n`;
  savRows.forEach(row => { text += `${row.label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`; });
  text += `Total                                               | ${formatINR(totals.savingsINR)}\n`;

  text += `\nFor ${CA_FIRM.name},\n${CA_FIRM.type},\nFRN ${CA_FIRM.frn}\n\n`;
  text += `${CA_FIRM.partnerName}\n${CA_FIRM.partnerTitle}\nMembership No. ${CA_FIRM.membershipNo}\n`;
  text += `Date: ${dateStr}\nPlace: ${CA_FIRM.place}\nUDIN: ${d.udin || "__________________________"}\n`;

  return text;
}
