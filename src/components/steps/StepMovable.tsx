"use client";

import { useEffect, useRef, useMemo } from "react";
import { Section, Checkbox, Select, Input } from "@/components/ui";
import { FileUpload } from "@/components/ui/FileUpload";
import { MOVABLE_PERSONS, MOVABLE_ASSET_OPTIONS } from "@/constants";
import { useFormContext } from "@/hooks/useFormContext";
import { parseAmount, validateGoldValue, estimateGoldValue, formatINR } from "@/lib/utils";
import { Plus, Trash2, Package, Pin } from "lucide-react";
import type { MovableAsset } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string): number {
  return parseFloat(val.replace(/,/g, "")) || 0;
}

function fmtUSD(inr: string, rate: number): string {
  const n = parseNum(inr);
  if (!n || !rate) return "";
  const usd = n / rate;
  return `\u2248 $${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Build the "Particulars" label for each asset row in the amounts table */
function assetRowLabel(
  person: string,
  asset: MovableAsset,
  personName: string,
  applicantName: string,
): string {
  const typeName = displayAssetType(asset);
  const desc = asset.description.trim();
  const prefix = desc ? `${typeName} \u2013 ${desc}` : typeName;

  if (person === "Self") {
    const name = personName.trim() || applicantName || "[Applicant]";
    return `${prefix} in the name of Applicant (${name})`;
  }
  const name = personName.trim() || `[${person}\u2019s name]`;
  return `${prefix} in the name of Applicant\u2019s ${person} \u2014 ${name}`;
}

/** Resolve display label for an asset type */
function displayAssetType(asset: MovableAsset): string {
  if (asset.assetType === "Other Movable Assets" && asset.customType.trim()) {
    return asset.customType.trim();
  }
  return asset.assetType || "Movable Asset";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StepMovableProps {
  certificateId: string | null;
}

export function StepMovable({ certificateId }: StepMovableProps) {
  const {
    data,
    isForeign,
    usdRate,
    toggleArrayItem,
    updateField,
    updateLabel,
    addMovableDocs,
    removeMovableDoc,
  } = useFormContext();

  const selectedPersons = data.movableTypes; // repurposed: person IDs
  const prevPersonsRef = useRef<string[]>(selectedPersons);

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

    // Remove assets for unchecked persons
    const removed = prev.filter((p) => !selectedPersons.includes(p));
    if (removed.length > 0) {
      const updatedAssets = { ...data.movableAssets };
      const updatedDocs = { ...data.movableDocs };
      for (const person of removed) {
        delete updatedAssets[person];
        // Remove all doc keys for this person
        for (const key of Object.keys(updatedDocs)) {
          if (key.startsWith(`${person}:`)) {
            delete updatedDocs[key];
          }
        }
      }
      updateField("movableAssets", updatedAssets);
      updateField("movableDocs", updatedDocs);
    }

    // Rebuild flat rows from current assets
    rebuildRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersons]);

  // ── Rebuild movableRows + movableFR from structured assets ──────────────
  const rebuildRows = () => {
    const rows: { label: string; inr: string }[] = [];
    const frArr: string[] = [];

    let flatIdx = 0;
    for (const person of selectedPersons) {
      const assets = data.movableAssets[person] ?? [];
      const personName = data.movableLabels[person] ?? "";
      for (const asset of assets) {
        const label = assetRowLabel(person, asset, personName, data.fullName);
        const existingRow = data.movableRows[flatIdx];
        rows.push({ label, inr: existingRow?.inr ?? "" });
        frArr.push(data.movableFR[flatIdx] ?? "");
        flatIdx++;
      }
    }

    updateField("movableRows", rows);
    updateField("movableFR", frArr);
  };

  // ── Asset CRUD operations ───────────────────────────────────────────────

  const addAsset = (person: string) => {
    const current = data.movableAssets[person] ?? [];
    const newAsset: MovableAsset = { assetType: "", customType: "", description: "" };
    updateField("movableAssets", {
      ...data.movableAssets,
      [person]: [...current, newAsset],
    });
    // Add a new row + FR entry
    const label = assetRowLabel(person, newAsset, data.movableLabels[person] ?? "", data.fullName);
    updateField("movableRows", [...data.movableRows, { label, inr: "" }]);
    updateField("movableFR", [...data.movableFR, ""]);
  };

  const removeAsset = (person: string, assetIndex: number) => {
    const current = [...(data.movableAssets[person] ?? [])];
    current.splice(assetIndex, 1);
    const updated = { ...data.movableAssets, [person]: current };

    // Remove corresponding doc key
    const docKey = `${person}:${assetIndex}`;
    const updatedDocs = { ...data.movableDocs };
    delete updatedDocs[docKey];
    // Re-key docs above the removed index
    for (let j = assetIndex + 1; j <= (data.movableAssets[person]?.length ?? 0); j++) {
      const oldKey = `${person}:${j}`;
      const newKey = `${person}:${j - 1}`;
      if (updatedDocs[oldKey]) {
        updatedDocs[newKey] = updatedDocs[oldKey];
        delete updatedDocs[oldKey];
      }
    }

    updateField("movableAssets", updated);
    updateField("movableDocs", updatedDocs);

    // Rebuild flat rows
    rebuildRowsFromAssets(updated);
  };

  const updateAsset = (person: string, assetIndex: number, field: keyof MovableAsset, value: string) => {
    const current = [...(data.movableAssets[person] ?? [])];
    const asset = current[assetIndex];
    if (!asset) return;
    current[assetIndex] = { ...asset, [field]: value };
    const updated = { ...data.movableAssets, [person]: current };
    updateField("movableAssets", updated);

    // Rebuild labels in flat rows (preserve amounts)
    rebuildRowsFromAssets(updated);
  };

  /** Rebuild rows from a given assets map (used after mutations) */
  const rebuildRowsFromAssets = (assetsMap: Record<string, MovableAsset[]>) => {
    const rows: { label: string; inr: string }[] = [];
    const frArr: string[] = [];
    let flatIdx = 0;

    for (const person of selectedPersons) {
      const assets = assetsMap[person] ?? [];
      const personName = data.movableLabels[person] ?? "";
      for (const asset of assets) {
        const label = assetRowLabel(person, asset, personName, data.fullName);
        const existingRow = data.movableRows[flatIdx];
        rows.push({ label, inr: existingRow?.inr ?? "" });
        frArr.push(data.movableFR[flatIdx] ?? "");
        flatIdx++;
      }
    }

    updateField("movableRows", rows);
    updateField("movableFR", frArr);
  };

  // ── Row amount updaters ─────────────────────────────────────────────────

  const updateRowInr = (index: number, value: string) => {
    const rows = [...data.movableRows];
    const existing = rows[index];
    if (existing) {
      rows[index] = { ...existing, inr: value };
      updateField("movableRows", rows);
    }
  };

  const updateRowFR = (index: number, value: string) => {
    const fr = [...data.movableFR];
    fr[index] = value;
    updateField("movableFR", fr);
  };

  const showUSD = isForeign && usdRate != null && usdRate > 0;

  // ── Flatten all assets for the amounts table ────────────────────────────
  const allAssets: { person: string; assetIndex: number; asset: MovableAsset }[] = [];
  for (const person of selectedPersons) {
    const assets = data.movableAssets[person] ?? [];
    assets.forEach((asset, i) => {
      allAssets.push({ person, assetIndex: i, asset });
    });
  }

  // ── Gold detection & validation ─────────────────────────────────────────
  // Show gold grams input if ANY person has a "Gold & Jewellery" asset
  const hasGold = allAssets.some((a) => a.asset.assetType === "Gold & Jewellery");
  const goldGrams = parseFloat(data.goldGrams) || 0;

  // Find first gold row index to get its declared value for validation
  const goldFlatIndex = allAssets.findIndex((a) => a.asset.assetType === "Gold & Jewellery");
  const goldDeclaredINR = goldFlatIndex >= 0
    ? parseAmount(data.movableRows[goldFlatIndex]?.inr ?? "")
    : 0;

  const goldWarning = useMemo(
    () => hasGold ? validateGoldValue(goldGrams, goldDeclaredINR) : null,
    [hasGold, goldGrams, goldDeclaredINR]
  );

  const goldEstimate = useMemo(
    () => hasGold && goldGrams > 0 ? estimateGoldValue(goldGrams) : null,
    [hasGold, goldGrams]
  );

  return (
    <Section title="Annexure III -- Movable Properties">
      <div className="flex flex-col gap-5">

        {/* Step 1: Whose assets are you declaring? */}
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
            Whose movable assets are you declaring? <span className="text-red-500">*</span>
          </p>
          <p className="text-[10px] text-slate-400 -mt-2 mb-2 italic">Specify value in Rupees</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {MOVABLE_PERSONS.map((person) => (
              <Checkbox
                key={person}
                label={person}
                checked={selectedPersons.includes(person)}
                onToggle={() => toggleArrayItem("movableTypes")(person)}
              />
            ))}
          </div>
        </div>

        {/* Step 2: Per-person asset sections */}
        {selectedPersons.map((person) => {
          const assets = data.movableAssets[person] ?? [];
          const personName = data.movableLabels[person] ?? "";

          return (
            <div key={person} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Person header */}
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-700" />
                  <span className="font-bold text-sm text-amber-800">
                    {person === "Self" ? "Self\u2019s" : `${person}\u2019s`} Assets
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addAsset(person)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                    text-amber-700 bg-white border border-amber-300 rounded-lg
                    hover:bg-amber-50 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-amber-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Asset
                </button>
              </div>

              {/* Person name input */}
              <div className="px-4 pt-3 pb-2">
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => {
                    updateLabel("movableLabels")(person, e.target.value);
                    // Rebuild row labels with new name
                    setTimeout(() => rebuildRowsFromAssets(data.movableAssets), 0);
                  }}
                  placeholder={
                    person === "Self"
                      ? data.fullName || "Enter applicant name"
                      : `Enter ${person.toLowerCase()}\u2019s full name`
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full max-w-md
                    focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600
                    transition-colors bg-white placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Name as it appears on asset documents ({person})
                </p>
              </div>

              {/* Asset entries */}
              {assets.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  No assets added yet. Click &ldquo;+ Add Asset&rdquo; to begin.
                </div>
              )}

              {assets.map((asset, aIdx) => {
                const docKey = `${person}:${aIdx}`;
                return (
                  <div
                    key={aIdx}
                    className="border-t border-slate-100 px-4 py-3"
                    style={{ background: aIdx % 2 === 0 ? "#fff" : "#f8fafc" }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Asset {aIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAsset(person, aIdx)}
                        className="p-1 text-red-400 hover:text-red-600 rounded transition-colors
                          focus:outline-none focus:ring-2 focus:ring-red-400/20"
                        aria-label={`Remove asset ${aIdx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                      {/* Asset type dropdown */}
                      <div className="flex flex-col gap-1">
                        <Select
                          label="Asset Type"
                          placeholder="Select type..."
                          options={MOVABLE_ASSET_OPTIONS}
                          value={asset.assetType}
                          onChange={(e) => updateAsset(person, aIdx, "assetType", e.target.value)}
                        />
                      </div>

                      {/* Custom type (only for "Other Movable Assets") */}
                      {asset.assetType === "Other Movable Assets" && (
                        <div className="flex flex-col gap-1">
                          <Input
                            label="Custom Asset Type"
                            placeholder="e.g. Artwork, Antiques, Machinery"
                            value={asset.customType}
                            onChange={(e) => updateAsset(person, aIdx, "customType", e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Description input */}
                    <div className="mb-2">
                      <Input
                        label="Description"
                        placeholder={
                          asset.assetType === "Gold & Jewellery"
                            ? "e.g. Gold necklace, bangles, earrings"
                            : asset.assetType === "Vehicles"
                            ? "e.g. Honda City 2022, Registration No. TS09AB1234"
                            : "e.g. Description of the asset"
                        }
                        value={asset.description}
                        onChange={(e) => updateAsset(person, aIdx, "description", e.target.value)}
                      />
                    </div>

                    {/* Document upload */}
                    <FileUpload
                      label={`${displayAssetType(asset)} \u2013 ${person}`}
                      docs={data.movableDocs[docKey] ?? []}
                      onAdd={(files) => addMovableDocs(docKey, files, certificateId ?? undefined)}
                      onRemove={(i) => removeMovableDoc(docKey, i)}
                      hint="Valuation certificate, RC copy, purchase invoice — PDF or JPG"
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Gold weight + validation (shown when any person has gold) */}
        {hasGold && (
          <div>
            <Input
              label="Gold Weight (grams)"
              type="number"
              placeholder="e.g. 50"
              value={data.goldGrams}
              onChange={(e) => updateField("goldGrams", e.target.value)}
            />
            {/* Gold price reference */}
            {goldEstimate && (
              <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                <p className="font-semibold mb-0.5">Gold Price Reference ({goldGrams}g):</p>
                <p>22K estimate: {formatINR(goldEstimate.estimated22k)} | 24K estimate: {formatINR(goldEstimate.estimated24k)}</p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  Acceptable range: {formatINR(goldEstimate.lowerBound)} - {formatINR(goldEstimate.upperBound)}
                </p>
              </div>
            )}
            {/* Gold valuation warning */}
            {goldWarning && (
              <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                {goldWarning}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Consolidated amounts table */}
        {allAssets.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Asset Amounts <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-400 mb-3">
              One row per asset added above
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Table header */}
              <div
                className="grid bg-amber-800 px-4 py-2.5"
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
              {allAssets.map(({ person, asset }, flatIdx) => {
                const inrVal = data.movableRows[flatIdx]?.inr ?? "";
                const usdLabel = showUSD && usdRate ? fmtUSD(inrVal, usdRate) : "";
                const personName = data.movableLabels[person] ?? "";
                const typeName = displayAssetType(asset);
                const desc = asset.description.trim();
                const prefix = desc ? `${typeName} \u2013 ${desc}` : typeName;

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
                          ? `${prefix} in the name of Applicant (${personName.trim() || data.fullName || "Self"})`
                          : `${prefix} in the name of Applicant\u2019s ${person} \u2014 ${personName.trim() || `[${person}\u2019s name]`}`}
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
                        aria-label={`INR amount for asset ${flatIdx + 1}`}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                          focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600
                          transition-colors"
                      />
                      {showUSD && usdLabel && (
                        <span className="text-[10px] text-amber-700 font-medium pl-1">
                          {usdLabel}
                        </span>
                      )}
                    </div>

                    {/* Foreign column */}
                    {isForeign && (
                      <div className="flex flex-col gap-0.5 self-center">
                        {showUSD ? (
                          <div
                            className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50
                              text-xs w-full text-amber-800 font-semibold"
                          >
                            {usdLabel || <span className="text-slate-400">Auto</span>}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={data.movableFR[flatIdx] ?? ""}
                            onChange={(e) => updateRowFR(flatIdx, e.target.value)}
                            placeholder="Amount"
                            aria-label={`USD amount for asset ${flatIdx + 1}`}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-full
                              focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600
                              transition-colors"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Rate badge */}
              {showUSD && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-1.5">
                  <Pin className="w-3 h-3 text-amber-600 shrink-0" />
                  <span className="text-[10px] text-amber-700">
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
