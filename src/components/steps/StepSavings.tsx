"use client";

import { useEffect, useRef } from "react";
import { Section, Checkbox, Select, Input } from "@/components/ui";
import { FileUpload } from "@/components/ui/FileUpload";
import { SAVINGS_PERSONS, SAVINGS_CATEGORY_OPTIONS, ACCOUNT_NATURE_OPTIONS, SUPPORTING_DOCS } from "@/constants";
import { useFormContext } from "@/hooks/useFormContext";
import { fmtForeignAmount } from "@/lib/utils";
import { Plus, Trash2, Landmark, Pin, PlusCircle, X } from "lucide-react";
import type { SavingsEntry } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build auto-generated description for Bank-Related Assets */
function buildBankDescription(
  accountNature: string,
  personName: string,
  bankName: string,
  branch: string,
): string {
  const nature = accountNature || "___";
  const name = personName.trim() || "[Applicant]";
  const bank = bankName.trim() || "[Bank Name]";
  const br = branch.trim() || "[Branch]";
  return `Balance in the \u201C${nature}\u201D bank account name of Applicant \u2014 ${name}, held with the bank \u201C${bank}\u201D having its branch at \u201C${br}\u201D`;
}

/** Build the "Particulars" label for each savings row in the amounts table */
function savingsRowLabel(
  person: string,
  entry: SavingsEntry,
  personName: string,
  applicantName: string,
): string {
  const desc = entry.description.trim();
  const prefix = desc || "Savings Item";

  if (person === "Self") {
    const name = personName.trim() || applicantName || "[Applicant]";
    return `${prefix} in the name of Applicant \u2014 ${name}`;
  }
  const name = personName.trim() || `[${person}\u2019s name]`;
  return `${prefix} in the name of Applicant\u2019s ${person} \u2014 ${name}`;
}

