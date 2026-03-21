"use client";

import { useState, useRef, useCallback } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui";
import { StepPurpose } from "@/components/steps/StepPurpose";
import { StepApplicant } from "@/components/steps/StepApplicant";
import {
  StepIncome,
  StepImmovable,
  StepMovable,
  StepSavings,
} from "@/components/steps/AnnexureSteps";
import { CertificatePreview } from "@/components/certificate/CertificatePreview";
import { useFormData } from "@/hooks/useFormData";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { STEPS } from "@/constants";
import { isForeignPurpose, buildCertificateText } from "@/lib/utils";

export default function HomePage() {
  const [step, setStep] = useState(0);
  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  const {
    data,
    updateField,
    toggleArrayItem,
    updateLabel,
    updateAnnexureRow,
    updateForeignRow,
    updateSavingsRow,
    updateSavingsFR,
    addPolicy,
    updatePolicy,
    removePolicy,
    addIncomeDocs,
    removeIncomeDoc,
    addImmovableDocs,
    removeImmovableDoc,
    addMovableDocs,
    removeMovableDoc,
    addSavingsDocs,
    removeSavingsDoc,
  } = useFormData();

  const isF = isForeignPurpose(data.purpose);

  // Use manual override if provided, otherwise use live rate
  const { usdRate: liveRate, fetchedAt } = useExchangeRate();
  const overrideRate = data.exchangeRate ? parseFloat(data.exchangeRate) : null;
  const usdRate = overrideRate && overrideRate > 0 ? overrideRate : liveRate;

  // ── AI Generation ────────────────────────────────────────────────────────────
  const generateWithAI = useCallback(async () => {
    setAiLoading(true);
    setAiError("");
    setAiText("");
    try {
      const res = await fetch("/api/generate-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data }),
      });
      const json = await res.json();
      if (json.success) {
        setAiText(json.text);
      } else {
        setAiError(json.error || "Generation failed.");
      }
    } catch {
      setAiError("Network error. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }, [data]);

  // ── Copy to Clipboard ────────────────────────────────────────────────────────
  const copyText = useCallback(() => {
    const text = aiText || buildCertificateText(data);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [aiText, data]);

  // ── Print ────────────────────────────────────────────────────────────────────
  const printCertificate = () => window.print();

  // ── Step Content Map ─────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepPurpose
            data={data}
            onChange={updateField}
          />
        );
      case 1:
        return (
          <StepApplicant
            data={data}
            onChange={updateField}
          />
        );
      case 2:
        return (
          <StepIncome
            data={data}
            isForeign={isF}
            toggleType={toggleArrayItem("incomeTypes")}
            updateRow={updateAnnexureRow("incomeRows")}
            updateForeignRow={updateForeignRow("incomeFR")}
            updateField={updateField}
            updateLabel={updateLabel("incomeLabels")}
            addIncomeDocs={addIncomeDocs}
            removeIncomeDoc={removeIncomeDoc}
            usdRate={isF ? usdRate : undefined}
          />
        );
      case 3:
        return (
          <StepImmovable
            data={data}
            isForeign={isF}
            toggleType={toggleArrayItem("immovableTypes")}
            updateRow={updateAnnexureRow("immovableRows")}
            updateForeignRow={updateForeignRow("immovableFR")}
            updateField={updateField}
            updateLabel={updateLabel("immovableLabels")}
            addImmovableDocs={addImmovableDocs}
            removeImmovableDoc={removeImmovableDoc}
            usdRate={isF ? usdRate : undefined}
          />
        );
      case 4:
        return (
          <StepMovable
            data={data}
            isForeign={isF}
            toggleType={toggleArrayItem("movableTypes")}
            updateRow={updateAnnexureRow("movableRows")}
            updateForeignRow={updateForeignRow("movableFR")}
            updateField={updateField}
            updateLabel={updateLabel("movableLabels")}
            addMovableDocs={addMovableDocs}
            removeMovableDoc={removeMovableDoc}
            usdRate={isF ? usdRate : undefined}
          />
        );
      case 5:
        return (
          <StepSavings
            data={data}
            isForeign={isF}
            toggleType={toggleArrayItem("savingsTypes")}
            toggleDoc={toggleArrayItem("supportingDocs")}
            updateSavingsRow={updateSavingsRow}
            updateSavingsFR={updateSavingsFR}
            updateField={updateField}
            updateLabel={updateLabel("savingsLabels")}
            addPolicy={addPolicy}
            updatePolicy={updatePolicy}
            removePolicy={removePolicy}
            addSavingsDocs={addSavingsDocs}
            removeSavingsDoc={removeSavingsDoc}
            usdRate={isF ? usdRate : undefined}
          />
        );
      case 6:
        return (
          <div>
            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
              <h2 className="text-lg font-bold text-emerald-800 m-0">
                📄 Net Worth Certificate
              </h2>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateWithAI}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </span>
                  ) : (
                    "✨ Refine with AI"
                  )}
                </Button>
                <Button variant="secondary" size="sm" onClick={copyText}>
                  {copied ? "✓ Copied!" : "📋 Copy Text"}
                </Button>
                <Button variant="secondary" size="sm" onClick={printCertificate}>
                  🖨️ Print
                </Button>
              </div>
            </div>

            {aiError && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {aiError}
              </div>
            )}

            {/* AI text panel */}
            {aiText && (
              <div className="mb-5 no-print">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    ✨ AI-Refined Version
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto text-gray-800">
                  {aiText}
                </div>
              </div>
            )}

            {/* Certificate preview */}
            <div className="print-full">
              <CertificatePreview ref={certRef} data={data} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div className="text-center mb-10 no-print">
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-800 to-emerald-600 tracking-tight transition-all duration-500 hover:scale-[1.01] cursor-default">
            Net Worth Certificate Agent
          </h1>
          {isF && usdRate && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                {overrideRate
                  ? `₹${overrideRate.toFixed(2)} (Manual rate)`
                  : `₹${liveRate?.toFixed(2)} (Live rate)`}
              </span>
              {!overrideRate && fetchedAt && (
                <span className="text-[10px] text-gray-400">
                  updated {new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Progress Bar ── */}
        <div className="no-print">
          <ProgressBar
            steps={STEPS}
            currentStep={step}
            onClickStep={(i) => i < step && setStep(i)}
          />
        </div>

        {/* ── Step Content ── */}
        <div key={step} className="animate-fade-in">
          {renderStep()}
        </div>

        {/* ── Navigation ── */}
        <div className="flex justify-between mt-4 no-print">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            ← Back
          </Button>

          {step < STEPS.length - 1 && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              {step === STEPS.length - 2 ? "View Certificate →" : "Next →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
