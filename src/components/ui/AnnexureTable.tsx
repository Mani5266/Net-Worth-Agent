"use client";

import { Pin } from "lucide-react";
import type { AnnexureRow } from "@/types";
import type { CurrencyInfo } from "@/constants";
import { DEFAULT_CURRENCY } from "@/constants";
import { fmtForeignAmount } from "@/lib/utils";

interface AnnexureTableProps {
  rows: AnnexureRow[];
  onChangeInr: (index: number, value: string) => void;
  isForeign?: boolean;
  countryLabel?: string;
  /** Currency info for the selected country */
  currencyInfo?: CurrencyInfo;
  /** Auto-computed foreign values derived from live exchange rate (read-only) */
  foreignRows?: string[];
  onChangeForeign?: (index: number, value: string) => void;
  /** Live exchange rate (INR per 1 unit of foreign currency) */
  foreignRate?: number | null;
}

export function AnnexureTable({
  rows,
  onChangeInr,
  isForeign = false,
  countryLabel = "Foreign",
  currencyInfo = DEFAULT_CURRENCY,
  foreignRows = [],
  onChangeForeign,
  foreignRate,
}: AnnexureTableProps) {
  const showForeign = isForeign && foreignRate != null && foreignRate > 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
      {/* Header */}
      <div
        className="grid bg-navy-950 px-3 py-2"
        style={{ gridTemplateColumns: isForeign ? "3fr 1.5fr 1.5fr" : "3fr 2fr" }}
        role="row"
      >
        <div className="text-white font-bold text-xs" role="columnheader">Particulars</div>
        <div className="text-white font-bold text-xs" role="columnheader">Indian (Rs.)</div>
        {isForeign && (
          <div className="text-white font-bold text-xs" role="columnheader">
            {countryLabel}
          </div>
        )}
      </div>

      {/* Rows */}
      {rows.map((row, i) => {
        const foreignLabel = showForeign && foreignRate
          ? fmtForeignAmount(row.inr, foreignRate, currencyInfo)
          : "";

        return (
          <div
            key={i}
            className="grid px-3 py-2 border-t border-slate-100"
            style={{
              gridTemplateColumns: isForeign ? "3fr 1.5fr 1.5fr" : "3fr 2fr",
              background: i % 2 === 0 ? "#fff" : "#f8fafc",
            }}
            role="row"
          >
            <div className="text-sm text-slate-700 pr-3 self-center leading-tight" role="cell">
              {row.label}
            </div>

            {/* INR input + live foreign hint */}
            <div className="flex flex-col gap-0.5" role="cell">
              <input
                type="text"
                value={row.inr}
                onChange={(e) => onChangeInr(i, e.target.value)}
                placeholder="Enter amount"
                aria-label={`INR amount for ${row.label}`}
                className="px-2 py-1.5 rounded-md border border-slate-200 text-xs w-full
                  focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
                  transition-colors"
              />
              {showForeign && foreignLabel && (
                <span className="text-[10px] text-navy-700 font-medium pl-1">
                  {foreignLabel}
                </span>
              )}
            </div>

            {/* Foreign column: auto-filled from conversion OR manual entry */}
            {isForeign && (
              <div className="flex flex-col gap-0.5" role="cell">
                {showForeign ? (
                  /* Auto-converted, read-only display */
                  <div
                    className="px-2 py-1.5 rounded-md border border-navy-200 bg-navy-50
                      text-xs w-full text-navy-800 font-semibold"
                    aria-label={`${currencyInfo.code} equivalent for ${row.label}`}
                  >
                    {foreignLabel || <span className="text-slate-400">Auto</span>}
                  </div>
                ) : (
                  /* Manual entry (when no live rate) */
                  <input
                    type="text"
                    value={foreignRows[i] ?? ""}
                    onChange={(e) => onChangeForeign?.(i, e.target.value)}
                    placeholder="Amount"
                    aria-label={`${currencyInfo.code} amount for ${row.label}`}
                    className="px-2 py-1.5 rounded-md border border-slate-200 text-xs w-full
                      focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
                      transition-colors"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Live rate badge */}
      {showForeign && (
        <div className="px-3 py-1.5 bg-navy-50 border-t border-navy-100 flex items-center gap-1.5">
          <Pin className="w-3 h-3 text-navy-600 shrink-0" />
          <span className="text-[10px] text-navy-700">
            Rate used: <strong>1 {currencyInfo.code} = Rs.{foreignRate?.toFixed(2)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
