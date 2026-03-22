// ─── Enums & Union Types ──────────────────────────────────────────────────────

export type PurposeValue =
  | "bank_finance"
  | "study_loan"
  | "travel_visa"
  | "disputes"
  | "tender"
  | "franchise"
  | "foreign_collab"
  | "nbfc"
  | "insolvency"
  | "personal_planning"
  | "business_valuation";

export type SalutationType = "Mr." | "Ms." | "Mrs.";

// ─── Annexure Row ─────────────────────────────────────────────────────────────

export interface AnnexureRow {
  label: string;
  inr: string;
}

// ─── Uploaded Document ────────────────────────────────────────────────────────

export interface UploadedDoc {
  name: string;
  size: number;
  dataUrl: string;
}

// ─── Form Data ────────────────────────────────────────────────────────────────

export interface FormData {
  // Step 1 – Purpose
  purpose: PurposeValue | "";
  country: string;
  certDate: string;
  exchangeRate: string; // manual ₹/USD rate on certDate
  nickname?: string;

  // Step 2 – Applicant
  salutation: SalutationType;
  fullName: string;
  pan: string;
  udin: string;

  // Step 3 – Annexure I: Current Income
  incomeTypes: string[];
  incomeLabels: Record<string, string>;
  incomeRows: AnnexureRow[];
  incomeFR: string[];
  incomeDocs: Record<string, UploadedDoc[]>;

  // Step 4 – Annexure II: Immovable Assets
  immovableTypes: string[];
  immovableLabels: Record<string, string>;
  immovableRows: AnnexureRow[];
  immovableFR: string[];
  immovableDocs: Record<string, UploadedDoc[]>;
  propertyAddress: string;

  // Step 5 – Annexure III: Movable Properties
  movableTypes: string[];
  movableLabels: Record<string, string>;
  movableRows: AnnexureRow[];
  movableFR: string[];
  movableDocs: Record<string, UploadedDoc[]>;
  goldGrams: string;

  // Step 6 – Annexure IV: Current Savings
  savingsTypes: string[];
  savingsLabels: Record<string, string>;
  savingsRows: AnnexureRow[] | null;
  savingsFR: string[];
  savingsDocs: Record<string, UploadedDoc[]>;
  bankDetails: string;
  policies: string[];
  supportingDocs: string[];
}

// ─── Step Definition ──────────────────────────────────────────────────────────

export interface StepDefinition {
  id: string;
  icon: string;
  label: string;
}

// ─── Certificate Summary ──────────────────────────────────────────────────────

export interface CertificateTotals {
  incomeINR: number;
  immovableINR: number;
  movableINR: number;
  savingsINR: number;
  grandINR: number;
  incomeForeign: number;
  immovableForeign: number;
  movableForeign: number;
  savingsForeign: number;
  grandForeign: number;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface GenerateCertificateRequest {
  formData: FormData;
}

export interface GenerateCertificateResponse {
  success: boolean;
  text?: string;
  error?: string;
}

// ─── Supabase Records ─────────────────────────────────────────────────────────

export interface CertificateRecord {
  id: string;
  clientName: string;
  nickname?: string;
  purpose: string;
  certDate: string;
  status: "draft" | "completed";
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  certificateId: string;
  annexureType: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
}
