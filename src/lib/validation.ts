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
 *  6 = Signatory Details (optional — passes if empty)
 *  7 = Preview (no validation — always passes)
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
      // Signatory step — optional fields, always passes
      // (CA firm details have defaults from constants)
      return { success: true, errors: {} };

    case 7:
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

  // 6. Country is always required
  if (!data.country.trim()) {
    errors["country"] = "Country is required for generating the net worth certificate";
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates that all declared assets/entries have amounts filled.
 * Returns a list of human-readable warnings for items missing amounts.
 * Used to gate Copy/Print actions on the Certificate step.
 */
export function validateAmountsForCertificate(data: FormData): string[] {
  const warnings: string[] = [];

  // Check income rows
  if (data.incomeTypes.length > 0) {
    data.incomeTypes.forEach((person, i) => {
      const inr = data.incomeRows[i]?.inr?.trim();
      if (!inr) {
        const name = data.incomeLabels[person]?.trim() || person;
        warnings.push(`Annexure I: Income amount missing for ${name}`);
      }
    });
  }

  // Check immovable properties (new model)
  const hasNewImmovable = Object.keys(data.immovableProperties ?? {}).length > 0;
  if (hasNewImmovable) {
    let flatIdx = 0;
    for (const person of data.immovableTypes) {
      const props = data.immovableProperties[person] ?? [];
      const personName = data.immovableLabels[person]?.trim() || person;
      for (let j = 0; j < props.length; j++) {
        const inr = data.immovableRows[flatIdx]?.inr?.trim();
        if (!inr) {
          const propType = props[j]?.propertyType || `Property ${j + 1}`;
          warnings.push(`Annexure II: Amount missing for ${personName} \u2014 ${propType}`);
        }
        flatIdx++;
      }
    }
  } else if (data.immovableRows.length > 0) {
    data.immovableRows.forEach((row, i) => {
      if (!row.inr?.trim()) {
        warnings.push(`Annexure II: Amount missing for row ${i + 1}`);
      }
    });
  }

  // Check movable assets (new model)
  const hasNewMovable = Object.keys(data.movableAssets ?? {}).length > 0;
  if (hasNewMovable) {
    let flatIdx = 0;
    for (const person of data.movableTypes) {
      const assets = data.movableAssets[person] ?? [];
      const personName = data.movableLabels[person]?.trim() || person;
      for (let j = 0; j < assets.length; j++) {
        const inr = data.movableRows[flatIdx]?.inr?.trim();
        if (!inr) {
          const assetType = assets[j]?.assetType || `Asset ${j + 1}`;
          warnings.push(`Annexure III: Amount missing for ${personName} \u2014 ${assetType}`);
        }
        flatIdx++;
      }
    }
  } else if (data.movableRows.length > 0) {
    data.movableRows.forEach((row, i) => {
      if (!row.inr?.trim()) {
        warnings.push(`Annexure III: Amount missing for row ${i + 1}`);
      }
    });
  }

  // Check savings entries (new model)
  const hasNewSavings = Object.keys(data.savingsEntries ?? {}).length > 0;
  if (hasNewSavings) {
    let flatIdx = 0;
    for (const person of data.savingsTypes) {
      const entries = data.savingsEntries[person] ?? [];
      const personName = data.savingsLabels[person]?.trim() || person;
      for (let j = 0; j < entries.length; j++) {
        const inr = (data.savingsRows ?? [])[flatIdx]?.inr?.trim();
        if (!inr) {
          const cat = entries[j]?.category || `Entry ${j + 1}`;
          warnings.push(`Annexure IV: Amount missing for ${personName} \u2014 ${cat}`);
        }
        flatIdx++;
      }
    }
  } else if ((data.savingsRows ?? []).length > 0) {
    (data.savingsRows ?? []).forEach((row, i) => {
      if (!row.inr?.trim()) {
        warnings.push(`Annexure IV: Amount missing for row ${i + 1}`);
      }
    });
  }

  return warnings;
}

/**
 * Returns human-readable validation errors for display in the UI.
 * Filters out empty/internal error keys.
 */
export function getValidationMessages(result: ValidationResult): string[] {
  return Object.values(result.errors).filter(Boolean);
}
