"use client";

import { useEffect, useRef, useMemo } from "react";
import { Section, Checkbox, Select, Input } from "@/components/ui";
import { FileUpload } from "@/components/ui/FileUpload";
import { MOVABLE_PERSONS, MOVABLE_ASSET_OPTIONS } from "@/constants";
import { useFormContext } from "@/hooks/useFormContext";
import { useGoldPrice } from "@/hooks/useGoldPrice";
import { formatINR, fmtForeignAmount } from "@/lib/utils";
import { Plus, Trash2, Package, Pin, Scale } from "lucide-react";
import type { MovableAsset } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(val: string): number {
  return parseFloat(val.replace(/,/g, "")) || 0;
}

/** Build the "Particulars" label for each asset row in the amounts table */
function assetRowLabel(
  person: string,
  asset: MovableAsset,
  personName: string,
  applicantName: string,
  goldGrams?: string,
  goldKarat?: string,
): string {
  const isGold = asset.assetType === "Gold & Jewellery";

  let prefix: string;
  if (isGold) {
    // Gold rows: "Gold and Jewellery ornaments weighing Xg (22K/24K)"
    const grams = goldGrams?.trim() || "___";
    const karat = goldKarat || "22K";
    prefix = `Gold and Jewellery ornaments weighing ${grams} gms (${karat})`;
  } else {
    // Other asset types: use description only
    const desc = asset.description.trim();
    prefix = desc || "Movable Asset";
  }

  if (person === "Self") {
    const name = personName.trim() || applicantName || "[Applicant]";
    return `${prefix} in the name of Applicant \u2014 ${name}`;
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
    foreignRate,
    liveExchangeRate,
    exchangeRateLoading,
    currencyInfo,
    toggleArrayItem,
    updateField,
    updateLabel,
    addMovableDocs,
    removeMovableDoc,
  } = useFormContext();

  const goldPrice = useGoldPrice();

  const selectedPersons = data.movableTypes; // repurposed: person IDs
  const prevPersonsRef = useRef<string[]>(selectedPersons);
  const prevLabelsRef = useRef<string>(JSON.stringify(data.movableLabels));

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

  // ── Rebuild row labels when person names change (cross-annexure sync) ───
  useEffect(() => {
    const serialized = JSON.stringify(data.movableLabels);
    if (serialized !== prevLabelsRef.current) {
      prevLabelsRef.current = serialized;
      rebuildRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.movableLabels]);

  // ── Rebuild row labels when gold weight or karat changes ───────────────
  useEffect(() => {
    rebuildRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.goldGrams, data.goldKarat]);

  // ── Rebuild movableRows + movableFR from structured assets ──────────────
  const rebuildRows = () => {
    const rows: { label: string; inr: string }[] = [];
    const frArr: string[] = [];

    let flatIdx = 0;
    for (const person of selectedPersons) {
      const assets = data.movableAssets[person] ?? [];
      const personName = data.movableLabels[person] ?? "";
      for (const asset of assets) {
        const label = assetRowLabel(person, asset, personName, data.fullName, data.goldGrams, data.goldKarat);
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
    const label = assetRowLabel(person, newAsset, data.movableLabels[person] ?? "", data.fullName, data.goldGrams, data.goldKarat);
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
        const label = assetRowLabel(person, asset, personName, data.fullName, data.goldGrams, data.goldKarat);
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

  const showForeign = isForeign && foreignRate != null && foreignRate > 0;

  // ── Flatten all assets for the amounts table ────────────────────────────
  const allAssets: { person: string; assetIndex: number; asset: MovableAsset }[] = [];
  for (const person of selectedPersons) {
    const assets = data.movableAssets[person] ?? [];
    assets.forEach((asset, i) => {
      allAssets.push({ person, assetIndex: i, asset });
    });
  }

  // ── Gold auto-calculation ────────────────────────────────────────────────
  const goldGrams = parseFloat(data.goldGrams) || 0;
  const goldKarat = data.goldKarat || "22K";
  const manualPricePerGram = parseFloat(data.goldPriceOverride) || 0;
  const livePricePerGram = goldKarat === "24K"
    ? (goldPrice.price24k ?? 0)
    : (goldPrice.price22k ?? 0);
  // Manual override takes priority over live rate
  const goldPricePerGram = manualPricePerGram > 0 ? manualPricePerGram : livePricePerGram;
  const usingOverride = manualPricePerGram > 0;
  const goldAutoAmount = useMemo(
    () => goldGrams > 0 && goldPricePerGram > 0
      ? Math.round(goldGrams * goldPricePerGram)
      : 0,
    [goldGrams, goldPricePerGram]
  );

  // Auto-fill gold row amounts whenever grams or allAssets change
  useEffect(() => {
    if (!goldAutoAmount) return;
    const rows = [...data.movableRows];
    let changed = false;
    let flatIdx = 0;
    for (const person of selectedPersons) {
      const assets = data.movableAssets[person] ?? [];
      for (const asset of assets) {
        if (asset.assetType === "Gold & Jewellery") {
          const formatted = goldAutoAmount.toLocaleString("en-IN");
          if (rows[flatIdx] && rows[flatIdx]!.inr !== formatted) {
            rows[flatIdx] = { label: rows[flatIdx]!.label, inr: formatted };
            changed = true;
          }
        }
        flatIdx++;
      }
    }
    if (changed) {
      updateField("movableRows", rows);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldAutoAmount, selectedPersons]);

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

                    {/* Gold weight + karat + auto-calculation (only for Gold & Jewellery) */}
                    {asset.assetType === "Gold & Jewellery" && (
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Scale className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Gold Weight &amp; Purity
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          {/* Grams input */}
                          <div className="flex-1 max-w-xs">
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                              Weight (grams)
                            </label>
                            <input
                              type="number"
                              value={data.goldGrams}
                              onChange={(e) => updateField("goldGrams", e.target.value)}
                              placeholder="e.g. 50"
                              className="px-2.5 py-1.5 rounded-lg border border-amber-300 text-xs w-full
                                focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600
                                transition-colors bg-amber-50 placeholder:text-slate-400"
                            />
                          </div>

                          {/* Karat selector */}
                          <div className="w-28">
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                              Purity
                            </label>
                            <div className="flex rounded-lg border border-amber-300 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateField("goldKarat", "22K")}
                                className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                                  goldKarat === "22K"
                                    ? "bg-amber-600 text-white"
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                              >
                                22K
                              </button>
                              <button
                                type="button"
                                onClick={() => updateField("goldKarat", "24K")}
                                className={`flex-1 py-1.5 text-xs font-semibold border-l border-amber-300 transition-colors ${
                                  goldKarat === "24K"
                                    ? "bg-amber-600 text-white"
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                              >
                                24K
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Warning + manual price override */}
                        <div className="mt-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-[11px] text-orange-700 font-medium mb-1.5">
                            If the live gold rate is incorrect, enter the price per gram manually below. This will override the auto-fetched rate.
                          </p>
                          <div className="max-w-xs">
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                              Price per gram (Rs.) — leave empty to use live rate
                            </label>
                            <input
                              type="number"
                              value={data.goldPriceOverride}
                              onChange={(e) => updateField("goldPriceOverride", e.target.value)}
                              placeholder={livePricePerGram > 0 ? `Live: Rs.${livePricePerGram.toLocaleString("en-IN")}` : "e.g. 7800"}
                              className="px-2.5 py-1.5 rounded-lg border border-orange-300 text-xs w-full
                                focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                                transition-colors bg-white placeholder:text-slate-400"
                            />
                          </div>
                        </div>

                        {/* Auto-calculation result */}
                        {goldAutoAmount > 0 && (
                          <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                            <p className="font-semibold">
                              Auto-calculated: {formatINR(goldAutoAmount)} ({goldKarat} @ Rs.{goldPricePerGram.toLocaleString("en-IN")}/g{usingOverride ? " — manual override" : ""})
                            </p>
                            {!usingOverride && (
                              <p className="text-[10px] text-amber-600 mt-0.5">
                                {goldKarat === "22K"
                                  ? `24K estimate: ${formatINR(Math.round(goldGrams * (goldPrice.price24k ?? 0)))}`
                                  : `22K estimate: ${formatINR(Math.round(goldGrams * (goldPrice.price22k ?? 0)))}`}
                                {goldPrice.source && ` \u00B7 ${goldPrice.source}`}
                                {goldPrice.updatedAt && ` \u00B7 Updated: ${goldPrice.updatedAt}`}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Loading / error state */}
                        {goldPrice.loading && (
                          <p className="mt-1 text-[10px] text-amber-500 italic">Fetching live gold prices...</p>
                        )}
                      </div>
                    )}

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
                    {data.country || "Foreign"}
                  </div>
                )}
              </div>

              {/* Table rows */}
              {allAssets.map(({ person, asset }, flatIdx) => {
                const inrVal = data.movableRows[flatIdx]?.inr ?? "";
                const foreignLabel = showForeign && foreignRate ? fmtForeignAmount(inrVal, foreignRate, currencyInfo) : "";
                const personName = data.movableLabels[person] ?? "";
                const typeName = displayAssetType(asset);
                const desc = asset.description.trim();
                const isGoldRow = asset.assetType === "Gold & Jewellery";
                // Gold: "Gold and Jewellery ornaments weighing Xg (karat)"
                // Others: description only (no "Type – Description" prefix)
                const prefix = isGoldRow
                  ? `Gold and Jewellery ornaments weighing ${goldGrams > 0 ? goldGrams : "___"} gms (${goldKarat})`
                  : (desc || typeName);

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
                        {typeName} &middot; {person}
                        {isGoldRow && goldGrams > 0 && ` \u00B7 ${goldGrams}g @ ${goldKarat}`}
                      </span>
                    </div>

                    {/* INR input — auto-filled for gold, manual for others */}
                    <div className="flex flex-col gap-0.5 self-center">
                      {isGoldRow && goldAutoAmount > 0 ? (
                        <div
                          className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50
                            text-xs w-full text-amber-900 font-semibold"
                          title="Auto-calculated from gold weight"
                        >
                          {formatINR(goldAutoAmount)}
                        </div>
                      ) : (
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
                      )}
                      {showForeign && foreignLabel && (
                        <span className="text-[10px] text-amber-700 font-medium pl-1">
                          {foreignLabel}
                        </span>
                      )}
                    </div>

                    {/* Foreign column */}
                    {isForeign && (
                      <div className="flex flex-col gap-0.5 self-center">
                        {showForeign ? (
                          <div
                            className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50
                              text-xs w-full text-amber-800 font-semibold"
                          >
                            {foreignLabel || <span className="text-slate-400">Auto</span>}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={data.movableFR[flatIdx] ?? ""}
                            onChange={(e) => updateRowFR(flatIdx, e.target.value)}
                            placeholder="Amount"
                            aria-label={`${currencyInfo.code} amount for asset ${flatIdx + 1}`}
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
              {showForeign && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-1.5">
                  <Pin className="w-3 h-3 text-amber-600 shrink-0" />
                  <span className="text-[10px] text-amber-700">
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
