"use client";

import { useEffect, useRef } from "react";
import { Section, Checkbox, Input, Select } from "@/components/ui";
import { FileUpload } from "@/components/ui/FileUpload";
import { INCOME_PERSONS, ASSESSMENT_YEAR_OPTIONS } from "@/constants";
import { deriveAssessmentYear, fmtForeignAmount } from "@/lib/utils";
import { useFormContext } from "@/hooks/useFormContext";
import { Pin } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function personRowLabel(person: string): string {
  if (person === "Self") return "Annual Income of the Applicant";
  return `Annual Income of the Applicant's ${person}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StepIncomeProps {
  certificateId: string | null;
}

export function StepIncome({ certificateId }: StepIncomeProps) {
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
    addIncomeDocs,
    removeIncomeDoc,
  } = useFormContext();

  const derivedYear = deriveAssessmentYear(data.certDate);
  const assessmentYear = data.assessmentYear || derivedYear;
  const selectedPersons = data.incomeTypes; // repurposed: person IDs
  const prevPersonsRef = useRef<string[]>(selectedPersons);

  // Auto-set assessment year from cert date if not already set
  useEffect(() => {
    if (!data.assessmentYear && derivedYear) {
      updateField("assessmentYear", derivedYear);
    }
  }, [derivedYear, data.assessmentYear, updateField]);

  // ── Auto-fill "Self" label with applicant's fullName when "Self" is selected ──
  useEffect(() => {
    if (
      selectedPersons.includes("Self") &&
      !data.incomeLabels["Self"] &&
      data.fullName
    ) {
      updateLabel("incomeLabels")("Self", data.fullName);
    }
  }, [selectedPersons, data.fullName, data.incomeLabels, updateLabel]);

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

  const showForeign = isForeign && foreignRate != null && foreignRate > 0;

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
            <div className="mb-3 max-w-xs">
              <Select
                label="Assessment Year"
                options={ASSESSMENT_YEAR_OPTIONS}
                value={assessmentYear}
                onChange={(e) => updateField("assessmentYear", e.target.value)}
                placeholder="Select Assessment Year"
              />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Table header */}
              <div
                className="grid bg-navy-950 px-4 py-2.5"
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
              {selectedPersons.map((person, i) => {
                const inrVal = data.incomeRows[i]?.inr ?? "";
                const foreignLabel = showForeign && foreignRate ? fmtForeignAmount(inrVal, foreignRate, currencyInfo) : "";
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
                            ? "Annual Income of the Applicant"
                            : `Annual Income of the Applicant\u2019s ${person}`}
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
                            focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
                            transition-colors bg-white placeholder:text-slate-400"
                        />
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({person})
                        </span>
                      </div>

                      {/* INR input + live foreign hint */}
                      <div className="flex flex-col gap-0.5 self-center">
                        <input
                          type="text"
                          value={inrVal}
                          onChange={(e) => updateRowInr(i, e.target.value)}
                          placeholder="Enter amount"
                          aria-label={`INR amount for ${person}`}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                             focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
                            transition-colors"
                        />
                        {showForeign && foreignLabel && (
                          <span className="text-[10px] text-navy-700 font-medium pl-1">
                            {foreignLabel}
                          </span>
                        )}
                      </div>

                      {/* Foreign column */}
                      {isForeign && (
                        <div className="flex flex-col gap-0.5 self-center">
                          {showForeign ? (
                            <div
                             className="px-2.5 py-1.5 rounded-lg border border-navy-200 bg-navy-50
                                text-xs w-full text-navy-800 font-semibold"
                            >
                              {foreignLabel || <span className="text-slate-400">Auto</span>}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={data.incomeFR[i] ?? ""}
                              onChange={(e) => updateRowFR(i, e.target.value)}
                              placeholder="Amount"
                              aria-label={`${currencyInfo.code} amount for ${person}`}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                                focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
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
              {showForeign && (
                <div className="px-4 py-2 bg-navy-50 border-t border-navy-100 flex items-center gap-1.5">
                  <Pin className="w-3 h-3 text-navy-600 shrink-0" />
                  <span className="text-[10px] text-navy-700">
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
      </div>
    </Section>
  );
}
