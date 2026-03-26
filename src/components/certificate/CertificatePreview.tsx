"use client";

import { forwardRef } from "react";
import type { FormData } from "@/types";
import {
  isForeignPurpose,
  getPurposePhrase,
  getPossessivePronoun,
  formatCertDate,
  formatINR,
  formatForeign,
  parseAmount,
  computeTotals,
  buildSavingsRows,
  buildMovableRows,
  numberToWordsINR,
} from "@/lib/utils";

interface CertificateProps {
  data: FormData;
}

// Table header style
const TH: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #1a5c3e",
  fontWeight: 700,
  background: "#1a5c3e",
  color: "#fff",
  fontSize: 12,
  textAlign: "left",
};

// Table cell style
function td(extra: React.CSSProperties = {}): React.CSSProperties {
  return { padding: "6px 10px", border: "1px solid #b0b0b0", fontSize: 12, ...extra };
}

interface AnnexTableProps {
  rows: { label: string; inr: string }[];
  total: number;
}

function AnnexTable({ rows, total }: AnnexTableProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
      <thead>
        <tr>
          <th style={TH}>Particulars</th>
          <th style={{ ...TH, width: 160, textAlign: "right" }}>Indian (Rs.)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const label = row.label;
          return (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <td style={td()}>{label}</td>
              <td style={td({ textAlign: "right" })}>
                {row.inr ? formatINR(parseAmount(row.inr)) : ""}
              </td>
            </tr>
          );
        })}
        <tr style={{ background: "#f0fdf4" }}>
          <td style={td({ fontWeight: 700 })}><strong>Total</strong></td>
          <td style={td({ textAlign: "right", fontWeight: 700 })}><strong>{formatINR(total)}</strong></td>
        </tr>
      </tbody>
    </table>
  );
}

