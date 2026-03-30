import { z } from "zod";

// ─── Primitive Patterns ──────────────────────────────────────────────────────

/** Indian Passport: 1 uppercase letter + 7 digits (e.g. J1234567) */
const PASSPORT_REGEX = /^[A-Z][0-9]{7}$/;

/** UDIN: 14-digit numeric string issued by ICAI */
const UDIN_REGEX = /^[0-9]{14}$/;

/** ISO date string (YYYY-MM-DD) */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── Enums & Unions ──────────────────────────────────────────────────────────

export const PurposeValueSchema = z.enum([
  "bank_finance",
  "study_loan",
  "travel_visa",
  "disputes",
  "tender",
  "franchise",
  "foreign_collab",
  "nbfc",
  "insolvency",
  "personal_planning",
  "business_valuation",
]);

export const SalutationSchema = z.enum(["Mr.", "Ms.", "Mrs."]);

// ─── Small Schemas ───────────────────────────────────────────────────────────

export const AnnexureRowSchema = z.object({
  label: z.string().min(1, "Row label is required"),
  inr: z.string(), // May be empty (unfilled row)
});

export const UploadedDocSchema = z.object({
  name: z.string().min(1),
  size: z.number().nonnegative(),
  dataUrl: z.string().min(1),
});

// ─── Passport Validation ─────────────────────────────────────────────────────

export const PassportSchema = z
  .string()
  .toUpperCase()
  .regex(PASSPORT_REGEX, "Passport must be 1 letter + 7 digits (e.g. J1234567)");

/** Loose Passport — accepts empty string (for draft state) or valid Passport */
export const PassportLooseSchema = z
  .string()
  .refine(
    (val) => val === "" || PASSPORT_REGEX.test(val.toUpperCase()),
    "Passport must be 1 letter + 7 digits (e.g. J1234567)"
  );

// ─── UDIN Validation ─────────────────────────────────────────────────────────

export const UDINSchema = z
  .string()
  .regex(UDIN_REGEX, "UDIN must be exactly 14 digits");

/** Loose UDIN — accepts empty string (for draft state) or valid UDIN */
export const UDINLooseSchema = z
  .string()
  .refine(
    (val) => val === "" || UDIN_REGEX.test(val),
    "UDIN must be exactly 14 digits"
  );

// ─── Assessment Year ─────────────────────────────────────────────────────────

export const AssessmentYearSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Assessment year must be in YYYY-YY format (e.g. 2025-26)");

// ─── ISO Date ────────────────────────────────────────────────────────────────

export const ISODateSchema = z
  .string()
  .regex(ISO_DATE_REGEX, "Date must be in YYYY-MM-DD format");

/** Loose date — accepts empty string or valid ISO date */
export const ISODateLooseSchema = z
  .string()
  .refine(
    (val) => val === "" || ISO_DATE_REGEX.test(val),
    "Date must be in YYYY-MM-DD format"
  );

// ─── INR Amount String ───────────────────────────────────────────────────────

/** Accepts empty string, plain digits, or comma-separated Indian format */
export const INRAmountStringSchema = z
  .string()
  .refine(
    (val) => val === "" || /^[\d,]+(\.\d{1,2})?$/.test(val),
    "Amount must be a valid number (commas allowed)"
  );

// ─── Exchange Rate ───────────────────────────────────────────────────────────

export const ExchangeRateSchema = z
  .string()
  .refine(
    (val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) > 0),
    "Exchange rate must be a positive number"
  );

// ─── Docs Map ────────────────────────────────────────────────────────────────

/** Record<string, UploadedDoc[]> — documents keyed by category type */
const DocsMapSchema = z.record(z.string(), z.array(UploadedDocSchema));

// ─── Immovable Property Entry ────────────────────────────────────────────────

export const ImmovablePropertySchema = z.object({
  propertyType: z.string().min(1, "Property type is required"),
  customType: z.string(),        // Only used when propertyType === "Other"
  address: z.string(),           // Full property address
});

/** Record<string, ImmovableProperty[]> — properties keyed by person */
const ImmovablePropertiesMapSchema = z.record(z.string(), z.array(ImmovablePropertySchema));

// ─── Movable Asset Entry (Annexure III redesign) ─────────────────────────────

export const MovableAssetSchema = z.object({
  assetType: z.string().min(1, "Asset type is required"),
  customType: z.string(),        // Only used when assetType === "Other Movable Assets"
  description: z.string(),       // Description of the asset
});