/** Resolve display label for a savings category */
function displayCategory(entry: SavingsEntry): string {
  if (entry.category === "Other Additions" && entry.customCategory.trim()) {
    return entry.customCategory.trim();
  }
  return entry.category || "Savings Item";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StepSavingsProps {
  certificateId: string | null;
}

export function StepSavings({ certificateId }: StepSavingsProps) {
  const {
    data,
    isForeign,
    foreignRate,
    liveExchangeRate,
    exchangeRateLoading,
    currencyInfo,
    toggleArrayItem,
    updateField,
    updateLabel,
    addSavingsDocs,
    removeSavingsDoc,
  } = useFormContext();

  const selectedPersons = data.savingsTypes; // repurposed: person IDs
  const prevPersonsRef = useRef<string[]>(selectedPersons);
  const prevLabelsRef = useRef<string>(JSON.stringify(data.savingsLabels));

  // ── Auto-fill "Self" label with applicant's fullName when "Self" is selected ──
  useEffect(() => {
    if (
      selectedPersons.includes("Self") &&
      !data.savingsLabels["Self"] &&
      data.fullName
    ) {
      updateLabel("savingsLabels")("Self", data.fullName);
    }
  }, [selectedPersons, data.fullName, data.savingsLabels, updateLabel]);

  // ── Clean up when persons are unchecked ─────────────────────────────────
  useEffect(() => {
    const prev = prevPersonsRef.current;
    prevPersonsRef.current = selectedPersons;

    if (
      prev.length === selectedPersons.length &&
      prev.every((p, i) => p === selectedPersons[i])
    ) {
      return;
    }

    // Remove entries for unchecked persons
    const removed = prev.filter((p) => !selectedPersons.includes(p));
    if (removed.length > 0) {
      const updatedEntries = { ...data.savingsEntries };
      const updatedDocs = { ...data.savingsDocs };
      for (const person of removed) {
        delete updatedEntries[person];
        // Remove all doc keys for this person
        for (const key of Object.keys(updatedDocs)) {
          if (key.startsWith(`${person}:`)) {
            delete updatedDocs[key];
          }
        }
      }
      updateField("savingsEntries", updatedEntries);
      updateField("savingsDocs", updatedDocs);
    }

    // Rebuild flat rows from current entries
    rebuildRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersons]);

  // ── Rebuild row labels when person names change (cross-annexure sync) ───
  useEffect(() => {
    const serialized = JSON.stringify(data.savingsLabels);
    if (serialized !== prevLabelsRef.current) {
      prevLabelsRef.current = serialized;
      rebuildRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.savingsLabels]);

  // ── Auto-tick supporting docs when a person is added ────────────────────
  const handleTogglePerson = (person: string) => {
    toggleArrayItem("savingsTypes")(person);
  };

  // ── Rebuild savingsRows + savingsFR from structured entries ─────────────
  const rebuildRows = () => {
    const rows: { label: string; inr: string }[] = [];
    const frArr: string[] = [];

    let flatIdx = 0;
    for (const person of selectedPersons) {
      const entries = data.savingsEntries[person] ?? [];
      const personName = data.savingsLabels[person] ?? "";
      for (const entry of entries) {
        const label = savingsRowLabel(person, entry, personName, data.fullName);
        const existingRow = (data.savingsRows ?? [])[flatIdx];
        rows.push({ label, inr: existingRow?.inr ?? "" });
        frArr.push(data.savingsFR[flatIdx] ?? "");
        flatIdx++;
      }
    }

    updateField("savingsRows", rows);
    updateField("savingsFR", frArr);
  };

  // ── Entry CRUD operations ───────────────────────────────────────────────

  const addEntry = (person: string) => {
    const current = data.savingsEntries[person] ?? [];
    const newEntry: SavingsEntry = {
      category: "", customCategory: "", description: "",
      bankName: "", accountNature: "", bankBranch: "",
    };
    const updated = {
      ...data.savingsEntries,
      [person]: [newEntry, ...current],
    };
    updateField("savingsEntries", updated);

    // Insert a blank row at the correct flat offset so existing amounts stay aligned
    let insertAt = 0;
    for (const p of selectedPersons) {
      if (p === person) break;
      insertAt += (data.savingsEntries[p] ?? []).length;
    }
    const newRows = [...(data.savingsRows ?? [])];
    newRows.splice(insertAt, 0, { label: "", inr: "" });
    updateField("savingsRows", newRows);

    const newFR = [...data.savingsFR];
    newFR.splice(insertAt, 0, "");
    updateField("savingsFR", newFR);

    // Re-key docs: shift all indices for this person up by 1
    const updatedDocs = { ...data.savingsDocs };
    for (let j = current.length; j >= 0; j--) {
      const oldKey = `${person}:${j}`;
      const newKey = `${person}:${j + 1}`;
      if (updatedDocs[oldKey]) {
        updatedDocs[newKey] = updatedDocs[oldKey];
        delete updatedDocs[oldKey];
      }
    }
    updateField("savingsDocs", updatedDocs);

    // Rebuild labels
    rebuildRowsFromEntries(updated);
  };

  const removeEntry = (person: string, entryIndex: number) => {
    const current = [...(data.savingsEntries[person] ?? [])];
    current.splice(entryIndex, 1);
    const updated = { ...data.savingsEntries, [person]: current };

    // Remove corresponding doc key
    const docKey = `${person}:${entryIndex}`;
    const updatedDocs = { ...data.savingsDocs };
    delete updatedDocs[docKey];
    // Re-key docs above the removed index
    for (let j = entryIndex + 1; j <= (data.savingsEntries[person]?.length ?? 0); j++) {
      const oldKey = `${person}:${j}`;
      const newKey = `${person}:${j - 1}`;
      if (updatedDocs[oldKey]) {
        updatedDocs[newKey] = updatedDocs[oldKey];
        delete updatedDocs[oldKey];
      }
    }

    updateField("savingsEntries", updated);
    updateField("savingsDocs", updatedDocs);

    // Rebuild flat rows
    rebuildRowsFromEntries(updated);
  };

  const updateEntry = (person: string, entryIndex: number, field: keyof SavingsEntry, value: string) => {
    const current = [...(data.savingsEntries[person] ?? [])];
    const entry = current[entryIndex];
    if (!entry) return;
    const updatedEntry = { ...entry, [field]: value };

    // Auto-populate description for Bank-Related Assets when a bank field changes
    if (
      updatedEntry.category === "Bank-Related Assets" &&
      (field === "bankName" || field === "accountNature" || field === "bankBranch")
    ) {
      const personName = data.savingsLabels[person] ?? data.fullName ?? "";
      updatedEntry.description = buildBankDescription(
        updatedEntry.accountNature ?? "",
        personName,
        updatedEntry.bankName ?? "",
        updatedEntry.bankBranch ?? "",
      );
    }

    current[entryIndex] = updatedEntry;
    const updated = { ...data.savingsEntries, [person]: current };
    updateField("savingsEntries", updated);

    // Rebuild labels in flat rows (preserve amounts)
    rebuildRowsFromEntries(updated);
  };

  /** Rebuild rows from a given entries map (used after mutations) */
  const rebuildRowsFromEntries = (entriesMap: Record<string, SavingsEntry[]>) => {
    const rows: { label: string; inr: string }[] = [];
    const frArr: string[] = [];
    let flatIdx = 0;

    for (const person of selectedPersons) {
      const entries = entriesMap[person] ?? [];
      const personName = data.savingsLabels[person] ?? "";
      for (const entry of entries) {
        const label = savingsRowLabel(person, entry, personName, data.fullName);
        const existingRow = (data.savingsRows ?? [])[flatIdx];
        rows.push({ label, inr: existingRow?.inr ?? "" });
        frArr.push(data.savingsFR[flatIdx] ?? "");
        flatIdx++;
      }
    }

    updateField("savingsRows", rows);
    updateField("savingsFR", frArr);
  };

  // ── Row amount updaters ─────────────────────────────────────────────────

  const updateRowInr = (index: number, value: string) => {
    const rows = [...(data.savingsRows ?? [])];
    const existing = rows[index];
    if (existing) {
      rows[index] = { ...existing, inr: value };
      updateField("savingsRows", rows);
    }
  };

  const updateRowFR = (index: number, value: string) => {
    const fr = [...data.savingsFR];
    fr[index] = value;
    updateField("savingsFR", fr);
  };

  const showForeign = isForeign && foreignRate != null && foreignRate > 0;

  // ── Flatten all entries for the amounts table ───────────────────────────
  const allEntries: { person: string; entryIndex: number; entry: SavingsEntry }[] = [];
  for (const person of selectedPersons) {
    const entries = data.savingsEntries[person] ?? [];
    entries.forEach((entry, i) => {
      allEntries.push({ person, entryIndex: i, entry });
    });
  }

  // ── Flat-index offset per person (maps person → starting index in savingsRows) ──
  const personFlatOffset: Record<string, number> = {};
  let _offset = 0;
  for (const p of selectedPersons) {
    personFlatOffset[p] = _offset;
    _offset += (data.savingsEntries[p] ?? []).length;
  }

  return (
    <Section title="Annexure IV -- Current Savings">
      <div className="flex flex-col gap-5">

        {/* Step 1: Whose savings are you declaring? */}
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
            Whose savings are you declaring? <span className="text-red-500">*</span>
          </p>
          <p className="text-[10px] text-slate-400 -mt-2 mb-2 italic">Specify value in Rupees</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SAVINGS_PERSONS.map((person) => (
              <Checkbox
                key={person}
                label={person}
                checked={selectedPersons.includes(person)}
                onToggle={() => handleTogglePerson(person)}
              />
            ))}
          </div>
        </div>

        {/* Step 2: Per-person savings sections */}
        {selectedPersons.map((person) => {
          const entries = data.savingsEntries[person] ?? [];
          const personName = data.savingsLabels[person] ?? "";

          return (
            <div key={person} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Person header */}
              <div className="bg-sky-50 border-b border-sky-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-sky-700" />
                  <span className="font-bold text-sm text-sky-800">
                    {person === "Self" ? "Self\u2019s" : `${person}\u2019s`} Savings
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addEntry(person)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                    text-sky-700 bg-white border border-sky-300 rounded-lg
                    hover:bg-sky-50 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Entry
                </button>
              </div>

              {/* Person name input */}
              <div className="px-4 pt-3 pb-2">
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => {
                    updateLabel("savingsLabels")(person, e.target.value);
                  }}
                  placeholder={
                    person === "Self"
                      ? data.fullName || "Enter applicant name"
                      : `Enter ${person.toLowerCase()}\u2019s full name`
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full max-w-md
                    focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600
                    transition-colors bg-white placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Name as it appears on savings documents ({person})
                </p>
              </div>

              {/* Savings entries */}
              {entries.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  No entries added yet. Click &ldquo;+ Add Entry&rdquo; to begin.
                </div>
              )}

              {entries.map((entry, eIdx) => {
                const docKey = `${person}:${eIdx}`;
                return (
                  <div
                    key={eIdx}
                    className="border-t border-slate-100 px-4 py-3"
                    style={{ background: eIdx % 2 === 0 ? "#fff" : "#f8fafc" }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Entry {eIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEntry(person, eIdx)}
                        className="p-1 text-red-400 hover:text-red-600 rounded transition-colors
                          focus:outline-none focus:ring-2 focus:ring-red-400/20"
                        aria-label={`Remove entry ${eIdx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                      {/* Category dropdown */}
                      <div className="flex flex-col gap-1">
                        <Select
                          label="Category"
                          placeholder="Select category..."
                          options={SAVINGS_CATEGORY_OPTIONS}
                          value={entry.category}
                          onChange={(e) => updateEntry(person, eIdx, "category", e.target.value)}
                        />
                      </div>

                      {/* Valuation amount — right of Category */}
                      {(() => {
                        const flatIdx = (personFlatOffset[person] ?? 0) + eIdx;
                        const inrVal = (data.savingsRows ?? [])[flatIdx]?.inr ?? "";
                        const foreignLabel = showForeign && foreignRate
                          ? fmtForeignAmount(inrVal, foreignRate, currencyInfo)
                          : "";
                        return (
                          <div className="flex flex-col gap-1">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              Amount (INR) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={inrVal}
                              onChange={(e) => updateRowInr(flatIdx, e.target.value)}
                              placeholder="Enter amount in Rs."
                              aria-label={`INR amount for entry ${eIdx + 1} of ${person}`}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                                focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600
                                transition-colors bg-white placeholder:text-slate-400"
                            />
                            {showForeign && foreignLabel && (
                              <span className="text-[10px] text-sky-700 font-medium mt-0.5 block pl-0.5">
                                ≈ {foreignLabel}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Custom category (only for "Other Additions") */}
                    {entry.category === "Other Additions" && (
                      <div className="mb-2 max-w-[calc(50%-0.375rem)]">
                        <Input
                          label="Custom Category"
                          placeholder="e.g. Chit Funds, Loans Given"
                          value={entry.customCategory}
                          onChange={(e) => updateEntry(person, eIdx, "customCategory", e.target.value)}
                        />
                      </div>
                    )}

                    {/* Bank-Related Assets: structured fields */}
                    {entry.category === "Bank-Related Assets" && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                          <div className="flex flex-col gap-1">
                            <Input
                              label="Name of the Bank"
                              placeholder="e.g. State Bank of India"
                              value={entry.bankName ?? ""}
                              onChange={(e) => updateEntry(person, eIdx, "bankName", e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Select
                              label="Nature of the Account"
                              placeholder="Select account type..."
                              options={ACCOUNT_NATURE_OPTIONS}
                              value={entry.accountNature ?? ""}
                              onChange={(e) => updateEntry(person, eIdx, "accountNature", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="mb-2 max-w-[calc(50%-0.375rem)]">
                          <Input
                            label="Branch"
                            placeholder="e.g. Madhapur, Hyderabad"
                            value={entry.bankBranch ?? ""}
                            onChange={(e) => updateEntry(person, eIdx, "bankBranch", e.target.value)}
                          />
                        </div>
                        {/* Auto-generated description (editable) */}
                        <div className="mb-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                            Description <span className="text-[10px] font-normal text-slate-400">(auto-generated, editable)</span>
                          </label>
                          <input
                            type="text"
                            value={entry.description}
                            onChange={(e) => updateEntry(person, eIdx, "description", e.target.value)}
                            placeholder="Will auto-populate from bank details above"
                            className="px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-xs w-full
                              focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600
                              transition-colors placeholder:text-slate-400"
                          />
                        </div>
                      </>
                    )}

                    {/* Non-bank categories: generic description input */}
                    {entry.category !== "Bank-Related Assets" && (
                      <div className="mb-2">
                        <Input
                          label="Description"
                          placeholder={
                            entry.category === "Insurance"
                              ? "e.g. LIC Policy No. 12345678"
                              : entry.category === "Investment Instruments"
                              ? "e.g. Mutual Funds, PPF, NPS"
                              : "e.g. Details of the savings item"
                          }
                          value={entry.description}
                          onChange={(e) => updateEntry(person, eIdx, "description", e.target.value)}
                        />
                      </div>
                    )}

                    {/* Document upload */}
                    <FileUpload
                      label={`${displayCategory(entry)} \u2013 ${person}`}
                      docs={data.savingsDocs[docKey] ?? []}
                      onAdd={(files) => addSavingsDocs(docKey, files, certificateId ?? undefined)}
                      onRemove={(i) => removeSavingsDoc(docKey, i)}
                      hint={
                        entry.category === "Bank-Related Assets" ? "Bank statement — PDF or JPG" :
                        entry.category === "Insurance" ? "Policy copy — PDF or JPG" :
                        entry.category === "Investment Instruments" ? "Fund statement — PDF or JPG" :
                        "Supporting document — PDF or JPG"
                      }
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Step 3: Consolidated amounts table */}
        {allEntries.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Savings Amounts <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-400 mb-3">
              One row per entry added above
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Table header */}
              <div
                className="grid bg-sky-800 px-4 py-2.5"
                style={{
                  gridTemplateColumns: isForeign
                    ? "2.5fr 1.5fr 1.5fr"
                    : "3fr 2fr",
                }}
              >
                <div className="text-white font-bold text-xs">Particulars</div>
                <div className="text-white font-bold text-xs">Indian (Rs.)</div>
                {isForeign && (
                  <div className="text-white font-bold text-xs">
                    {data.country || "Foreign"}
                  </div>
                )}
              </div>

              {/* Table rows */}
              {allEntries.map(({ person, entry }, flatIdx) => {
                const inrVal = (data.savingsRows ?? [])[flatIdx]?.inr ?? "";
                const foreignLabel = showForeign && foreignRate ? fmtForeignAmount(inrVal, foreignRate, currencyInfo) : "";
                const personName = data.savingsLabels[person] ?? "";
                const catName = displayCategory(entry);
                const desc = entry.description.trim();
                const prefix = desc || catName;

                return (
                  <div
                    key={flatIdx}
                    className="grid border-t border-slate-100 px-4 py-3 gap-2"
                    style={{
                      gridTemplateColumns: isForeign
                        ? "2.5fr 1.5fr 1.5fr"
                        : "3fr 2fr",
                      background: flatIdx % 2 === 0 ? "#fff" : "#f8fafc",
                    }}
                  >
                    {/* Particulars cell */}
                    <div className="flex flex-col gap-0.5 pr-3 self-center">
                      <span className="text-sm text-slate-700 leading-tight">
                        {person === "Self"
                          ? `${prefix} in the name of Applicant \u2014 ${personName.trim() || data.fullName || "Self"}`
                          : `${prefix} in the name of Applicant\u2019s ${person} \u2014 ${personName.trim() || `[${person}\u2019s name]`}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {catName} &middot; {person}
                      </span>
                    </div>

                    {/* INR input */}
                    <div className="flex flex-col gap-0.5 self-center">
                      <input
                        type="text"
                        value={inrVal}
                        onChange={(e) => updateRowInr(flatIdx, e.target.value)}
                        placeholder="Enter amount"
                        aria-label={`INR amount for savings entry ${flatIdx + 1}`}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                          focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600
                          transition-colors"
                      />
                      {showForeign && foreignLabel && (
                        <span className="text-[10px] text-sky-700 font-medium pl-1">
                          {foreignLabel}
                        </span>
                      )}
                    </div>

                    {/* Foreign column */}
                    {isForeign && (
                      <div className="flex flex-col gap-0.5 self-center">
                        {showForeign ? (
                          <div
                            className="px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50
                              text-xs w-full text-sky-800 font-semibold"
                          >
                            {foreignLabel || <span className="text-slate-400">Auto</span>}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={data.savingsFR[flatIdx] ?? ""}
                            onChange={(e) => updateRowFR(flatIdx, e.target.value)}
                            placeholder="Amount"
                            aria-label={`${currencyInfo.code} amount for savings entry ${flatIdx + 1}`}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                              focus:outline-none focus:ring-2 focus:ring-sky-600/20 focus:border-sky-600
                              transition-colors"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Rate badge */}
              {showForeign && (
                <div className="px-4 py-2 bg-sky-50 border-t border-sky-100 flex items-center gap-1.5">
                  <Pin className="w-3 h-3 text-sky-600 shrink-0" />
                  <span className="text-[10px] text-sky-700">
                    Rate used: <strong>1 {currencyInfo.code} = Rs.{foreignRate?.toFixed(2)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exchange rate override */}
        {isForeign && (
          <div className="mt-1">
            <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-[11px] text-orange-700 font-medium mb-1">
                {exchangeRateLoading
                  ? "Fetching live exchange rate..."
                  : liveExchangeRate
                    ? `Live rate: 1 ${currencyInfo.code} = Rs.${liveExchangeRate.toLocaleString("en-IN")} INR`
                    : `Could not fetch live rate. Fallback: 1 ${currencyInfo.code} = Rs.${currencyInfo.fallbackRate} INR`}
              </p>
              <p className="text-[10px] text-orange-600 mb-1.5">
                If the live rate is incorrect, enter the exchange rate manually below. This will override the auto-fetched rate.
              </p>
              <input
                type="number"
                value={data.exchangeRate}
                onChange={(e) => updateField("exchangeRate", e.target.value)}
                placeholder={`Leave empty to use ${liveExchangeRate ? "live" : "fallback"} rate (${liveExchangeRate ?? currencyInfo.fallbackRate})`}
                className="px-2.5 py-1.5 rounded-lg border border-orange-300 text-xs w-full max-w-xs
                  focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                  transition-colors bg-white placeholder:text-slate-400"
              />
              {data.exchangeRate && (
                <p className="text-[10px] text-orange-800 font-semibold mt-1">
                  Using manual override: 1 {currencyInfo.code} = Rs.{data.exchangeRate} INR
                </p>
              )}
            </div>
          </div>
        )}

        {/* Supporting Documents Attached */}
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
            Supporting Documents Attached
          </p>
          {SUPPORTING_DOCS.map((doc) => (
            <Checkbox
              key={doc}
              label={doc}
              checked={data.supportingDocs.includes(doc)}
              onToggle={() => toggleArrayItem("supportingDocs")(doc)}
            />
          ))}

          {/* Other — dynamic list */}
          {(() => {
            const otherDocs = data.otherSupportingDocs ?? [];
            return (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={otherDocs.length > 0}
                      onChange={() => {
                        if (otherDocs.length > 0) {
                          updateField("otherSupportingDocs", []);
                        } else {
                          updateField("otherSupportingDocs", [""]);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-navy-800
                        focus:ring-2 focus:ring-navy-900/10 focus:ring-offset-0
                        accent-navy-800 cursor-pointer"
                    />
                    <span>Other</span>
                  </label>
                </div>

                {otherDocs.length > 0 && (
                  <div className="ml-6 mt-1 space-y-2">
                    {otherDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={doc}
                          onChange={(e) => {
                            const updated = [...otherDocs];
                            updated[idx] = e.target.value;
                            updateField("otherSupportingDocs", updated);
                          }}
                          placeholder={`Other document ${idx + 1}`}
                          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm
                            focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = otherDocs.filter((_, i) => i !== idx);
                            updateField("otherSupportingDocs", updated.length > 0 ? updated : []);
                          }}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                          title="Remove"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        updateField("otherSupportingDocs", [...otherDocs, ""]);
                      }}
                      className="flex items-center gap-1 text-xs text-navy-700 hover:text-navy-900 font-medium transition-colors"
                    >
                      <PlusCircle size={14} />
                      Add another
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </Section>
  );
}
