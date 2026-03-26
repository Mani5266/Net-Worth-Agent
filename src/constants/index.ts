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
  "Household Assets (if required)",
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
  "Household Assets (if required)",
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

export const CA_FIRM = {
  name: "B A S T & ASSOCIATES",
  type: "Chartered Accountants",
  frn: "021029S",
  partnerName: "ABHISHEK BODDU",
  partnerTitle: "Partner",
  membershipNo: "242868",
  place: "Hyderabad",
} as const;

// ─── Gold Reference Prices ────────────────────────────────────────────────────
// Approximate Indian gold prices per gram (IBJA rates). Update periodically.

export const GOLD_REFERENCE_PRICES = {
  price24kPerGram: 7800,
  price22kPerGram: 7150,
  price18kPerGram: 5850,
  lastUpdated: "2025-03-15",
  source: "India Bullion and Jewellers Association (IBJA) - Approximate",
} as const;

// ─── Exchange Rate Fallback ───────────────────────────────────────────────────
// Used when the live exchange rate API is unavailable.

export const EXCHANGE_RATE_FALLBACK_USD_INR = 83.5;
