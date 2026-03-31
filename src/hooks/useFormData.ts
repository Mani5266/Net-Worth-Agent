import { useState, useCallback, useEffect, useRef } from "react";
import type { FormData, AnnexureRow, UploadedDoc } from "@/types";
import { uploadDocument } from "@/lib/db";

const FORM_STORAGE_KEY = "networth_form_data";

const INITIAL_INCOME_ROWS: AnnexureRow[] = [];

const INITIAL_IMMOVABLE_ROWS: AnnexureRow[] = [];

const INITIAL_MOVABLE_ROWS: AnnexureRow[] = [];

export const INITIAL_STATE: FormData = {
  // Step 1
  purpose: "",
  country: "",
  certDate: new Date().toISOString().split("T")[0] ?? "",
  exchangeRate: "",
  // Step 2
  salutation: "Mr.",
  fullName: "",
  passportNumber: "",
  udin: "",
  // Step 3
  assessmentYear: "",
  incomeTypes: [],
  incomeLabels: {},
  incomeRows: INITIAL_INCOME_ROWS,
  incomeFR: [],
  incomeDocs: {},
  immovableDocs: {},
  movableDocs: {},
  savingsDocs: {},
  // Step 4
  immovableTypes: [],
  immovableLabels: {},
  immovableProperties: {},
  immovableRows: INITIAL_IMMOVABLE_ROWS,
  immovableFR: [],
  propertyAddress: "",
  // Step 5
  movableTypes: [],
  movableLabels: {},
  movableAssets: {},
  movableRows: INITIAL_MOVABLE_ROWS,
  movableFR: [],
  goldGrams: "",
  goldKarat: "22K",
  goldPriceOverride: "",
  // Step 6
  savingsTypes: [],
  savingsLabels: {},
  savingsEntries: {},
  savingsRows: null,
  savingsFR: [],
  bankDetails: "",
  policies: [""],
  supportingDocs: [],
  otherSupportingDocs: [],
  // Step 7 — Signatory Details
  firmName: "",
  firmType: "",
  firmFRN: "",
  signatoryName: "",
  signatoryTitle: "",
  membershipNo: "",
  signPlace: "",
};

// ─── Per-step field keys for "Reset This Step" ──────────────────────────────

/** Fields that belong to each wizard step (by step index) */
export const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
  0: ["purpose", "country", "certDate", "exchangeRate"],
  1: ["salutation", "fullName", "passportNumber", "udin"],
  2: ["assessmentYear", "incomeTypes", "incomeLabels", "incomeRows", "incomeFR", "incomeDocs"],
  3: ["immovableTypes", "immovableLabels", "immovableProperties", "immovableRows", "immovableFR", "immovableDocs", "propertyAddress"],
  4: ["movableTypes", "movableLabels", "movableAssets", "movableRows", "movableFR", "movableDocs", "goldGrams", "goldKarat", "goldPriceOverride"],
  5: ["savingsTypes", "savingsLabels", "savingsEntries", "savingsRows", "savingsFR", "savingsDocs", "bankDetails", "policies", "supportingDocs", "otherSupportingDocs"],
  6: ["firmName", "firmType", "firmFRN", "signatoryName", "signatoryTitle", "membershipNo", "signPlace"],
};

/** Build a partial FormData containing only the initial/default values for a given step */
export function getStepDefaults(stepIndex: number): Partial<FormData> {
  const fields = STEP_FIELDS[stepIndex];
  if (!fields) return {};
  const defaults: Partial<FormData> = {};
  for (const key of fields) {
    (defaults as Record<string, unknown>)[key] = INITIAL_STATE[key];
  }
  return defaults;
}

// ─── localStorage helpers ───────────────────────────────────────────────────

function loadFormFromStorage(): FormData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic sanity check — must have at least the purpose field key
    if (typeof parsed === "object" && parsed !== null && "purpose" in parsed) {
      return { ...INITIAL_STATE, ...parsed } as FormData;
    }
  } catch {
    // Corrupted data — ignore
  }
  return null;
}