/** Record<string, MovableAsset[]> — assets keyed by person */
const MovableAssetsMapSchema = z.record(z.string(), z.array(MovableAssetSchema));

// ─── Savings Entry (Annexure IV redesign) ────────────────────────────────────

export const SavingsEntrySchema = z.object({
  category: z.string().min(1, "Category is required"),
  customCategory: z.string(),    // Only used when category === "Other Additions"
  description: z.string(),       // Description of the savings item
});

/** Record<string, SavingsEntry[]> — entries keyed by person */
const SavingsEntriesMapSchema = z.record(z.string(), z.array(SavingsEntrySchema));

// ─── Full Form Data Schema ───────────────────────────────────────────────────

export const FormDataSchema = z.object({
  // Step 1 – Purpose
  purpose: z.union([PurposeValueSchema, z.literal("")]),
  country: z.string(),
  certDate: z.string(), // YYYY-MM-DD or empty
  exchangeRate: z.string(),
  nickname: z.string().optional(),

  // Step 2 – Applicant
  salutation: SalutationSchema,
  fullName: z.string(),
  passportNumber: z.string(), // Loose in draft; strict validation at submission via validateFullForm
  udin: z.string(),

  // Step 3 – Annexure I: Current Income
  assessmentYear: z.string(),
  incomeTypes: z.array(z.string()),
  incomeLabels: z.record(z.string(), z.string()),
  incomeRows: z.array(AnnexureRowSchema),
  incomeFR: z.array(z.string()),
  incomeDocs: DocsMapSchema,

  // Step 4 – Annexure II: Immovable Assets
  immovableTypes: z.array(z.string()),       // Selected persons (["Self", "Father"])
  immovableLabels: z.record(z.string(), z.string()), // Person names
  immovableProperties: ImmovablePropertiesMapSchema, // Structured property entries per person
  immovableRows: z.array(AnnexureRowSchema), // Flattened rows for the amounts table
  immovableFR: z.array(z.string()),
  immovableDocs: DocsMapSchema,
  propertyAddress: z.string(),               // Kept for backward compat with old drafts

  // Step 5 – Annexure III: Movable Properties
  movableTypes: z.array(z.string()),
  movableLabels: z.record(z.string(), z.string()),
  movableAssets: MovableAssetsMapSchema,             // Structured asset entries per person (new model)
  movableRows: z.array(AnnexureRowSchema),
  movableFR: z.array(z.string()),
  movableDocs: DocsMapSchema,
  goldGrams: z.string(),
  goldKarat: z.enum(["22K", "24K"]).default("22K"),

  // Step 6 – Annexure IV: Current Savings
  savingsTypes: z.array(z.string()),
  savingsLabels: z.record(z.string(), z.string()),
  savingsEntries: SavingsEntriesMapSchema,           // Structured savings entries per person (new model)
  savingsRows: z.array(AnnexureRowSchema).nullable(),
  savingsFR: z.array(z.string()),
  savingsDocs: DocsMapSchema,
  bankDetails: z.string(),
  policies: z.array(z.string()),
  supportingDocs: z.array(z.string()),
  otherSupportingDocs: z.array(z.string()).default([]),

  // Step 7 – Signatory Details (CA Firm / Partner)
  firmName: z.string(),
  firmType: z.string(),
  firmFRN: z.string(),
  signatoryName: z.string(),
  signatoryTitle: z.string(),
  membershipNo: z.string(),
  signPlace: z.string(),
});

// ─── Per-Step Validation Schemas (strict, for step-level gating) ─────────────

export const StepPurposeSchema = z.object({
  purpose: PurposeValueSchema,
  certDate: ISODateSchema,
  country: z.string(), // Required only for foreign purposes — refined below
  exchangeRate: z.string(),
}).refine(
  (data) => {
    const foreignPurposes: string[] = ["travel_visa", "study_loan", "foreign_collab"];
    if (foreignPurposes.includes(data.purpose)) {
      return data.country.trim().length > 0;
    }
    return true;
  },
  { message: "Country is required for travel/study/foreign collaboration purposes", path: ["country"] }
);

export const StepApplicantSchema = z.object({
  salutation: SalutationSchema,
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  passportNumber: PassportSchema,
});

/** Income step — optional, no minimum rows required */
export const StepIncomeSchema = z.object({
  incomeRows: z.array(AnnexureRowSchema),
});

