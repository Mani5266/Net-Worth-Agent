"use client";

import { useState } from "react";
import type { AuditEntry } from "@/types";
import { STEPS } from "@/constants";

interface AuditLogProps {
  entries: AuditEntry[];
}

/**
 * Collapsible audit trail viewer showing all field changes
 * made during the certificate preparation session.
 */
export function AuditLog({ entries }: AuditLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (entries.length === 0) {
    return null;
  }

  // Group entries by step for cleaner display
  const stepLabel = (step: number): string => {
    const s = STEPS[step];
    return s ? `${s.label}` : `Step ${step}`;
  };

  const formatTime = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const truncate = (str: string, max: number): string =>
    str.length > max ? str.slice(0, max) + "..." : str;

  return (
    <div className="no-print mt-6 border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-700">
          Audit Trail ({entries.length} change{entries.length !== 1 ? "s" : ""})
        </span>
        <span className="text-slate-400 text-lg">{isOpen ? "-" : "+"}</span>
      </button>

      {isOpen && (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Time</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Step</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Field</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Old Value</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">New Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice().reverse().map((entry, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                    {formatTime(entry.timestamp)}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                    {stepLabel(entry.step)}
                  </td>
                  <td className="px-3 py-1.5 text-slate-800 font-medium">
                    {entry.fieldLabel}
                  </td>
                  <td className="px-3 py-1.5 text-red-600">
                    {truncate(entry.oldValue, 30) || "-"}
                  </td>
                  <td className="px-3 py-1.5 text-navy-700">
                    {truncate(entry.newValue, 30) || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
