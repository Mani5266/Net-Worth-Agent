"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { FormData, UploadedDoc, AuditEntry } from "@/types";
import { useFormData as useFormDataHook } from "./useFormData";
import { useExchangeRate } from "./useExchangeRate";
import { useAuditTrail } from "./useAuditTrail";
import { isForeignPurpose } from "@/lib/utils";

// ─── Context Shape ───────────────────────────────────────────────────────────

export interface FormDataContextValue {
  // Core data
  data: FormData;
  setData: React.Dispatch<React.SetStateAction<FormData>>;

  // Field updaters
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  toggleArrayItem: (
    field: "incomeTypes" | "immovableTypes" | "movableTypes" | "savingsTypes" | "supportingDocs"
  ) => (item: string) => void;
  updateLabel: (
    field: "incomeLabels" | "immovableLabels" | "movableLabels" | "savingsLabels"
  ) => (type: string, value: string) => void;
  updateAnnexureRow: (
    field: "incomeRows" | "immovableRows" | "movableRows"
  ) => (index: number, value: string) => void;
  updateForeignRow: (
    field: "incomeFR" | "immovableFR" | "movableFR" | "savingsFR"
  ) => (index: number, value: string) => void;

  // Document handlers
  addIncomeDocs: (type: string, files: File[], certificateId?: string) => void;
  removeIncomeDoc: (type: string, index: number) => void;
  addImmovableDocs: (type: string, files: File[], certificateId?: string) => void;
  removeImmovableDoc: (type: string, index: number) => void;
  addMovableDocs: (type: string, files: File[], certificateId?: string) => void;
  removeMovableDoc: (type: string, index: number) => void;
  addSavingsDocs: (type: string, files: File[], certificateId?: string) => void;
  removeSavingsDoc: (type: string, index: number) => void;

  // Derived state
  isForeign: boolean;
  usdRate: number | null;

  // Audit trail
  auditEntries: AuditEntry[];
  clearAudit: () => void;
}

const FormDataContext = createContext<FormDataContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface FormDataProviderProps {
  children: React.ReactNode;
}

export function FormDataProvider({ children }: FormDataProviderProps) {
  const form = useFormDataHook();
  const { usdRate: liveRate } = useExchangeRate();
  const { auditEntries, recordChanges, clearAudit, setBaseline } = useAuditTrail();

  const isForeign = isForeignPurpose(form.data.purpose);
  const overrideRate = form.data.exchangeRate ? parseFloat(form.data.exchangeRate) : null;
  const usdRate = overrideRate && overrideRate > 0 ? overrideRate : liveRate;

  // Track the current wizard step for audit context
  // The step is not directly accessible here, so we use a ref
  // that gets updated via the data changes (step is implicit from field changes)
  const stepRef = useRef(0);

  // Detect which step we're on based on the most recently changed fields
  // This is a heuristic — it's updated from the data itself
  useEffect(() => {
    // Record audit changes whenever form data changes
    recordChanges(form.data, stepRef.current);
  }, [form.data, recordChanges]);

  // Set baseline when data is loaded from DB (e.g. draft restore)
  const originalSetData = form.setData;
  const wrappedSetData: React.Dispatch<React.SetStateAction<FormData>> = useMemo(
    () => (action) => {
      originalSetData((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        // If this looks like a full data replacement (e.g. draft load),
        // reset the audit baseline so we don't log the restore as changes
        const isFullReplace =
          prev.purpose !== next.purpose &&
          prev.fullName !== next.fullName &&
          prev.passportNumber !== next.passportNumber;
        if (isFullReplace) {
          setBaseline(next);
        }
        return next;
      });
    },
    [originalSetData, setBaseline]
  );

  const value = useMemo<FormDataContextValue>(
    () => ({
      ...form,
      setData: wrappedSetData,
      isForeign,
      usdRate,
      auditEntries,
      clearAudit,
    }),
    [form, wrappedSetData, isForeign, usdRate, auditEntries, clearAudit]
  );

  return (
    <FormDataContext.Provider value={value}>
      {children}
    </FormDataContext.Provider>
  );
}

// ─── Consumer Hook ───────────────────────────────────────────────────────────

export function useFormContext(): FormDataContextValue {
  const ctx = useContext(FormDataContext);
  if (!ctx) {
    throw new Error("useFormContext must be used within a <FormDataProvider>");
  }
  return ctx;
}
