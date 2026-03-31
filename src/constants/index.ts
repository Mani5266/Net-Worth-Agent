import type { PurposeValue, SalutationType, StepDefinition } from "@/types";

// ─── Purpose Options ──────────────────────────────────────────────────────────

export const PURPOSE_OPTIONS: { value: PurposeValue; label: string }[] = [
  { value: "bank_finance",       label: "Bank Finance" },
  { value: "study_loan",         label: "Study Loan Purpose / Scholarship" },
  { value: "travel_visa",        label: "Travelling VISA" },
  { value: "disputes",           label: "Disputes" },
  { value: "tender",             label: "Tender Participation" },
  { value: "franchise",          label: "Franchise Applications" },
  { value: "foreign_collab",     label: "Foreign Collaboration / Joint Venture" },
  { value: "nbfc",               label: "Financial Institutions / NBFC Registration" },
  { value: "insolvency",         label: "Insolvency / Financial Restructuring" },
  { value: "personal_planning",  label: "Personal Financial Planning" },
  { value: "business_valuation", label: "Business Valuation" },
];

// Purposes that require foreign currency columns
export const FOREIGN_PURPOSES: PurposeValue[] = [
  "travel_visa",
  "study_loan",
  "foreign_collab",
];

// ─── Countries ────────────────────────────────────────────────────────────────

export const COUNTRIES: string[] = [
  "USA ($)",
  "UK (£)",
  "Europe – Euro (€)",
  "Canada (CAD $)",
  "Australia (AUD $)",
  "UAE (AED)",
  "Singapore (SGD)",
  "Japan (¥)",
  "Other",
];

// ─── Salutations ──────────────────────────────────────────────────────────────

export const SALUTATIONS: SalutationType[] = ["Mr.", "Ms.", "Mrs."];

// ─── Annexure Checklists ──────────────────────────────────────────────────────

export const INCOME_TYPES: string[] = [
  "Salary / Employment Income",
  "Business / Professional Income",
  "Rental Income",
  "Interest Income",
  "Dividend Income",
  "Capital Gains (if realized during the year)",
  "Other Income",
];

// ─── Income Persons (Annexure I redesign) ─────────────────────────────────────
// Whose income is being declared — checkboxes drive one row per person.

export const INCOME_PERSONS: string[] = [
  "Self",
  "Mother",
  "Father",
  "Spouse",
];

// ─── Assessment Year Options ──────────────────────────────────────────────────

export const ASSESSMENT_YEAR_OPTIONS: { value: string; label: string }[] = (() => {
  const currentYear = new Date().getFullYear();
  const options: { value: string; label: string }[] = [];
  // Generate years from 5 years ago to 2 years ahead
  for (let y = currentYear - 5; y <= currentYear + 2; y++) {
    const label = `${y}-${String(y + 1).slice(-2)}`;
    options.push({ value: label, label });
  }
  return options.reverse(); // Most recent first
})();

// ─── Property Persons (Annexure II redesign) ──────────────────────────────────
// Whose property is being declared — same person list as income.

export const PROPERTY_PERSONS: string[] = [
  "Self",
  "Mother",
  "Father",
  "Spouse",
];

// ─── Property Type Options (Annexure II) ──────────────────────────────────────

export const PROPERTY_TYPE_OPTIONS: string[] = [
  "Residential Property",
  "Commercial Property",
  "Land",
  "Under-Construction Property",
  "Jointly Owned Property",
  "Other",
];

export const IMMOVABLE_TYPES: string[] = [
  "Residential Property",
  "Commercial Property",
  "Land",
  "Under-Construction Property",
  "Jointly Owned Property",
];

export const MOVABLE_TYPES: string[] = [
  "Gold & Jewellery",
  "Vehicles",
  "Household Assets",
  "Other Movable Assets",
];

// ─── Movable Persons (Annexure III redesign) ────────────────────────────────
// Whose movable assets are being declared — checkboxes drive per-person sections.

export const MOVABLE_PERSONS: string[] = [
  "Self",
  "Mother",
  "Father",
  "Spouse",
];

// ─── Movable Asset Type Options (Annexure III) ──────────────────────────────

export const MOVABLE_ASSET_OPTIONS: string[] = [
  "Gold & Jewellery",
  "Vehicles",
  "Household Assets",
  "Other Movable Assets",
];

export const SAVINGS_TYPES: string[] = [
  "Bank-Related Assets",
  "Investment Instruments",
  "Insurance",
  "Physical Assets",
  "Other Additions",
];

// ─── Savings Persons (Annexure IV redesign) ─────────────────────────────────
// Whose savings are being declared — checkboxes drive per-person sections.

