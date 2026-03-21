"use client";

import type { AnnexureRow } from "@/types";

interface AnnexureTableProps {
  rows: AnnexureRow[];
  onChangeInr: (index: number, value: string) => void;
  isForeign?: boolean;
  countryLabel?: string;
  /** Auto-computed foreign values derived from live exchange rate (read-only) */
  foreignRows?: string[];
  onChangeForeign?: (index: number, value: string) => void;
  /** Live USD/INR rate — when provided, auto-converts INR to USD below each input */
  usdRate?: number | null;
}

function parseNum(val: string): number {
  return parseFloat(val.replace(/,/g, "")) || 0;
}

function fmtUSD(inr: string, rate: number): string {
  const inrNum = parseNum(inr);
  if (!inrNum || !rate) return "";
  const usd = inrNum / rate;
  return `≈ $${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AnnexureTable({
  rows,
  onChangeInr,
  isForeign = false,
  countryLabel = "Foreign",
  foreignRows = [],
  onChangeForeign,
  usdRate,
}: AnnexureTableProps) {
  const showUSD = isForeign && usdRate != null && usdRate > 0;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mt-3">
      {/* Header */}
      <div
        className="grid bg-emerald-800 px-3 py-2"
        style={{ gridTemplateColumns: isForeign ? "3fr 1.5fr 1.5fr" : "3fr 2fr" }}
      >
        <div className="text-white font-bold text-xs">Particulars</div>
        <div className="text-white font-bold text-xs">Indian (Rs.)</div>
        {isForeign && (
          <div className="text-white font-bold text-xs">{countryLabel} (USD $)</div>
        )}
      </div>

      {/* Rows */}
      {rows.map((row, i) => {
        const usdLabel = showUSD ? fmtUSD(row.inr, usdRate!) : "";

        return (
          <div
            key={i}
            className="grid px-3 py-2 border-t border-gray-100"
            style={{
              gridTemplateColumns: isForeign ? "3fr 1.5fr 1.5fr" : "3fr 2fr",
              background: i % 2 === 0 ? "#fff" : "#fafafa",
            }}
          >
            <div className="text-sm text-gray-700 pr-3 self-center leading-tight">
              {row.label}
            </div>

            {/* INR input + live USD hint */}
            <div className="flex flex-col gap-0.5">
              <input
                type="text"
                value={row.inr}
                onChange={(e) => onChangeInr(i, e.target.value)}
                placeholder="Enter amount"
                className="px-2 py-1.5 rounded-md border border-gray-200 text-xs w-full
                  focus:outline-none focus:border-emerald-600 transition-colors"
              />
              {showUSD && usdLabel && (
                <span className="text-[10px] text-emerald-700 font-medium pl-1">
                  {usdLabel}
                </span>
              )}
            </div>

            {/* Foreign column: auto-filled from conversion OR manual entry */}
            {isForeign && (
              <div className="flex flex-col gap-0.5">
                {showUSD ? (
                  /* Auto-converted, read-only display */
                  <div
                    className="px-2 py-1.5 rounded-md border border-emerald-200 bg-emerald-50
                      text-xs w-full text-emerald-800 font-semibold"
                  >
                    {usdLabel || <span className="text-gray-400">Auto</span>}
                  </div>
                ) : (
                  /* Manual entry (when no live rate) */
                  <input
                    type="text"
                    value={foreignRows[i] ?? ""}
                    onChange={(e) => onChangeForeign?.(i, e.target.value)}
                    placeholder="Amount"
                    className="px-2 py-1.5 rounded-md border border-gray-200 text-xs w-full
                      focus:outline-none focus:border-emerald-600 transition-colors"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Live rate badge */}
      {showUSD && (
        <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-100 flex items-center gap-1.5">
          <span className="text-[10px] text-emerald-700">
            📌 Rate used: <strong>1 USD = ₹{usdRate!.toFixed(2)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
