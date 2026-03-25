"use client";

import { useEffect, useRef } from "react";
import { Section, Checkbox, Input } from "@/components/ui";
import { FileUpload } from "@/components/ui/FileUpload";
import { INCOME_PERSONS } from "@/constants";
import { deriveAssessmentYear } from "@/lib/utils";
import { useFormContext } from "@/hooks/useFormContext";
import { Pin } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function personRowLabel(person: string): string {
  if (person === "Self") return "Income of the Applicant";
  return `Income of the Applicant's ${person}`;
}

function parseNum(val: string): number {
  return parseFloat(val.replace(/,/g, "")) || 0;
}

function fmtUSD(inr: string, rate: number): string {
  const n = parseNum(inr);
  if (!n || !rate) return "";
  const usd = n / rate;
  return `\u2248 $${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StepIncomeProps {
  certificateId: string | null;
}

export function StepIncome({ certificateId }: StepIncomeProps) {
  const {
    data,
    isForeign,
    usdRate,
    toggleArrayItem,
    updateField,
    updateLabel,
    addIncomeDocs,
    removeIncomeDoc,
  } = useFormContext();

  const assessmentYear = deriveAssessmentYear(data.certDate);
  const selectedPersons = data.incomeTypes; // repurposed: person IDs
  const prevPersonsRef = useRef<string[]>(selectedPersons);

  // ── Sync incomeRows / incomeFR when persons change ──────────────────────
  useEffect(() => {
    const prev = prevPersonsRef.current;
    prevPersonsRef.current = selectedPersons;

    // Skip if no actual change (reference equality handled by React, but check values)
    if (
      prev.length === selectedPersons.length &&
      prev.every((p, i) => p === selectedPersons[i])
    ) {
      return;
    }

    // Build new rows preserving existing data for persons that are still selected
    const newRows = selectedPersons.map((person) => {
      const existingIdx = prev.indexOf(person);
      if (existingIdx >= 0) {
        // Preserve existing row data
        return data.incomeRows[existingIdx] ?? { label: personRowLabel(person), inr: "" };
      }
      return { label: personRowLabel(person), inr: "" };
    });

    const newFR = selectedPersons.map((person) => {
      const existingIdx = prev.indexOf(person);
      if (existingIdx >= 0) {
        return data.incomeFR[existingIdx] ?? "";
      }
      return "";
    });

    updateField("incomeRows", newRows);
    updateField("incomeFR", newFR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersons]);

  // ── Row-level updaters ──────────────────────────────────────────────────
  const updateRowInr = (index: number, value: string) => {
    const rows = [...data.incomeRows];
    const existing = rows[index];
    if (existing) {
      rows[index] = { ...existing, inr: value };
      updateField("incomeRows", rows);
    }
  };

  const updateRowFR = (index: number, value: string) => {
    const fr = [...data.incomeFR];
    fr[index] = value;
    updateField("incomeFR", fr);
  };

  const showUSD = isForeign && usdRate != null && usdRate > 0;

  return (
    <Section title="Annexure I -- Current Income">
      <div className="flex flex-col gap-5">

        {/* Step 1: Who are you declaring income for? */}
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
            Whose income are you declaring? <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {INCOME_PERSONS.map((person) => (
              <Checkbox
                key={person}
                label={person}
                checked={selectedPersons.includes(person)}
                onToggle={() => toggleArrayItem("incomeTypes")(person)}
              />
            ))}
          </div>
        </div>

        {/* Step 2: Dynamic table — one row per selected person */}
        {selectedPersons.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Income Amounts <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-400 mb-3">Assessment Year: {assessmentYear}</p>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Table header */}
              <div
                className="grid bg-emerald-800 px-4 py-2.5"
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
                    {data.country || "Foreign"} (USD $)
                  </div>
                )}
              </div>

              {/* Table rows */}
              {selectedPersons.map((person, i) => {
                const inrVal = data.incomeRows[i]?.inr ?? "";
                const usdLabel = showUSD && usdRate ? fmtUSD(inrVal, usdRate) : "";
                const personName = data.incomeLabels[person] ?? "";

                return (
                  <div key={person} className="border-t border-slate-100">
                    {/* Row: label + name input + amounts */}
                    <div
                      className="grid px-4 py-3 gap-2"
                      style={{
                        gridTemplateColumns: isForeign
                          ? "2.5fr 1.5fr 1.5fr"
                          : "3fr 2fr",
                        background: i % 2 === 0 ? "#fff" : "#f8fafc",
                      }}
                    >
                      {/* Particulars cell */}
                      <div className="flex flex-col gap-1.5 pr-3 self-center">
                        <span className="text-sm text-slate-700 leading-tight">
                          {person === "Self"
                            ? "Income of the Applicant"
                            : `Income of the Applicant\u2019s ${person}`}
                        </span>
                        <input
                          type="text"
                          value={personName}
                          onChange={(e) =>
                            updateLabel("incomeLabels")(person, e.target.value)
                          }
                          placeholder={
                            person === "Self"
                              ? data.fullName || "Enter applicant name"
                              : `Enter ${person.toLowerCase()}\u2019s name`
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                            focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
                            transition-colors bg-white placeholder:text-slate-400"
                        />
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({person})
                        </span>
                      </div>

                      {/* INR input + live USD hint */}
                      <div className="flex flex-col gap-0.5 self-center">
                        <input
                          type="text"
                          value={inrVal}
                          onChange={(e) => updateRowInr(i, e.target.value)}
                          placeholder="Enter amount"
                          aria-label={`INR amount for ${person}`}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                            focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
                            transition-colors"
                        />
                        {showUSD && usdLabel && (
                          <span className="text-[10px] text-emerald-700 font-medium pl-1">
                            {usdLabel}
                          </span>
                        )}
                      </div>

                      {/* Foreign column */}
                      {isForeign && (
                        <div className="flex flex-col gap-0.5 self-center">
                          {showUSD ? (
                            <div
                              className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50
                                text-xs w-full text-emerald-800 font-semibold"
                            >
                              {usdLabel || <span className="text-slate-400">Auto</span>}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={data.incomeFR[i] ?? ""}
                              onChange={(e) => updateRowFR(i, e.target.value)}
                              placeholder="Amount"
                              aria-label={`USD amount for ${person}`}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                                focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
                                transition-colors"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Step 3: Per-row document upload */}
                    <div
                      className="px-4 pb-3"
                      style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                    >
                      <FileUpload
                        label={personName || person}
                        docs={data.incomeDocs[person] ?? []}
                        onAdd={(files) =>
                          addIncomeDocs(person, files, certificateId ?? undefined)
                        }
                        onRemove={(idx) => removeIncomeDoc(person, idx)}
                        hint="Form 16, ITR, Audited Financials — PDF or JPG"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Live rate badge */}
              {showUSD && (
                <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 flex items-center gap-1.5">
                  <Pin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="text-[10px] text-emerald-700">
                    Rate used: <strong>1 USD = Rs.{usdRate?.toFixed(2)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exchange rate override */}
        {isForeign && (
          <div className="mt-1">
            <Input
              label="Exchange Rate (as on last savings date) *"
              placeholder="e.g. 1 USD = 84.50 INR"
              value={data.exchangeRate}
              onChange={(e) => updateField("exchangeRate", e.target.value)}
              hint="Foreign currency column is auto-calculated by dividing INR total by this rate"
            />
          </div>
        )}
      </div>
    </Section>
  );
}
