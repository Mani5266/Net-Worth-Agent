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
import { saveCertificateDraft, updateCertificateDraft, getAllCertificates, getCertificate, renameCertificate, deleteCertificate } from "@/lib/db";
import Link from "next/link";
import { CertificateRecord, PurposeValue } from "@/types";
import { Auth_UI } from "@/components/auth/Auth";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export default function HomePage() {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  const handleRename = async (id: string) => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await renameCertificate(id, editValue.trim());
      if (id === certificateId) {
        setData(prev => ({ ...prev, nickname: editValue.trim() }));
      }
      setEditingId(null);
      loadHistory();
    } catch (err) {
      console.error("Failed to rename:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this certificate?")) return;
    try {
      await deleteCertificate(id);
      if (certificateId === id) {
        handleReset();
      }
      await loadHistory();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  // Auto-save logic
  const handleSave = useCallback(async (currentStep: number) => {
    try {
      setSaving(true);
      
      const newData = { ...data };
      // Auto-name from purpose if nickname is empty (only on step 0)
      if (currentStep === 0 && !newData.nickname && newData.purpose) {
        newData.nickname = newData.purpose.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setData(newData);
      }

      if (currentStep === 0 && !certificateId) {
        const id = await saveCertificateDraft(newData);
        updateCertificateId(id);
      } else if (certificateId) {
        await updateCertificateDraft(certificateId, newData);
      }
      
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save draft:", err);
    } finally {
      setSaving(false);
    }
  }, [certificateId, data, updateCertificateId, setData]);

  const handleNext = async () => {
    // ── Validation ─────────────────────────────────────────────────────────────
    setValidationError(null);
    let error: string | null = null;

    if (step === 0) {
      if (!data.purpose) error = "Please select the purpose of the certificate.";
      else if (isForeignPurpose(data.purpose) && !data.country) error = "Please select the destination country.";
    } else if (step === 1) {
      if (!data.fullName.trim()) error = "Applicant Name is required.";
      else if (!data.pan.trim()) error = "PAN Number is required.";
    } else if (step === 2) {
      if (data.incomeTypes.length === 0) error = "Please select at least one income source.";
    } else if (step === 3) {
      if (data.immovableTypes.length > 0 && !data.propertyAddress.trim()) error = "Property address is required since you selected immovable assets.";
    } else if (step === 5) {
      if (data.savingsTypes.includes("Bank-Related Assets") && !data.bankDetails.trim()) error = "Bank account details are required.";
      else if (data.savingsTypes.length === 0) error = "Please select at least one savings category.";
    }

    if (error) {
      setValidationError(error);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see types/inputs if needed, or just focus
      return;
    }

    await handleSave(step);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo(0, 0);
  };

  const isF = isForeignPurpose(data.purpose);
  const { usdRate: liveRate, fetchedAt } = useExchangeRate();
  const overrideRate = data.exchangeRate ? parseFloat(data.exchangeRate) : null;
  const usdRate = overrideRate && overrideRate > 0 ? overrideRate : liveRate;

  // ── Copy to Clipboard ────────────────────────────────────────────────────────
  const copyText = useCallback(() => {
    const text = buildCertificateText(data);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

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
                <Button variant="secondary" size="sm" onClick={copyText}>
                  {copied ? "✓ Copied!" : "📋 Copy Text"}
                </Button>
                <Button variant="secondary" size="sm" onClick={printCertificate}>
                  🖨️ Print
                </Button>
              </div>
            </div>

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
                    <div
                      key={cert.id}
                      className={`relative group w-full rounded-xl transition-all border ${
                        certificateId === cert.id 
                          ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100" 
                          : "bg-white border-transparent hover:border-gray-200 hover:bg-gray-50/50"
                      }`}
                    >
                      {editingId === cert.id ? (
                        <div className="p-3">
                          <input
                            autoFocus
                            className="w-full text-[13px] font-bold bg-white border border-emerald-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleRename(cert.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(cert.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              setLoading(true);
                              const freshData = await getCertificate(cert.id);
                              setData(freshData);
                              updateCertificateId(cert.id);
                              setStep(0);
                            } catch (err) {
                              console.error("Failed to switch certificate:", err);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="w-full text-left p-3 pr-10"
                        >
                          <p className="text-[13px] font-bold text-gray-800 line-clamp-1 group-hover:text-emerald-800 transition-colors">
                            {cert.nickname || cert.clientName || "Unnamed Client"}
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
                      )}
                      
                      {editingId !== cert.id && (
                        <div className="absolute right-2 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(cert.id);
                              setEditValue(cert.nickname || cert.clientName || "");
                            }}
                            className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                            title="Rename"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(cert.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
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
              <div className="mt-8 no-print border-t border-gray-100 pt-6">
                {validationError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs font-bold animate-shake">
                    <span>⚠️</span> {validationError}
                  </div>
                )}
                <div className="flex justify-between">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setValidationError(null);
                      setStep((s) => Math.max(0, s - 1));
                    }}
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
          </main>
        </div>
      )}
    </div>
  );
}
