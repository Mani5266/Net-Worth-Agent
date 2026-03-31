"use client";

import { useEffect, useRef } from "react";
import { Section, Checkbox, Select, Input } from "@/components/ui";
import { FileUpload } from "@/components/ui/FileUpload";
import { PROPERTY_PERSONS, PROPERTY_TYPE_OPTIONS } from "@/constants";
import { useFormContext } from "@/hooks/useFormContext";
import { fmtForeignAmount } from "@/lib/utils";
import { Plus, Trash2, Pin, Building2 } from "lucide-react";
import type { ImmovableProperty } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string): number {
  return parseFloat(val.replace(/,/g, "")) || 0;
}

/** Build the "Particulars" label for each property row in the amounts table */
function propertyRowLabel(
  person: string,
  address: string,
  personName: string,
  applicantName: string,
  propertyType?: string,
): string {
  const addr = address.trim() || "[property address]";
  const typeLabel = propertyType?.trim() || "Address of the immovable property";
  if (person === "Self") {
    const name = personName.trim() || applicantName || "[Applicant]";
    return `${typeLabel} \u2014 ${addr} registered in the name of Applicant \u2014 ${name}`;
  }
  const name = personName.trim() || `[${person}\u2019s name]`;
  return `${typeLabel} \u2014 ${addr} registered in the name of Applicant\u2019s ${person} \u2014 ${name}`;
}