export const SAVINGS_PERSONS: string[] = [
  "Self",
  "Mother",
  "Father",
  "Spouse",
];

// ─── Savings Category Options (Annexure IV) ─────────────────────────────────

export const SAVINGS_CATEGORY_OPTIONS: string[] = [
  "Bank-Related Assets",
  "Investment Instruments",
  "Insurance",
  "Physical Assets",
  "Other Additions",
];

// ─── Supporting Docs ──────────────────────────────────────────────────────────

export const SUPPORTING_DOCS: string[] = [
  "Income tax return copies of Applicant.",
  "Valuation/self-declaration documents of immovable properties.",
  "Bank statements",
  "Investment / Mutual Fund statements",
  "Insurance policy copies",
  "Vehicle RC copies",
];

// ─── Step Definitions ─────────────────────────────────────────────────────────

export const STEPS: StepDefinition[] = [
  { id: "purpose",   icon: "target",       label: "Purpose"      },
  { id: "applicant", icon: "user",         label: "Applicant"    },
  { id: "income",    icon: "indian-rupee",  label: "Annexure I"   },
  { id: "immovable", icon: "building",      label: "Annexure II"  },
  { id: "movable",   icon: "car",           label: "Annexure III" },
  { id: "savings",   icon: "landmark",      label: "Annexure IV"  },
  { id: "signatory", icon: "pen-tool",      label: "Signatory"    },
  { id: "preview",   icon: "file-text",     label: "Certificate"  },
];

// ─── CA Firm Details ──────────────────────────────────────────────────────────
// Empty defaults — the user must fill in their own firm details.

export const CA_FIRM = {
  name: "",
  type: "",
  frn: "",
  partnerName: "",
  partnerTitle: "",
  membershipNo: "",
  place: "",
} as const;

// ─── Gold Reference Prices ────────────────────────────────────────────────────
// Fallback IBJA gold prices per gram in INR (without GST/making charges).
// Used only when live scraping from ibjarates.com fails. Update periodically.

export const GOLD_REFERENCE_PRICES = {
  price24kPerGram: 14673,
  price22kPerGram: 13441,
  price18kPerGram: 11005,
  lastUpdated: "2026-03-30",
  source: "IBJA (India Bullion and Jewellers Association) — Approximate",
} as const;

// ─── Currency Mapping ─────────────────────────────────────────────────────────
// Maps each country dropdown value to its ISO currency code, symbol, and locale.

export interface CurrencyInfo {
  code: string;        // ISO 4217 currency code (e.g. "USD")
  symbol: string;      // Currency symbol (e.g. "$")
  label: string;       // Short display label (e.g. "USD $")
  locale: string;      // Locale for number formatting
  fallbackRate: number; // Approximate INR-per-unit fallback rate
}

export const COUNTRY_CURRENCY_MAP: Record<string, CurrencyInfo> = {
  "USA ($)":              { code: "USD", symbol: "$",   label: "USD $",   locale: "en-US", fallbackRate: 94.99 },
  "UK (£)":               { code: "GBP", symbol: "£",   label: "GBP £",   locale: "en-GB", fallbackRate: 125.85 },
  "Europe – Euro (€)":    { code: "EUR", symbol: "€",   label: "EUR €",   locale: "de-DE", fallbackRate: 109.21 },
  "Canada (CAD $)":       { code: "CAD", symbol: "C$",  label: "CAD $",   locale: "en-CA", fallbackRate: 68.37 },
  "Australia (AUD $)":    { code: "AUD", symbol: "A$",  label: "AUD $",   locale: "en-AU", fallbackRate: 65.14 },
  "UAE (AED)":            { code: "AED", symbol: "د.إ", label: "AED",     locale: "ar-AE", fallbackRate: 25.87 },
  "Singapore (SGD)":      { code: "SGD", symbol: "S$",  label: "SGD $",   locale: "en-SG", fallbackRate: 73.67 },
  "Japan (¥)":            { code: "JPY", symbol: "¥",   label: "JPY ¥",   locale: "ja-JP", fallbackRate: 0.5928 },
  "Other":                { code: "USD", symbol: "$",   label: "USD $",   locale: "en-US", fallbackRate: 94.99 },
};

/** Default currency info (USD) used when country is not set or unrecognized */
export const DEFAULT_CURRENCY: CurrencyInfo = COUNTRY_CURRENCY_MAP["USA ($)"]!;

// ─── Exchange Rate Fallback ───────────────────────────────────────────────────
// Used when the live exchange rate API is unavailable.
// Kept for backward compatibility — prefer CurrencyInfo.fallbackRate for multi-currency.

export const EXCHANGE_RATE_FALLBACK_USD_INR = 94.99;
