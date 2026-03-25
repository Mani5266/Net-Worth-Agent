import { z } from "zod";
import {
  FormDataSchema,
  StepPurposeSchema,
  StepApplicantSchema,
  StepIncomeSchema,
  StepImmovableSchema,
  StepMovableSchema,
  StepSavingsSchema,
  PassportSchema,
  ISODateSchema,
} from "./schemas";
import type { FormData } from "./schemas";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationResult {
  success: boolean;
  /** Field-level errors keyed by field path (e.g. "purpose", "incomeRows") */
  errors: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractErrors(zodError: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of zodError.issues) {
    const path = issue.path.join(".") || "_root";
    // Keep the first error per field
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

function runSchema<T>(schema: z.ZodType<T>, data: unknown): ValidationResult {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, errors: {} };
  }
  return { success: false, errors: extractErrors(result.error) };
}

// ─── Step Validators ─────────────────────────────────────────────────────────

/**
 * Validates a single form step (0-indexed).
 *
 * Steps:
 *  0 = Purpose
 *  1 = Applicant
 *  2 = Annexure I (Income)
 *  3 = Annexure II (Immovable)
 *  4 = Annexure III (Movable)
 *  5 = Annexure IV (Savings)
 *  6 = Preview (no validation — always passes)
 */
export function validateFormStep(step: number, data: FormData): ValidationResult {
  switch (step) {
    case 0:
      return runSchema(StepPurposeSchema, {
        purpose: data.purpose,
        certDate: data.certDate,
        country: data.country,
        exchangeRate: data.exchangeRate,
      });

    case 1:
      return runSchema(StepApplicantSchema, {
        salutation: data.salutation,
        fullName: data.fullName,
        passportNumber: data.passportNumber,
      });

    case 2:
      return runSchema(StepIncomeSchema, {
        incomeRows: data.incomeRows,
      });

    case 3:
      return runSchema(StepImmovableSchema, {
        immovableRows: data.immovableRows,
      });

    case 4:
      return runSchema(StepMovableSchema, {
        movableRows: data.movableRows,
      });

    case 5:
      return runSchema(StepSavingsSchema, {
        savingsRows: data.savingsRows ?? [],
      });

    case 6:
      // Preview step — no validation
      return { success: true, errors: {} };

    default:
      return { success: false, errors: { _root: `Unknown step: ${step}` } };
  }
}

/**
 * Validates the entire form for final submission / certificate generation.
 * This is stricter than per-step validation — requires valid Passport Number, date, etc.
 */
export function validateFullForm(data: FormData): ValidationResult {
  const errors: Record<string, string> = {};

  // 1. Structural validation — does the data match the expected shape?
  const structuralResult = FormDataSchema.safeParse(data);
  if (!structuralResult.success) {
    Object.assign(errors, extractErrors(structuralResult.error));
  }

  // 2. Purpose must be selected
  if (!data.purpose) {
    errors["purpose"] = "Purpose is required";
  }

  // 3. Certificate date must be a valid ISO date
  const dateResult = ISODateSchema.safeParse(data.certDate);
  if (!dateResult.success) {
    errors["certDate"] = "Certificate date is required";
  }

  // 4. Applicant details
  if (data.fullName.trim().length < 2) {
    errors["fullName"] = "Full name must be at least 2 characters";
  }

  const passportResult = PassportSchema.safeParse(data.passportNumber);
  if (!passportResult.success) {
    errors["passportNumber"] = passportResult.error.issues[0]?.message ?? "Invalid Passport Number";
  }

  // 5. At least one annexure should have data
  const hasIncome = data.incomeRows.some((r) => r.inr.trim().length > 0);
  const hasImmovable = data.immovableRows.some((r) => r.inr.trim().length > 0);
  const hasMovable = data.movableRows.some((r) => r.inr.trim().length > 0);
  const hasSavings = (data.savingsRows ?? []).some((r) => r.inr.trim().length > 0)
    || data.savingsTypes.length > 0;

  if (!hasIncome && !hasImmovable && !hasMovable && !hasSavings) {
    errors["_annexures"] = "At least one annexure must have financial data";
  }

  // 6. Country required for foreign purposes
  const foreignPurposes = ["travel_visa", "study_loan", "foreign_collab"];
  if (foreignPurposes.includes(data.purpose) && !data.country.trim()) {
    errors["country"] = "Country is required for this purpose";
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Returns human-readable validation errors for display in the UI.
 * Filters out empty/internal error keys.
 */
export function getValidationMessages(result: ValidationResult): string[] {
  return Object.values(result.errors).filter(Boolean);
}
