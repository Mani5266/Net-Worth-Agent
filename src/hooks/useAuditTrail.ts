"use client";

import { useCallback, useRef, useState } from "react";
import type { AuditEntry, FormData } from "@/types";

// ─── Field Labels ────────────────────────────────────────────────────────────
// Maps field paths to human-readable labels for the audit log.

const FIELD_LABELS: Record<string, string> = {
  purpose: "Purpose",
  country: "Country",
  certDate: "Certificate Date",
  exchangeRate: "Exchange Rate",
  nickname: "Nickname",
  salutation: "Salutation",
  fullName: "Full Name",
  passportNumber: "Passport Number",
  udin: "UDIN",
  incomeTypes: "Income Persons",
  immovableTypes: "Property Persons",
  movableTypes: "Asset Persons",
  savingsTypes: "Savings Persons",
  supportingDocs: "Supporting Documents",
  goldGrams: "Gold Weight (grams)",
  propertyAddress: "Property Address",
  bankDetails: "Bank Details",
  policies: "Insurance Policies",
};

function getFieldLabel(field: string): string {
  // Direct match
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];

  // Pattern matches for nested paths
  if (field.startsWith("incomeRows")) return "Income Amount";
  if (field.startsWith("immovableRows")) return "Immovable Asset Amount";
  if (field.startsWith("movableRows")) return "Movable Asset Amount";
  if (field.startsWith("savingsRows")) return "Savings Amount";
  if (field.startsWith("incomeFR")) return "Income (Foreign)";
  if (field.startsWith("immovableFR")) return "Immovable (Foreign)";
  if (field.startsWith("movableFR")) return "Movable (Foreign)";
  if (field.startsWith("savingsFR")) return "Savings (Foreign)";
  if (field.includes("Labels")) return "Custom Label";
  if (field.includes("Docs")) return "Document Upload";

  return field;
}

// ─── Value Serialization ─────────────────────────────────────────────────────

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty)";
    // For AnnexureRow arrays, show a summary
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null && "label" in value[0]) {
      return `${value.length} row(s)`;
    }
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value).slice(0, 100);
  }
  return String(value);
}

// ─── Diff Detection ──────────────────────────────────────────────────────────

/** Keys that are tracked for audit purposes (excludes volatile/computed fields) */
const TRACKED_KEYS: (keyof FormData)[] = [
  "purpose", "country", "certDate", "exchangeRate", "nickname",
  "salutation", "fullName", "passportNumber", "udin",
  "incomeTypes", "immovableTypes", "movableTypes", "savingsTypes",
  "goldGrams", "propertyAddress", "bankDetails",
  "supportingDocs",
];

/** Keys for amount arrays — tracked at the row level */
const AMOUNT_KEYS: (keyof FormData)[] = [
  "incomeRows", "immovableRows", "movableRows", "savingsRows",
  "incomeFR", "immovableFR", "movableFR", "savingsFR",
];

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Maximum audit entries to keep in memory (prevents unbounded growth) */
const MAX_AUDIT_ENTRIES = 500;

export function useAuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const prevDataRef = useRef<FormData | null>(null);

  /**
   * Records changes between previous and current form data.
   * Call this after each meaningful state update.
   */
  const recordChanges = useCallback((currentData: FormData, currentStep: number) => {
    const prev = prevDataRef.current;
    prevDataRef.current = currentData;

    // Skip the very first call (no previous state to compare)
    if (!prev) return;

    const newEntries: AuditEntry[] = [];
    const now = new Date().toISOString();

    // Check simple fields
    for (const key of TRACKED_KEYS) {
      const oldVal = prev[key];
      const newVal = currentData[key];
      const oldStr = serializeValue(oldVal);
      const newStr = serializeValue(newVal);

      if (oldStr !== newStr) {
        newEntries.push({
          timestamp: now,
          field: key,
          fieldLabel: getFieldLabel(key),
          oldValue: oldStr,
          newValue: newStr,
          step: currentStep,
        });
      }
    }

    // Check amount fields (row-level changes)
    for (const key of AMOUNT_KEYS) {
      const oldArr = prev[key] as unknown[] | null;
      const newArr = currentData[key] as unknown[] | null;

      if (oldArr === null && newArr === null) continue;
      if (oldArr === null || newArr === null) {
        // Transition from null to array or vice versa
        newEntries.push({
          timestamp: now,
          field: key,
          fieldLabel: getFieldLabel(key),
          oldValue: oldArr === null ? "(auto)" : serializeValue(oldArr),
          newValue: newArr === null ? "(auto)" : serializeValue(newArr),
          step: currentStep,
        });
        continue;
      }

      const maxLen = Math.max(oldArr.length, newArr.length);
      for (let i = 0; i < maxLen; i++) {
        const oldItem = oldArr[i];
        const newItem = newArr[i];

        // For AnnexureRow objects, compare the `inr` field specifically
        if (
          oldItem && typeof oldItem === "object" && "inr" in oldItem &&
          newItem && typeof newItem === "object" && "inr" in newItem
        ) {
          const oldInr = (oldItem as { inr: string }).inr;
          const newInr = (newItem as { inr: string }).inr;
          if (oldInr !== newInr) {
            const label = "label" in newItem ? (newItem as unknown as { label: string }).label : `Row ${i + 1}`;
            newEntries.push({
              timestamp: now,
              field: `${key}.${i}.inr`,
              fieldLabel: `${getFieldLabel(key)} — ${label.slice(0, 40)}`,
              oldValue: oldInr || "(empty)",
              newValue: newInr || "(empty)",
              step: currentStep,
            });
          }
        } else {
          // For string arrays (FR values)
          const oldStr = serializeValue(oldItem);
          const newStr = serializeValue(newItem);
          if (oldStr !== newStr) {
            newEntries.push({
              timestamp: now,
              field: `${key}.${i}`,
              fieldLabel: `${getFieldLabel(key)} — Row ${i + 1}`,
              oldValue: oldStr || "(empty)",
              newValue: newStr || "(empty)",
              step: currentStep,
            });
          }
        }
      }
    }

    if (newEntries.length > 0) {
      setEntries((prev) => {
        const combined = [...prev, ...newEntries];
        // Trim to max entries (keep the most recent)
        return combined.length > MAX_AUDIT_ENTRIES
          ? combined.slice(-MAX_AUDIT_ENTRIES)
          : combined;
      });
    }
  }, []);

  /** Clears the audit trail (e.g. when starting a new certificate) */
  const clearAudit = useCallback(() => {
    setEntries([]);
    prevDataRef.current = null;
  }, []);

  /** Sets the initial baseline (call when loading a draft) */
  const setBaseline = useCallback((data: FormData) => {
    prevDataRef.current = data;
  }, []);

  return {
    auditEntries: entries,
    recordChanges,
    clearAudit,
    setBaseline,
  };
}
