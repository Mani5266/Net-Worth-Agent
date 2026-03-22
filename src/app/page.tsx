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
import { saveCertificateDraft, updateCertificateDraft, getAllCertificates, getCertificate } from "@/lib/db";
import Link from "next/link";
import { CertificateRecord } from "@/types";
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
  const [history, setHistory] = useState<CertificateRecord[]>([]);

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

  // Fetch History for Sidebar
  const loadHistory = useCallback(async () => {
    if (!session) return;
    try {
      const data = await getAllCertificates();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }, [session]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, certificateId]); // Reload when ID changes (new certificate saved)

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
            setCertificateId(resumeId); // Set state directly to avoid triggering ID persistence logic in a loop
            localStorage.setItem("networth_current_id", resumeId);
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

      // 2. Refresh Persistence / Sidebar Switch: Fetch if ID exists and data is missing or different
      const currentId = localStorage.getItem("networth_current_id");
      if (currentId) {
        try {
          setLoading(true);
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
  }, [setData, session]); // Only run on mount or when session changes

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
    <div className="min-h-screen bg-gray-50/50">
      {!session ? (
        <Auth_UI />
      ) : (
        <div className="flex flex-col lg:flex-row min-h-screen">
          {/* ── Sidebar (Dashboard) ── */}
          <aside className="w-full lg:w-80 bg-white border-b lg:border-r border-gray-200 p-6 flex flex-col no-print">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-emerald-700 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-200">
                N
              </div>
              <h1 className="text-xl font-black text-emerald-900 tracking-tight leading-tight">
                Net Worth<br/>Agent
              </h1>
            </div>

            <Button
              variant="primary"
              className="w-full justify-start gap-2 mb-8 py-3 rounded-xl shadow-md shadow-emerald-100"
              onClick={handleReset}
            >
              <span className="text-lg">➕</span> New Certificate
            </Button>

            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Recent Certificates
                </h2>
                <Link href="/history" className="text-[10px] font-bold text-emerald-700 hover:underline px-1">
                  View All
                </Link>
              </div>

              <div className="space-y-2">
                {history.length === 0 ? (
                  <p className="text-xs text-center text-gray-400 py-8 italic">No drafts yet.</p>
                ) : (
                  history.slice(0, 10).map((cert) => (
                    <button
                      key={cert.id}
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const freshData = await getCertificate(cert.id);
                          setData(freshData);
                          updateCertificateId(cert.id);
                          setStep(0); // Reset to first step when switching
                        } catch (err) {
                          console.error("Failed to switch certificate:", err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all border group ${
                        certificateId === cert.id 
                          ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100" 
                          : "bg-white border-transparent hover:border-gray-200 hover:bg-gray-50/50"
                      }`}
                    >
                      <p className="text-[13px] font-bold text-gray-800 line-clamp-1 group-hover:text-emerald-800 transition-colors">
                        {cert.clientName || "Unnamed Client"}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(cert.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded leading-none ${
                        cert.status === 'completed' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {cert.status}
                      </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                    {session.user?.email?.[0].toUpperCase()}
                  </div>
                  <p className="text-[11px] font-bold text-gray-600 truncate">
                    {session.user?.email}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Sign Out"
                >
                  🔒
                </button>
              </div>
            </div>
          </aside>

          {/* ── Main Content (Wizard) ── */}
          <main className="flex-1 px-4 py-8 lg:p-12 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              {/* ── Progress Bar ── */}
              <div className="no-print mb-8">
                <ProgressBar
                  steps={STEPS}
                  currentStep={step}
                  onClickStep={(i) => i < step && setStep(i)}
                />
              </div>

              {/* Draft Saved Indicator */}
              <div className="h-6 flex justify-end no-print mb-2">
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
              <div key={step} className="animate-fade-in relative">
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
              <div className="flex justify-between mt-8 no-print border-t border-gray-100 pt-6">
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
          </main>
        </div>
      )}
    </div>
  );
}