/** Immovable assets step — optional, no minimum rows required */
export const StepImmovableSchema = z.object({
  immovableRows: z.array(AnnexureRowSchema),
});

/** Movable properties step — optional, no minimum rows required */
export const StepMovableSchema = z.object({
  movableRows: z.array(AnnexureRowSchema),
});

/** Savings step — optional, no minimum rows required */
export const StepSavingsSchema = z.object({
  savingsRows: z.array(AnnexureRowSchema),
});

// ─── Certificate Summary ─────────────────────────────────────────────────────

export const CertificateTotalsSchema = z.object({
  incomeINR: z.number(),
  immovableINR: z.number(),
  movableINR: z.number(),
  savingsINR: z.number(),
  grandINR: z.number(),
  incomeForeign: z.number(),
  immovableForeign: z.number(),
  movableForeign: z.number(),
  savingsForeign: z.number(),
  grandForeign: z.number(),
});

// ─── Supabase Records ────────────────────────────────────────────────────────

export const CertificateRecordSchema = z.object({
  id: z.string().uuid(),
  clientName: z.string(),
  nickname: z.string().optional(),
  purpose: z.string(),
  certDate: z.string(),
  status: z.enum(["draft", "completed"]),
  createdAt: z.string(),
});

export const DocumentRecordSchema = z.object({
  id: z.string().uuid(),
  certificateId: z.string().uuid(),
  annexureType: z.string(),
  category: z.string(),
  fileUrl: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  uploadedAt: z.string(),
});

// ─── API Request/Response Schemas ────────────────────────────────────────────

export const OCRRequestSchema = z.object({
  image: z.string().min(1, "Image is required"),
  documentType: z.enum(["passport", "aadhaar"]),
});

export const OCRPassportResponseSchema = z.object({
  success: z.literal(true),
  fullName: z.string(),
  passportNumber: z.string(),
  modelUsed: z.string(),
});

export const OCRAadhaarResponseSchema = z.object({
  success: z.literal(true),
  name: z.string(),
  aadhaarLast4: z.string(),
  address: z.string(),
  dob: z.string(),
  modelUsed: z.string(),
});

export const ExchangeRateResponseSchema = z.object({
  rate: z.number().positive(),
  cached: z.boolean().optional(),
  stale: z.boolean().optional(),
  fallback: z.boolean().optional(),
});

export const APIErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export const GoldValuationRequestSchema = z.object({
  grams: z.number().positive("grams must be a positive number").max(100000, "grams exceeds maximum allowed"),
  declaredValue: z.number().positive().nullable().optional(),
});

// ─── Discriminated Union: FormStatus ─────────────────────────────────────────

export const FormStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("idle") }),
  z.object({ status: z.literal("loading"), message: z.string().optional() }),
  z.object({ status: z.literal("success"), message: z.string().optional() }),
  z.object({ status: z.literal("error"), error: z.string() }),
]);

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export const AuditEntrySchema = z.object({
  /** ISO timestamp of the change */
  timestamp: z.string(),
  /** Which form field changed (e.g. "purpose", "incomeRows.0.inr") */
  field: z.string(),
  /** Human-readable label for the field */
  fieldLabel: z.string(),
  /** Previous value (serialized as string for display) */
  oldValue: z.string(),
  /** New value (serialized as string for display) */
  newValue: z.string(),
  /** Which wizard step this change was made on (0-7) */
  step: z.number().int().min(0).max(7),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────
// These replace the hand-written interfaces in src/types/index.ts.
// Existing code can import from either location during migration.

export type PurposeValue = z.infer<typeof PurposeValueSchema>;
export type SalutationType = z.infer<typeof SalutationSchema>;
export type AnnexureRow = z.infer<typeof AnnexureRowSchema>;
export type UploadedDoc = z.infer<typeof UploadedDocSchema>;
export type ImmovableProperty = z.infer<typeof ImmovablePropertySchema>;
export type MovableAsset = z.infer<typeof MovableAssetSchema>;
export type SavingsEntry = z.infer<typeof SavingsEntrySchema>;
export type FormData = z.infer<typeof FormDataSchema>;
export type CertificateTotals = z.infer<typeof CertificateTotalsSchema>;
export type CertificateRecord = z.infer<typeof CertificateRecordSchema>;
export type DocumentRecord = z.infer<typeof DocumentRecordSchema>;
export type FormStatus = z.infer<typeof FormStatusSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