function saveFormToStorage(data: FormData): void {
  try {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function useFormData() {
  const [data, setData] = useState<FormData>(INITIAL_STATE);

  // Track whether this is the initial mount
  const isFirstRender = useRef(true);

  // Restore from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const saved = loadFormFromStorage();
    if (saved) {
      setData(saved);
    }
    // Mark first render done after restore (so subsequent changes get saved)
    isFirstRender.current = false;
  }, []);

  // Auto-save form data to localStorage whenever it changes
  useEffect(() => {
    if (isFirstRender.current) return;
    saveFormToStorage(data);
  }, [data]);

  // Reset only the fields belonging to a specific step
  const resetStep = useCallback((stepIndex: number) => {
    const defaults = getStepDefaults(stepIndex);
    setData((prev) => ({ ...prev, ...defaults }));
  }, []);

  // Generic field update
  const updateField = useCallback(<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Toggle a string item in an array field
  const toggleArrayItem = useCallback(
    (field: "incomeTypes" | "immovableTypes" | "movableTypes" | "savingsTypes" | "supportingDocs") =>
      (item: string) => {
        setData((prev) => {
          const arr = prev[field] as string[];
          const next = arr.includes(item)
            ? arr.filter((x) => x !== item)
            : [...arr, item];
          return { ...prev, [field]: next };
        });
      },
    []
  );

  // Update a custom label for a checkbox type — syncs name across all 4 annexure label maps
  const ALL_LABEL_FIELDS = ["incomeLabels", "immovableLabels", "movableLabels", "savingsLabels"] as const;

  const updateLabel = useCallback(
    (_field: "incomeLabels" | "immovableLabels" | "movableLabels" | "savingsLabels") =>
      (type: string, value: string) => {
        setData((prev) => {
          const next = { ...prev };
          for (const lf of ALL_LABEL_FIELDS) {
            next[lf] = { ...(prev[lf] as Record<string, string>), [type]: value };
          }
          return next;
        });
      },
    []
  );

  // Update an AnnexureRow INR value
  const updateAnnexureRow = useCallback(
    (field: "incomeRows" | "immovableRows" | "movableRows") =>
      (index: number, value: string) => {
        setData((prev) => {
          const rows = [...prev[field]];
          const existing = rows[index];
          if (existing) {
            rows[index] = { ...existing, inr: value };
          }
          return { ...prev, [field]: rows };
        });
      },
    []
  );

  // Update an AnnexureRow foreign currency value
  const updateForeignRow = useCallback(
    (field: "incomeFR" | "immovableFR" | "movableFR" | "savingsFR") =>
      (index: number, value: string) => {
        setData((prev) => {
          const rows = [...prev[field]];
          rows[index] = value;
          return { ...prev, [field]: rows };
        });
      },
    []
  );

  // Generic document handlers to avoid extreme repetition
  const addDocs = useCallback((field: "incomeDocs" | "immovableDocs" | "movableDocs" | "savingsDocs") => 
    (type: string, files: File[], certificateId?: string) => {
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          let supabaseUrl = "";

          // If we have a certificateId, upload to Supabase Storage
          if (certificateId) {
            try {
              const annexureType = field.replace("Docs", "");
              supabaseUrl = await uploadDocument(certificateId, annexureType, type, file);
            } catch {
              // Upload failed — doc will still be saved locally via dataUrl
            }
          }

          const doc: UploadedDoc = { 
            name: file.name, 
            size: file.size, 
            dataUrl 
          };

          setData((prev) => {
            const existing = (prev[field] as Record<string, UploadedDoc[]>)[type] ?? [];
            return {
              ...prev,
              [field]: {
                ...(prev[field] as Record<string, UploadedDoc[]>),
                [type]: [...existing, doc],
              },
            };
          });
        };
        reader.readAsDataURL(file);
      });
    }, []);

  const removeDoc = useCallback((field: "incomeDocs" | "immovableDocs" | "movableDocs" | "savingsDocs") => 
    (type: string, index: number) => {
      setData((prev) => {
        const existing = [...((prev[field] as Record<string, UploadedDoc[]>)[type] ?? [])];
        existing.splice(index, 1);
        return {
          ...prev,
          [field]: { ...(prev[field] as Record<string, UploadedDoc[]>), [type]: existing },
        };
      });
    }, []);

  const addIncomeDocs = addDocs("incomeDocs");
  const removeIncomeDoc = removeDoc("incomeDocs");

  const addImmovableDocs = addDocs("immovableDocs");
  const removeImmovableDoc = removeDoc("immovableDocs");

  const addMovableDocs = addDocs("movableDocs");
  const removeMovableDoc = removeDoc("movableDocs");

  const addSavingsDocs = addDocs("savingsDocs");
  const removeSavingsDoc = removeDoc("savingsDocs");

  return {
    data,
    setData,
    updateField,
    toggleArrayItem,
    updateLabel,
    updateAnnexureRow,
    updateForeignRow,
    resetStep,
    addIncomeDocs,
    removeIncomeDoc,
    addImmovableDocs,
    removeImmovableDoc,
    addMovableDocs,
    removeMovableDoc,
    addSavingsDocs,
    removeSavingsDoc,
  };
}