export const CertificatePreview = forwardRef<HTMLDivElement, CertificateProps>(
  function CertificatePreview({ data }, ref) {
    const isF = isForeignPurpose(data.purpose);
    const name = `${data.salutation} ${data.fullName || "[Name of Applicant]"}`;
    const dateStr = formatCertDate(data.certDate);
    const purposeTxt = getPurposePhrase(data.purpose, data.country);
    const totals = computeTotals(data);
    const pronoun = getPossessivePronoun(data.salutation);

    // Build person-based income rows:
    //   "Income of the Applicant – Mankala Akhil"
    //   "Income of the Applicant's Father – Ramesh Kumar"
    const incRows = data.incomeTypes.length > 0
      ? data.incomeTypes.map((person, i) => {
          const personName = data.incomeLabels[person]?.trim()
            || (person === "Self" ? (data.fullName || "[Name]") : "[Name]");
          const base = person === "Self"
            ? "Income of the Applicant"
            : `Income of the Applicant\u2019s ${person}`;
          const label = `${base} \u2013 ${personName}`;
          return { label, inr: data.incomeRows[i]?.inr ?? "" };
        })
      : [{ label: "Income of the Applicant", inr: "" }];

    // Immovable rows are now pre-built with person-based labels by StepImmovable.
    // If immovableProperties exist (new model), use immovableRows directly.
    // Fall back to old single-address logic for backward compat with old drafts.
    const hasNewModel = Object.keys(data.immovableProperties ?? {}).length > 0;
    const immRows = hasNewModel
      ? (data.immovableRows.length > 0
          ? data.immovableRows
          : [{ label: "Address of the immovable property and its details.", inr: "" }])
      : data.immovableRows.map((row, i) => {
          // Legacy: single propertyAddress applied to first row
          if (i === 0 && data.propertyAddress) {
            return { ...row, label: `Address of the immovable property \u2014 ${data.propertyAddress}` };
          }
          return row;
        });

    // Movable rows: if movableAssets exist (new person-based model), use movableRows directly.
    // Fall back to old buildMovableRows for backward compat with old drafts.
    const hasNewMovableModel = Object.keys(data.movableAssets ?? {}).length > 0;
    const movRows = hasNewMovableModel
      ? (data.movableRows.length > 0
          ? data.movableRows
          : [{ label: "Specify movable asset details", inr: "" }])
      : buildMovableRows(data).map((row, i) => ({
          ...row,
          inr: data.movableRows[i]?.inr || "",
        }));

    // Savings rows: if savingsEntries exist (new person-based model), use savingsRows directly.
    // Fall back to old buildSavingsRows for backward compat with old drafts.
    const hasNewSavingsModel = Object.keys(data.savingsEntries ?? {}).length > 0;
    const savRows = hasNewSavingsModel
      ? ((data.savingsRows ?? []).length > 0
          ? (data.savingsRows ?? [])
          : [{ label: "Savings Details", inr: "" }])
      : buildSavingsRows(data).map((row, i) => ({
          ...row,
          label: row.label || `Savings Entry ${i + 1}`,
          inr: data.savingsRows?.[i]?.inr || "",
        }));
    
    // Combine manual checkmarks with uploaded file names for the "compiled from" list
    const incomeFileNames = Object.values(data.incomeDocs).flatMap(docs => docs.map(d => d.name));
    const immovableFileNames = Object.values(data.immovableDocs).flatMap(docs => docs.map(d => d.name));
    const movableFileNames = Object.values(data.movableDocs).flatMap(docs => docs.map(d => d.name));
    const savingsFileNames = Object.values(data.savingsDocs).flatMap(docs => docs.map(d => d.name));
    const baseDocs = data.supportingDocs.length > 0 ? data.supportingDocs : [
      "Income tax return copies of Applicant.",
      "Valuation/self-declaration documents of immovable properties.",
    ];
    const docs = [...baseDocs, ...incomeFileNames, ...immovableFileNames, ...movableFileNames, ...savingsFileNames];

    const cl = data.country || "Foreign Currency";
    const overrideRate = data.exchangeRate ? parseFloat(data.exchangeRate) : null;

    // Helper to resolve custom label for display
    const getDisplayTypes = (types: string[], labels: Record<string, string>) => 
      types.map(t => labels[t]?.trim() ? `${t} (${labels[t].trim()})` : t).join(", ");

    return (
      <div
        ref={ref}
        style={{
          fontFamily: "'Book Antiqua', Georgia, serif",
          fontSize: 13,
          color: "#111",
          lineHeight: 1.9,
          background: "#fff",
          padding: 36,
          borderRadius: 8,
          border: "1.5px solid #ccc",
        }}
      >
        {/* ── Header ── */}
        <p style={{ textAlign: "center", fontWeight: 700, fontSize: 16, margin: "0 0 4px" }}>
          TO WHOMSOEVER IT MAY CONCERN
        </p>
        <p style={{ textAlign: "center", fontWeight: 700, fontSize: 19, textDecoration: "underline", margin: "0 0 24px" }}>
          NETWORTH CERTIFICATE
        </p>

        {/* ── Body paragraph ── */}
        <p style={{ textAlign: "justify", marginBottom: 16 }}>
          I, <strong>{data.signatoryName || "[Signatory Name]"}</strong>, member of The Institute of Chartered Accountants of
          India, do hereby certify that I have reviewed the financial condition of the Applicant,{" "}
          <strong style={{ textDecoration: "underline" }}>{name}</strong>, with the view to furnish
          {" "}{pronoun} net worth <em>{purposeTxt}</em>. The Below detail of the assets are obtained as on{" "}
          <strong>{dateStr}</strong>
        </p>

        {/* ── Summary Table ── */}
        {!isF ? (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 50, textAlign: "center" }}>Sl. No.</th>
                <th style={TH}>SOURCES OF FUNDS</th>
                <th style={{ ...TH, width: 150, textAlign: "right" }}>INDIAN (Rs.)</th>
                <th style={{ ...TH, width: 140, textAlign: "center" }}>REFERENCE (ANNEXURES)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { n: "1.",  l: "Current Income",    v: formatINR(totals.incomeINR),    r: "I" },
                { n: "2.", l: "Immovable Assets",   v: formatINR(totals.immovableINR), r: "II" },
                { n: "3.", l: "Movable Properties", v: formatINR(totals.movableINR),   r: "III" },
                { n: "4.", l: "Current Savings",    v: formatINR(totals.savingsINR),   r: "IV" },
              ].map((row) => (
                <tr key={row.n}>
                  <td style={td({ textAlign: "center" })}><strong>{row.n}</strong></td>
                  <td style={td()}><strong>{row.l}</strong></td>
                  <td style={td({ textAlign: "right" })}><strong>{row.v}</strong></td>
                  <td style={td({ textAlign: "center" })}><strong>{row.r}</strong></td>
                </tr>
              ))}
              <tr style={{ background: "#f0fdf4" }}>
                <td style={td()} colSpan={2}><strong><u>Total</u></strong></td>
                <td style={td({ textAlign: "right" })}><strong>{formatINR(totals.grandINR)}</strong></td>
                <td style={td()} />
              </tr>
              <tr>
                <td style={td({ fontSize: 11, fontStyle: "italic", color: "#374151" })} colSpan={4}>
                  ({numberToWordsINR(totals.grandINR)})
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 45, textAlign: "center" }}>Sl. No.</th>
                  <th style={TH}>SOURCES OF FUNDS</th>
                  <th style={{ ...TH, width: 120, textAlign: "right" }}>INDIAN (Rs.)</th>
                  <th style={{ ...TH, width: 120, textAlign: "right" }}>{cl}</th>
                  <th style={{ ...TH, width: 120, textAlign: "center" }}>REFERENCE (ANNEXURES)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { n: "1.",  l: "Current Income",    v: formatINR(totals.incomeINR),    f: formatForeign(totals.incomeForeign),    r: "I" },
                  { n: "2.", l: "Immovable Assets",   v: formatINR(totals.immovableINR), f: formatForeign(totals.immovableForeign), r: "II" },
                  { n: "3.", l: "Movable Properties", v: formatINR(totals.movableINR),   f: formatForeign(totals.movableForeign),   r: "III" },
                  { n: "4.", l: "Current Savings",    v: formatINR(totals.savingsINR),   f: formatForeign(totals.savingsForeign),   r: "IV" },
                ].map((row) => (
                  <tr key={row.n}>
                    <td style={td({ textAlign: "center" })}><strong>{row.n}</strong></td>
                    <td style={td()}><strong>{row.l}</strong></td>
                    <td style={td({ textAlign: "right" })}><strong>{row.v}</strong></td>
                    <td style={td({ textAlign: "right" })}><strong>{row.f}</strong></td>
                    <td style={td({ textAlign: "center" })}><strong>{row.r}</strong></td>
                  </tr>
                ))}
                <tr style={{ background: "#f0fdf4" }}>
                  <td style={td()} colSpan={2}><strong><u>Total</u></strong></td>
                  <td style={td({ textAlign: "right" })}><strong>{formatINR(totals.grandINR)}</strong></td>
                  <td style={td({ textAlign: "right" })}><strong>{formatForeign(totals.grandForeign)}</strong></td>
                  <td style={td()} />
                </tr>
                <tr>
                  <td style={td({ fontSize: 11, fontStyle: "italic", color: "#374151" })} colSpan={5}>
                    ({numberToWordsINR(totals.grandINR)})
                  </td>
                </tr>
              </tbody>
            </table>
            {overrideRate && (
              <p style={{ fontSize: 10, color: "#666", textAlign: "right", margin: "0 0 20px" }}>
                * Foreign currency converted at the rate of 1 USD = ₹{overrideRate.toFixed(2)} as on {dateStr}
              </p>
            )}
          </div>
        )}

        {/* ── Supporting Documents ── */}
        <p style={{ marginBottom: 6 }}>
          The above figures are compiled from the following documents and certificates submitted
          before me:
        </p>
        <ol style={{ marginLeft: 22, marginBottom: 20 }}>
          {docs.map((doc, i) => (
            <li key={i} style={{ marginBottom: 3 }}>{doc}</li>
          ))}
        </ol>

        {/* ── ANNEXURE I ── */}
        <p style={{ fontWeight: 700, margin: "0 0 6px" }}>
          <strong>ANNEXURE-I&nbsp;&nbsp;&nbsp;&nbsp;CURRENT INCOME</strong>
        </p>
        {data.incomeTypes.length > 0 && (
          <p style={{ fontSize: 12, color: "#374151", margin: "0 0 8px" }}>
            <em>Income Declared For: {getDisplayTypes(data.incomeTypes, data.incomeLabels)}</em>
          </p>
        )}
        <AnnexTable rows={incRows} total={totals.incomeINR} />

        {/* ── ANNEXURE II ── */}
        <p style={{ fontWeight: 700, margin: "0 0 6px" }}>
          <strong>ANNEXURE – II&nbsp;&nbsp;&nbsp;&nbsp;IMMOVABLE ASSETS</strong>
        </p>
        {data.immovableTypes.length > 0 && (
          <p style={{ fontSize: 12, color: "#374151", margin: "0 0 8px" }}>
            <em>Properties Declared For: {getDisplayTypes(data.immovableTypes, data.immovableLabels)}</em>
          </p>
        )}
        <AnnexTable
          rows={immRows}
          total={totals.immovableINR}
        />

        {/* ── ANNEXURE III ── */}
        <p style={{ fontWeight: 700, margin: "0 0 6px" }}>
          <strong>ANNEXURE – III&nbsp;&nbsp;&nbsp;&nbsp;MOVABLE PROPERTIES</strong>
        </p>
        {data.movableTypes.length > 0 && (
          <p style={{ fontSize: 12, color: "#374151", margin: "0 0 8px" }}>
            <em>Assets Declared For: {getDisplayTypes(data.movableTypes, data.movableLabels)}</em>
          </p>
        )}
        <AnnexTable
          rows={movRows}
          total={totals.movableINR}
        />

        {/* ── ANNEXURE IV ── */}
        <p style={{ fontWeight: 700, margin: "0 0 6px" }}>
          <strong>ANNEXURE – IV&nbsp;&nbsp;&nbsp;&nbsp;CURRENT SAVINGS</strong>
        </p>
        {data.savingsTypes.length > 0 && (
          <p style={{ fontSize: 12, color: "#374151", margin: "0 0 8px" }}>
            <em>Savings Declared For: {getDisplayTypes(data.savingsTypes, data.savingsLabels)}</em>
          </p>
        )}
        <AnnexTable rows={savRows} total={totals.savingsINR} />

        {/* ── Signature Block ── */}
        <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 36 }}>
          <div>
            <p style={{ margin: "0 0 2px" }}><strong>For {data.firmName || "[Firm Name]"},</strong></p>
            <p style={{ margin: "0 0 2px" }}>{data.firmType || "Chartered Accountants"},</p>
            <p style={{ margin: "0 0 18px" }}>FRN {data.firmFRN || "[FRN]"}</p>
            <p style={{ margin: "0 0 2px" }}><strong>{data.signatoryName || "[Signatory Name]"}</strong></p>
            <p style={{ margin: "0 0 2px" }}>{data.signatoryTitle || "[Designation]"}</p>
            <p style={{ margin: "0 0 18px" }}>Membership No. {data.membershipNo || "[Membership No.]"}</p>
            <p style={{ margin: "0 0 2px" }}>Date: {dateStr}</p>
            <p style={{ margin: "0 0 2px" }}>Place: {data.signPlace || "[Place]"}</p>
            <p style={{ margin: 0 }}>UDIN: {data.udin || "__________________________"}</p>
          </div>
        </div>
      </div>
    );
  }
);