/** Resolve display label for a property type */
function displayPropertyType(prop: ImmovableProperty): string {
  if (prop.propertyType === "Other" && prop.customType.trim()) {
    return prop.customType.trim();
  }
  return prop.propertyType || "Property";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StepImmovableProps {
  certificateId: string | null;
}

export function StepImmovable({ certificateId }: StepImmovableProps) {
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
    addImmovableDocs,
    removeImmovableDoc,
  } = useFormContext();

  const selectedPersons = data.immovableTypes; // repurposed: person IDs
  const prevPersonsRef = useRef<string[]>(selectedPersons);
  const prevLabelsRef = useRef<string>(JSON.stringify(data.immovableLabels));

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

    // Remove properties for unchecked persons
    const removed = prev.filter((p) => !selectedPersons.includes(p));
    if (removed.length > 0) {
      const updatedProps = { ...data.immovableProperties };
      const updatedDocs = { ...data.immovableDocs };
      for (const person of removed) {
        delete updatedProps[person];
        // Remove all doc keys for this person
        for (const key of Object.keys(updatedDocs)) {
          if (key.startsWith(`${person}:`)) {
            delete updatedDocs[key];
          }
        }
      }
      updateField("immovableProperties", updatedProps);
      updateField("immovableDocs", updatedDocs);
    }

    // Rebuild flat rows from current properties
    rebuildRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersons]);

  // ── Rebuild row labels when person names change (cross-annexure sync) ───
  useEffect(() => {
    const serialized = JSON.stringify(data.immovableLabels);
    if (serialized !== prevLabelsRef.current) {
      prevLabelsRef.current = serialized;
      rebuildRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.immovableLabels]);

  // ── Rebuild immovableRows + immovableFR from structured properties ──────
  const rebuildRows = () => {
    const rows: { label: string; inr: string }[] = [];
    const frArr: string[] = [];

    // Flatten properties across all selected persons, preserving existing amounts
    let flatIdx = 0;
    for (const person of selectedPersons) {
      const props = data.immovableProperties[person] ?? [];
      const personName = data.immovableLabels[person] ?? "";
      for (const prop of props) {
        const label = propertyRowLabel(person, prop.address, personName, data.fullName, displayPropertyType(prop));
        // Try to preserve existing amount at this index
        const existingRow = data.immovableRows[flatIdx];
        rows.push({ label, inr: existingRow?.inr ?? "" });
        frArr.push(data.immovableFR[flatIdx] ?? "");
        flatIdx++;
      }
    }

    updateField("immovableRows", rows);
    updateField("immovableFR", frArr);
  };

  // ── Property CRUD operations ────────────────────────────────────────────

  const addProperty = (person: string) => {
    const current = data.immovableProperties[person] ?? [];
    const newProp: ImmovableProperty = { propertyType: "", customType: "", address: "" };
    updateField("immovableProperties", {
      ...data.immovableProperties,
      [person]: [...current, newProp],
    });
    // Add a new row + FR entry for this property
    const label = propertyRowLabel(person, "", data.immovableLabels[person] ?? "", data.fullName, "");
    updateField("immovableRows", [...data.immovableRows, { label, inr: "" }]);
    updateField("immovableFR", [...data.immovableFR, ""]);
  };

  const removeProperty = (person: string, propIndex: number) => {
    const current = [...(data.immovableProperties[person] ?? [])];
    current.splice(propIndex, 1);
    const updated = { ...data.immovableProperties, [person]: current };

    // Remove corresponding doc key
    const docKey = `${person}:${propIndex}`;
    const updatedDocs = { ...data.immovableDocs };
    delete updatedDocs[docKey];
    // Re-key docs above the removed index
    for (let j = propIndex + 1; j <= (data.immovableProperties[person]?.length ?? 0); j++) {
      const oldKey = `${person}:${j}`;
      const newKey = `${person}:${j - 1}`;
      if (updatedDocs[oldKey]) {
        updatedDocs[newKey] = updatedDocs[oldKey];
        delete updatedDocs[oldKey];
      }
    }

    updateField("immovableProperties", updated);
    updateField("immovableDocs", updatedDocs);

    // Rebuild flat rows
    rebuildRowsFromProps(updated);
  };

  const updateProperty = (person: string, propIndex: number, field: keyof ImmovableProperty, value: string) => {
    const current = [...(data.immovableProperties[person] ?? [])];
    const prop = current[propIndex];
    if (!prop) return;
    current[propIndex] = { ...prop, [field]: value };
    const updated = { ...data.immovableProperties, [person]: current };
    updateField("immovableProperties", updated);

    // Rebuild labels in flat rows (preserve amounts)
    rebuildRowsFromProps(updated);
  };

  /** Rebuild rows from a given properties map (used after mutations) */
  const rebuildRowsFromProps = (propsMap: Record<string, ImmovableProperty[]>) => {
    const rows: { label: string; inr: string }[] = [];
    const frArr: string[] = [];
    let flatIdx = 0;

    for (const person of selectedPersons) {
      const props = propsMap[person] ?? [];
      const personName = data.immovableLabels[person] ?? "";
      for (const prop of props) {
        const label = propertyRowLabel(person, prop.address, personName, data.fullName, displayPropertyType(prop));
        const existingRow = data.immovableRows[flatIdx];
        rows.push({ label, inr: existingRow?.inr ?? "" });
        frArr.push(data.immovableFR[flatIdx] ?? "");
        flatIdx++;
      }
    }

    updateField("immovableRows", rows);
    updateField("immovableFR", frArr);
  };

  // ── Row amount updaters ─────────────────────────────────────────────────

  const updateRowInr = (index: number, value: string) => {
    const rows = [...data.immovableRows];
    const existing = rows[index];
    if (existing) {
      rows[index] = { ...existing, inr: value };
      updateField("immovableRows", rows);
    }
  };

  const updateRowFR = (index: number, value: string) => {
    const fr = [...data.immovableFR];
    fr[index] = value;
    updateField("immovableFR", fr);
  };

  const showForeign = isForeign && foreignRate != null && foreignRate > 0;

  // ── Count total properties for the amounts table ────────────────────────
  const allProperties: { person: string; propIndex: number; prop: ImmovableProperty }[] = [];
  for (const person of selectedPersons) {
    const props = data.immovableProperties[person] ?? [];
    props.forEach((prop, i) => {
      allProperties.push({ person, propIndex: i, prop });
    });
  }

  return (
    <Section title="Annexure II -- Immovable Assets">
      <div className="flex flex-col gap-5">

        {/* Step 1: Whose property are you declaring? */}
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
            Whose property are you declaring? <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {PROPERTY_PERSONS.map((person) => (
              <Checkbox
                key={person}
                label={person}
                checked={selectedPersons.includes(person)}
                onToggle={() => toggleArrayItem("immovableTypes")(person)}
              />
            ))}
          </div>
        </div>

        {/* Step 2: Per-person property sections */}
        {selectedPersons.map((person) => {
          const props = data.immovableProperties[person] ?? [];
          const personName = data.immovableLabels[person] ?? "";

          return (
            <div key={person} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Person header */}
              <div className="bg-navy-50 border-b border-navy-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-navy-700" />
                  <span className="font-bold text-sm text-navy-800">
                    {person === "Self" ? "Self\u2019s" : `${person}\u2019s`} Properties
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addProperty(person)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                    text-navy-700 bg-white border border-navy-300 rounded-lg
                    hover:bg-navy-50 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-navy-900/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Property
                </button>
              </div>

              {/* Person name input */}
              <div className="px-4 pt-3 pb-2">
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => {
                    updateLabel("immovableLabels")(person, e.target.value);
                  }}
                  placeholder={
                    person === "Self"
                      ? data.fullName || "Enter applicant name"
                      : `Enter ${person.toLowerCase()}\u2019s full name`
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full max-w-md
                    focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
                    transition-colors bg-white placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Name as it appears on property documents ({person})
                </p>
              </div>

              {/* Property entries */}
              {props.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  No properties added yet. Click &ldquo;+ Add Property&rdquo; to begin.
                </div>
              )}

              {props.map((prop, pIdx) => {
                const docKey = `${person}:${pIdx}`;
                return (
                  <div
                    key={pIdx}
                    className="border-t border-slate-100 px-4 py-3"
                    style={{ background: pIdx % 2 === 0 ? "#fff" : "#f8fafc" }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Property {pIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeProperty(person, pIdx)}
                        className="p-1 text-red-400 hover:text-red-600 rounded transition-colors
                          focus:outline-none focus:ring-2 focus:ring-red-400/20"
                        aria-label={`Remove property ${pIdx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                      {/* Property type dropdown */}
                      <div className="flex flex-col gap-1">
                        <Select
                          label="Property Type"
                          placeholder="Select type..."
                          options={PROPERTY_TYPE_OPTIONS}
                          value={prop.propertyType}
                          onChange={(e) => updateProperty(person, pIdx, "propertyType", e.target.value)}
                        />
                      </div>

                      {/* Custom type (only for "Other") */}
                      {prop.propertyType === "Other" && (
                        <div className="flex flex-col gap-1">
                          <Input
                            label="Custom Property Type"
                            placeholder="e.g. Agricultural Land"
                            value={prop.customType}
                            onChange={(e) => updateProperty(person, pIdx, "customType", e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Address input */}
                    <div className="mb-2">
                      <Input
                        label="Property Address"
                        placeholder="Door No / Plot No, Area, District, State, India, Pincode"
                        value={prop.address}
                        onChange={(e) => updateProperty(person, pIdx, "address", e.target.value)}
                      />
                    </div>

                    {/* Document upload */}
                    <FileUpload
                      label={`${displayPropertyType(prop)} – ${person}`}
                      docs={data.immovableDocs[docKey] ?? []}
                      onAdd={(files) => addImmovableDocs(docKey, files, certificateId ?? undefined)}
                      onRemove={(i) => removeImmovableDoc(docKey, i)}
                      hint="Sale deed, valuation report, or self-declaration — PDF or JPG"
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Step 3: Consolidated amounts table */}
        {allProperties.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Asset Amounts <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-400 mb-3">
              One row per property added above
            </p>

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
              {allProperties.map(({ person, prop }, flatIdx) => {
                const inrVal = data.immovableRows[flatIdx]?.inr ?? "";
                const foreignLabel = showForeign && foreignRate ? fmtForeignAmount(inrVal, foreignRate, currencyInfo) : "";
                const personName = data.immovableLabels[person] ?? "";
                const addr = prop.address.trim() || "[property address]";
                const typeName = displayPropertyType(prop);

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
                          ? `${addr} registered in the name of Applicant \u2014 ${personName.trim() || data.fullName || "Self"}`
                          : `${addr} registered in the name of Applicant\u2019s ${person} \u2014 ${personName.trim() || `[${person}\u2019s name]`}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {typeName} &middot; {person}
                      </span>
                    </div>

                    {/* INR input */}
                    <div className="flex flex-col gap-0.5 self-center">
                      <input
                        type="text"
                        value={inrVal}
                        onChange={(e) => updateRowInr(flatIdx, e.target.value)}
                        placeholder="Enter amount"
                        aria-label={`INR amount for property ${flatIdx + 1}`}
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
                            value={data.immovableFR[flatIdx] ?? ""}
                            onChange={(e) => updateRowFR(flatIdx, e.target.value)}
                            placeholder="Amount"
                            aria-label={`${currencyInfo.code} amount for property ${flatIdx + 1}`}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                              focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
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
