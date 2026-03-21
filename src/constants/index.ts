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

export const SAVINGS_TYPES: string[] = [
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
  { id: "purpose",   icon: "🎯", label: "Purpose"      },
  { id: "applicant", icon: "👤", label: "Applicant"    },
  { id: "income",    icon: "💰", label: "Annexure I"   },
  { id: "immovable", icon: "🏠", label: "Annexure II"  },
  { id: "movable",   icon: "🚗", label: "Annexure III" },
  { id: "savings",   icon: "🏦", label: "Annexure IV"  },
  { id: "preview",   icon: "📄", label: "Certificate"  },
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
