import type { AnnexureRow, FormData, CertificateTotals, PurposeValue } from "@/types";
import { FOREIGN_PURPOSES, GOLD_REFERENCE_PRICES } from "@/constants";

// ─── Number Formatting ────────────────────────────────────────────────────────

/** Rounds to 2 decimal places (for foreign currency conversions) */
export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

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

// ─── Number to Words (Indian Rupees) ─────────────────────────────────────────

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

/** Converts a number 0–99 to words */
function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const ten = TENS[Math.floor(n / 10)] ?? "";
  const one = ONES[n % 10] ?? "";
  return one ? `${ten} ${one}` : ten;
}

/** Converts a number 0–999 to words */
function threeDigitWords(n: number): string {
  if (n === 0) return "";
  if (n < 100) return twoDigitWords(n);
  const hundreds = ONES[Math.floor(n / 100)] ?? "";
  const remainder = n % 100;
  const rest = remainder > 0 ? ` and ${twoDigitWords(remainder)}` : "";
  return `${hundreds} Hundred${rest}`;
}

/**
 * Converts an integer to words using the Indian numbering system
 * (Crore, Lakh, Thousand, Hundred).
 */
function integerToWordsIndian(n: number): string {
  if (n === 0) return "Zero";
  if (n < 0) return `Minus ${integerToWordsIndian(-n)}`;

  const parts: string[] = [];

  // Crores (groups of 2 digits after the first 7-digit chunk)
  const crores = Math.floor(n / 10_000_000);
  if (crores > 0) {
    // For crores > 99, recursively break down (e.g. 150 Crore)
    parts.push(`${crores > 99 ? integerToWordsIndian(crores) : twoDigitWords(crores)} Crore`);
    n %= 10_000_000;
  }

  // Lakhs (2 digits)
  const lakhs = Math.floor(n / 100_000);
  if (lakhs > 0) {
    parts.push(`${twoDigitWords(lakhs)} Lakh`);
    n %= 100_000;
  }

  // Thousands (2 digits)
  const thousands = Math.floor(n / 1_000);
  if (thousands > 0) {
    parts.push(`${twoDigitWords(thousands)} Thousand`);
    n %= 1_000;
  }

  // Hundreds + remainder
  if (n > 0) {
    parts.push(threeDigitWords(n));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Converts a numeric amount to Indian Rupees in words.
 *
 * @example
 *   numberToWordsINR(1_25_50_000) → "Rupees One Crore Twenty Five Lakh Fifty Thousand Only"
 *   numberToWordsINR(45000.50)    → "Rupees Forty Five Thousand and Paise Fifty Only"
 *   numberToWordsINR(0)           → "Rupees Zero Only"
 */
export function numberToWordsINR(amount: number): string {
  if (!isFinite(amount)) return "Rupees Zero Only";

  const absAmount = Math.abs(amount);
  const intPart = Math.floor(absAmount);
  const decPart = Math.round((absAmount - intPart) * 100);

  const sign = amount < 0 ? "Minus " : "";
  const rupeeWords = integerToWordsIndian(intPart);

  if (decPart > 0) {
    const paiseWords = twoDigitWords(decPart);
    return `${sign}Rupees ${rupeeWords} and Paise ${paiseWords} Only`;
  }

  return `${sign}Rupees ${rupeeWords} Only`;
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
/**
 * Derives the Indian Financial Year (FY) from a date.
 * FY runs April to March. E.g. Jan 2025 → FY 2024-25, Jul 2025 → FY 2025-26.
 */
export function deriveFinancialYear(isoDate: string): string {
  if (!isoDate) return "2024-25";
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  if (month <= 3) {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
  return `${year}-${String(year + 1).slice(-2)}`;
}

/**
 * Derives the Indian Assessment Year (AY) from a date.
 * AY = FY + 1. E.g. Jan 2025 (FY 2024-25) → AY 2025-26, Jul 2025 (FY 2025-26) → AY 2026-27.
 */
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
  }
  return `${year + 1}-${String(year + 2).slice(-2)}`;
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

// ─── Gold Price Validation ────────────────────────────────────────────────────

/**
 * Estimates gold value from grams and returns a reference range.
 * Useful for the CA to quickly verify whether the applicant's
 * declared gold value is within a reasonable range.
 */
export function estimateGoldValue(grams: number): {
  estimated22k: number;
  estimated24k: number;
  lowerBound: number; // 22k - 15% (for making charges, old gold, etc.)
  upperBound: number; // 24k + 10% (for making charges, antique value, etc.)
} {
  const estimated22k = Math.round(grams * GOLD_REFERENCE_PRICES.price22kPerGram);
  const estimated24k = Math.round(grams * GOLD_REFERENCE_PRICES.price24kPerGram);
  return {
    estimated22k,
    estimated24k,
    lowerBound: Math.round(estimated22k * 0.85),
    upperBound: Math.round(estimated24k * 1.10),
  };
}

/**
 * Checks whether a declared gold value is within a reasonable range
 * given the weight in grams. Returns a warning message if outside range,
 * or null if acceptable.
 */
export function validateGoldValue(grams: number, declaredINR: number): string | null {
  if (grams <= 0 || declaredINR <= 0) return null;
  const { lowerBound, upperBound } = estimateGoldValue(grams);
  if (declaredINR < lowerBound) {
    return `Declared gold value (${formatINR(declaredINR)}) seems low for ${grams}g. Expected range: ${formatINR(lowerBound)} - ${formatINR(upperBound)}`;
  }
  if (declaredINR > upperBound) {
    return `Declared gold value (${formatINR(declaredINR)}) seems high for ${grams}g. Expected range: ${formatINR(lowerBound)} - ${formatINR(upperBound)}`;
  }
  return null;
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

  const rate = parseFloat(d.exchangeRate) || 83; // Use 83 as default if not set

  // Use manual foreign values if any row has a non-empty value, otherwise compute from INR.
  // We check for non-empty strings rather than using `||` so that manual zero is respected.
  const hasManualFR = (arr: string[]) => arr.some(v => v.trim() !== "");

  const incomeForeign    = hasManualFR(d.incomeFR) ? sumForeignRows(d.incomeFR) : roundTo2(incomeINR / rate);
  const immovableForeign = hasManualFR(d.immovableFR) ? sumForeignRows(d.immovableFR) : roundTo2(immovableINR / rate);
  const movableForeign   = hasManualFR(d.movableFR) ? sumForeignRows(d.movableFR) : roundTo2(movableINR / rate);
  const savingsForeign   = hasManualFR(d.savingsFR) ? sumForeignRows(d.savingsFR) : roundTo2(savingsINR / rate);

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

// ─── Gender Pronoun Helper ─────────────────────────────────────────────────────

/**
 * Derive possessive pronoun ("his" / "her") from the salutation.
 * Falls back to "his/her" if salutation is not recognized.
 */
export function getPossessivePronoun(salutation: string): string {
  const s = salutation.trim().toLowerCase().replace(/\.$/, "");
  if (s === "mr") return "his";
  if (s === "ms" || s === "mrs") return "her";
  return "his/her";
}

// ─── Certificate Text Builder (for copy/print) ────────────────────────────────

export function buildCertificateText(d: FormData): string {
  const totals = computeTotals(d);
  const isForeign = isForeignPurpose(d.purpose);
  const applicantName = `${d.salutation} ${d.fullName}`;
  const dateStr = formatCertDate(d.certDate);
  const purposeTxt = getPurposePhrase(d.purpose, d.country);
  const savRows = buildSavingsRows(d).map((row, i) => ({
    ...row,
    label: row.label || `Savings Entry ${i + 1}`,
    inr: d.savingsRows?.[i]?.inr || "",
  }));
  const hasNewSavingsModel = Object.keys(d.savingsEntries ?? {}).length > 0;
  const docs = d.supportingDocs.length > 0
    ? d.supportingDocs
    : ["Income tax return copies of Applicant.", "Valuation/self-declaration documents of immovable properties."];

  const pronoun = getPossessivePronoun(d.salutation);

  let text = `TO WHOMSOEVER IT MAY CONCERN\n\nNETWORTH CERTIFICATE\n\n`;
  text += `I, ${d.signatoryName || "[Signatory Name]"}, member of The Institute of Chartered Accountants of India, do hereby certify that I have reviewed the financial condition of the Applicant, ${applicantName}, with the view to furnish ${pronoun} net worth ${purposeTxt}. The Below detail of the assets are obtained as on ${dateStr}\n\n`;

  if (!isForeign) {
    text += `Sl. No. | SOURCES OF FUNDS       | INDIAN (Rs.)  | REFERENCE (ANNEXURES)\n`;
    text += `--------|------------------------|---------------|----------------------\n`;
    text += `1.      | Current Income         | ${formatINR(totals.incomeINR).padEnd(13)} | I\n`;
    text += `2.      | Immovable Assets       | ${formatINR(totals.immovableINR).padEnd(13)} | II\n`;
    text += `3.      | Movable Properties     | ${formatINR(totals.movableINR).padEnd(13)} | III\n`;
    text += `4.      | Current Savings        | ${formatINR(totals.savingsINR).padEnd(13)} | IV\n`;
    text += `        | Total                  | ${formatINR(totals.grandINR).padEnd(13)} |\n`;
    text += `(${numberToWordsINR(totals.grandINR)})\n\n`;
  } else {
    text += `Sl. No. | SOURCES OF FUNDS       | INDIAN (Rs.)  | ${d.country.padEnd(14)} | REFERENCE\n`;
    text += `--------|------------------------|---------------|----------------|----------\n`;
    text += `1.      | Current Income         | ${formatINR(totals.incomeINR).padEnd(13)} | ${formatForeign(totals.incomeForeign).padEnd(14)} | I\n`;
    text += `2.      | Immovable Assets       | ${formatINR(totals.immovableINR).padEnd(13)} | ${formatForeign(totals.immovableForeign).padEnd(14)} | II\n`;
    text += `3.      | Movable Properties     | ${formatINR(totals.movableINR).padEnd(13)} | ${formatForeign(totals.movableForeign).padEnd(14)} | III\n`;
    text += `4.      | Current Savings        | ${formatINR(totals.savingsINR).padEnd(13)} | ${formatForeign(totals.savingsForeign).padEnd(14)} | IV\n`;
    text += `        | Total                  | ${formatINR(totals.grandINR).padEnd(13)} | ${formatForeign(totals.grandForeign).padEnd(14)} |\n`;
    text += `(${numberToWordsINR(totals.grandINR)})\n\n`;
  }

  text += `The above figures are compiled from the following documents and certificates submitted before me:\n`;
  docs.forEach((doc, i) => { text += `${i + 1}. ${doc}\n`; });

  text += `\nANNEXURE-I    CURRENT INCOME\n`;
  text += `Particulars                                         | Indian (Rs.)\n`;

  if (d.incomeTypes.length > 0) {
    d.incomeTypes.forEach((person, i) => {
      const personName = d.incomeLabels[person]?.trim() || (person === "Self" ? (d.fullName || "[Name]") : "[Name]");
      const base = person === "Self"
        ? "Income of the Applicant"
        : `Income of the Applicant\u2019s ${person}`;
      const label = `${base} \u2013 ${personName}`;
      const inr = d.incomeRows[i]?.inr ?? "";
      text += `${label.padEnd(52)} | ${inr ? formatINR(parseAmount(inr)) : ""}\n`;
    });
  } else {
    d.incomeRows.forEach(row => { text += `${row.label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`; });
  }
  text += `Total                                               | ${formatINR(totals.incomeINR)}\n`;

  text += `\nANNEXURE – II    IMMOVABLE ASSETS\n`;
  if (d.immovableTypes.length > 0) {
    const displayPersons = d.immovableTypes.map(t => {
      const name = d.immovableLabels[t]?.trim();
      return name ? `${t} (${name})` : t;
    }).join(", ");
    text += `Properties Declared For: ${displayPersons}\n`;
  }
  text += `Particulars                                         | Indian (Rs.)\n`;
  d.immovableRows.forEach(row => { text += `${row.label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`; });
  text += `Total                                               | ${formatINR(totals.immovableINR)}\n`;

  text += `\nANNEXURE – III    MOVABLE PROPERTIES\n`;
  // New person-based model: use movableRows directly (already has full labels)
  const hasNewMovableModel = Object.keys(d.movableAssets ?? {}).length > 0;
  if (hasNewMovableModel && d.movableTypes.length > 0) {
    const displayPersons = d.movableTypes.map(t => {
      const name = d.movableLabels[t]?.trim();
      return name ? `${t} (${name})` : t;
    }).join(", ");
    text += `Assets Declared For: ${displayPersons}\n`;
  }
  text += `Particulars                                         | Indian (Rs.)\n`;
  if (hasNewMovableModel) {
    d.movableRows.forEach(row => { text += `${row.label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`; });
  } else {
    // Legacy: old category-based model
    d.movableRows.forEach((row, i) => {
      const label = (i === 0 && d.goldGrams) ? `Gold ornaments weighing ${d.goldGrams} gms (In the Name of the Applicant)` : row.label;
      text += `${label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`;
    });
  }
  text += `Total                                               | ${formatINR(totals.movableINR)}\n`;

  text += `\nANNEXURE – IV    CURRENT SAVINGS\n`;
  // New person-based model: use savingsRows directly (already has full labels)
  if (hasNewSavingsModel && d.savingsTypes.length > 0) {
    const displayPersons = d.savingsTypes.map(t => {
      const name = d.savingsLabels[t]?.trim();
      return name ? `${t} (${name})` : t;
    }).join(", ");
    text += `Savings Declared For: ${displayPersons}\n`;
  }
  text += `Particulars                                         | Indian (Rs.)\n`;
  if (hasNewSavingsModel) {
    (d.savingsRows ?? []).forEach(row => { text += `${row.label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`; });
  } else {
    // Legacy: old category-based model
    savRows.forEach(row => { text += `${row.label.padEnd(52)} | ${row.inr ? formatINR(parseAmount(row.inr)) : ""}\n`; });
  }
  text += `Total                                               | ${formatINR(totals.savingsINR)}\n`;

  text += `\nFor ${d.firmName || "[Firm Name]"},\n${d.firmType || "Chartered Accountants"},\nFRN ${d.firmFRN || "[FRN]"}\n\n`;
  text += `${d.signatoryName || "[Signatory Name]"}\n${d.signatoryTitle || "[Designation]"}\nMembership No. ${d.membershipNo || "[Membership No.]"}\n`;
  text += `Date: ${dateStr}\nPlace: ${d.signPlace || "[Place]"}\nUDIN: ${d.udin || "__________________________"}\n`;

  return text;
}
