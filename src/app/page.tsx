"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { useFormData, INITIAL_STATE } from "@/hooks/useFormData";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { STEPS } from "@/constants";
import { isForeignPurpose, buildCertificateText } from "@/lib/utils";
import { saveCertificateDraft, updateCertificateDraft } from "@/lib/db";
import Link from "next/link";
import { Auth_UI } from "@/components/auth/Auth";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export default function HomePage() {
  const [step, setStep] = useState(0);
  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  const {
    data, updateField, toggleArrayItem, updateLabel, updateAnnexureRow,
    updateForeignRow, updateSavingsRow, updateSavingsFR, addPolicy,
    updatePolicy, removePolicy, addIncomeDocs, removeIncomeDoc,
    addImmovableDocs, removeImmovableDoc, addMovableDocs, removeMovableDoc,
    addSavingsDocs, removeSavingsDoc, setData,
  } = useFormData();

  // Supabase Integration State
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Auth Sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = () => {
    supabase.auth.signOut();
    updateCertificateId(null);
  };

  // Persistence: Store current ID in localStorage
  const updateCertificateId = useCallback((id: string | null) => {
    setCertificateId(id);
    if (id) {
      localStorage.setItem("networth_current_id", id);
    } else {
      localStorage.removeItem("networth_current_id");
    }
  }, []);

  // Resume / Reload Logic
  useEffect(() => {
    const handleInit = async () => {
      // 1. Check for manual Resume/View (from History page)
      const resumeData = localStorage.getItem("networth_resume_data");
      const resumeId = localStorage.getItem("networth_resume_id");
      const viewOnly = localStorage.getItem("networth_view_only");

      if (resumeData && resumeId) {
        try {
          const parsed = JSON.parse(resumeData);
          if (parsed.purpose !== undefined) {
            setData(parsed);
            updateCertificateId(resumeId);
            if (viewOnly === "true") setStep(6);
            return;
          }
        } catch (err) { console.error(err); }
        finally {
          localStorage.removeItem("networth_resume_data");
          localStorage.removeItem("networth_resume_id");
          localStorage.removeItem("networth_view_only");
        }
      }

      // 2. Refresh Persistence: Check for current session ID
      const currentId = localStorage.getItem("networth_current_id");
      if (currentId && !certificateId) {
        try {
          setLoading(true);
          const { getCertificate } = await import("@/lib/db");
          const freshData = await getCertificate(currentId);
          setData(freshData);
          setCertificateId(currentId);
        } catch (err) {
          console.error("Failed to restore session:", err);
          localStorage.removeItem("networth_current_id");
        } finally {
          setLoading(false);
        }
      }
    };

    handleInit();
  }, [setData, updateCertificateId, certificateId]);

  // Reset / New Certificate
  const handleReset = useCallback(() => {
    if (window.confirm("Are you sure you want to start a new certificate? This will clear all current inputs.")) {
      setData(INITIAL_STATE);
      setStep(0);
      updateCertificateId(null);
      window.scrollTo(0, 0);
    }
  }, [setData, updateCertificateId]);

  // Auto-save logic
  const handleSave = useCallback(async (currentStep: number) => {
    try {
      setSaving(true);
      if (currentStep === 0 && !certificateId) {
        const id = await saveCertificateDraft(data);
        updateCertificateId(id);
      } else if (certificateId) {
        await updateCertificateDraft(certificateId, data);
      }
      
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save draft:", err);
    } finally {
      setSaving(false);
    }
  }, [certificateId, data, updateCertificateId]);

  const handleNext = async () => {
    await handleSave(step);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const isF = isForeignPurpose(data.purpose);
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
            addIncomeDocs={(type, files) => addIncomeDocs(type, files, certificateId || undefined)}
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
            addImmovableDocs={(type, files) => addImmovableDocs(type, files, certificateId || undefined)}
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
            addMovableDocs={(type, files) => addMovableDocs(type, files, certificateId || undefined)}
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
            addSavingsDocs={(type, files) => addSavingsDocs(type, files, certificateId || undefined)}
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
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link 
              href="/history" 
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors uppercase tracking-widest flex items-center gap-1"
            >
              📋 View History
            </Link>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleReset}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors uppercase tracking-widest flex items-center gap-1"
            >
              ➕ New Certificate
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleSignOut}
              className="text-[11px] font-bold text-red-600 hover:text-red-800 transition-colors uppercase tracking-widest flex items-center gap-1"
            >
              🔒 Sign Out
            </button>
          </div>
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

        {/* Draft Saved Indicator */}
        <div className="h-6 flex justify-end no-print">
          {draftSaved && (
            <span className="text-[10px] font-bold text-emerald-600 animate-bounce">
              Draft saved ✓
            </span>
          )}
          {saving && (
            <span className="text-[10px] font-bold text-emerald-600 animate-pulse">
              Saving draft...
            </span>
          )}
        </div>

        {/* ── Step Content ── */}
        <div key={step} className="animate-fade-in">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-500 animate-pulse">Restoring your draft...</p>
            </div>
          ) : (
            renderStep()
          )}
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
              onClick={handleNext}
              disabled={saving}
            >
              {saving ? "Saving..." : (step === STEPS.length - 2 ? "View Certificate →" : "Next →")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
