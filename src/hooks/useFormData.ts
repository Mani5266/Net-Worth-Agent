import { useState, useCallback } from "react";
import type { FormData, AnnexureRow, UploadedDoc } from "@/types";
import { uploadDocument } from "@/lib/db";

const INITIAL_INCOME_ROWS: AnnexureRow[] = [
  { label: "Income of the Applicant", inr: "" },
];

const INITIAL_IMMOVABLE_ROWS: AnnexureRow[] = [
  { label: "Address of the immovable property and its details.", inr: "" },
];

const INITIAL_MOVABLE_ROWS: AnnexureRow[] = [
  { label: "Gold ornaments weighing (gms) — In the Name of the Applicant", inr: "" },
  { label: "Any other Movable Property", inr: "" },
];

export const INITIAL_STATE: FormData = {
  // Step 1
  purpose: "",
  country: "",
  certDate: new Date().toISOString().split("T")[0],
  exchangeRate: "",
  // Step 2
  salutation: "Mr.",
  fullName: "",
  pan: "",
  udin: "",
  // Step 3
  incomeTypes: [],
  incomeLabels: {},
  incomeRows: INITIAL_INCOME_ROWS,
  incomeFR: [""],
  incomeDocs: {},
  immovableDocs: {},
  movableDocs: {},
  savingsDocs: {},
  // Step 4
  immovableTypes: [],
  immovableLabels: {},
  immovableRows: INITIAL_IMMOVABLE_ROWS,
  immovableFR: [""],
  propertyAddress: "",
  // Step 5
  movableTypes: [],
  movableLabels: {},
  movableRows: INITIAL_MOVABLE_ROWS,
  movableFR: ["", ""],
  goldGrams: "",
  // Step 6
  savingsTypes: [],
  savingsLabels: {},
  savingsRows: null,
  savingsFR: [],
  bankDetails: "",
  policies: [""],
  supportingDocs: [],
};

export function useFormData() {
  const [data, setData] = useState<FormData>(INITIAL_STATE);

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
          if (field === "savingsTypes") {
            return { ...prev, [field]: next, savingsRows: null };
          }
          return { ...prev, [field]: next };
        });
      },
    []
  );

  // Update a custom label for a checkbox type
  const updateLabel = useCallback(
    (field: "incomeLabels" | "immovableLabels" | "movableLabels" | "savingsLabels") =>
      (type: string, value: string) => {
        setData((prev) => ({
          ...prev,
          [field]: { ...(prev[field] as Record<string, string>), [type]: value },
          savingsRows: field === "savingsLabels" ? null : (prev.savingsRows),
        }));
      },
    []
  );

  // Update an AnnexureRow INR value
  const updateAnnexureRow = useCallback(
    (field: "incomeRows" | "immovableRows" | "movableRows") =>
      (index: number, value: string) => {
        setData((prev) => {
          const rows = [...prev[field]];
          rows[index] = { ...rows[index], inr: value };
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

  // Update savings row INR
  const updateSavingsRow = useCallback((index: number, value: string) => {
    setData((prev) => {
      const rows = [...(prev.savingsRows ?? [])];
      rows[index] = { ...rows[index], inr: value };
      return { ...prev, savingsRows: rows };
    });
  }, []);

  // Separate handler for savings foreign rows
  const updateSavingsFR = useCallback((index: number, value: string) => {
    setData((prev) => {
      const rows = [...prev.savingsFR];
      rows[index] = value;
      return { ...prev, savingsFR: rows };
    });
  }, []);

  // Reset savings rows (rebuilds from types)
  const resetSavingsRows = useCallback(() => {
    setData((prev) => ({ ...prev, savingsRows: null }));
  }, []);

  // Add insurance policy
  const addPolicy = useCallback(() => {
    setData((prev) => ({
      ...prev,
      policies: [...prev.policies, ""],
      savingsRows: null,
    }));
  }, []);

  // Update a policy
  const updatePolicy = useCallback((index: number, value: string) => {
    setData((prev) => {
      const policies = [...prev.policies];
      policies[index] = value;
      return { ...prev, policies, savingsRows: null };
    });
  }, []);

  // Remove a policy
  const removePolicy = useCallback((index: number) => {
    setData((prev) => ({
      ...prev,
      policies: prev.policies.filter((_, i) => i !== index),
      savingsRows: null,
    }));
  }, []);

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
            } catch (err) {
              console.error("Supabase upload failed:", err);
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
    updateSavingsRow,
    resetSavingsRows,
    updateSavingsFR,
    addPolicy,
    updatePolicy,
    removePolicy,
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
