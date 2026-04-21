"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button, Input } from "@/components/ui";
import { Sidebar } from "@/components/Sidebar";
import { WizardNav } from "@/components/WizardNav";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { StepPurpose } from "@/components/steps/StepPurpose";
import { StepApplicant } from "@/components/steps/StepApplicant";
import { StepIncome } from "@/components/steps/StepIncome";
import { StepImmovable } from "@/components/steps/StepImmovable";
import { StepMovable } from "@/components/steps/StepMovable";
import { StepSavings } from "@/components/steps/StepSavings";
import { StepSignatory } from "@/components/steps/StepSignatory";
import { CertificatePreview } from "@/components/certificate/CertificatePreview";
import { AuditLog } from "@/components/AuditLog";
import { FormDataProvider, useFormContext } from "@/hooks/useFormContext";
import { INITIAL_STATE } from "@/hooks/useFormData";
import { STEPS } from "@/constants";
import { buildCertificateText, computeTotals, formatINR, parseAmount } from "@/lib/utils";
import { validateFormStep, getValidationMessages, validateAmountsForCertificate } from "@/lib/validation";
import { deepMergeFormData } from "@/lib/merge";
import {
  saveCertificateDraft,
  updateCertificateDraft,
  getAllCertificates,
  getCertificate,
  renameCertificate,
  deleteCertificate,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { CertificateRecord } from "@/types";
import type { FormData } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { StepSkeleton } from "@/components/ui/Skeleton";

// ─── Main Page (wraps inner content with FormDataProvider) ───────────────────

export default function HomePage() {
  return (
    <FormDataProvider>
      <WizardShell />
    </FormDataProvider>
  );
}

// ─── Wizard Shell (consumes FormDataContext) ─────────────────────────────────

function WizardShell() {
  const { data, setData, updateField, resetStep, auditEntries, clearAudit } = useFormContext();
  const { toast } = useToast();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  // Client-side auth guard — verify session on mount + listen for sign-out
  useEffect(() => {
    let cancelled = false;

    // 1. Check session immediately on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setAuthReady(true);
    });

    // 2. Listen for auth state changes (sign-out, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  // Initialize step; restore from localStorage after mount to avoid hydration mismatch
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [amountWarnings, setAmountWarnings] = useState<string[]>([]);
  const certRef = useRef<HTMLDivElement>(null);

  // FIX 1: Keep a ref to latest data so handleSave never reads stale closure
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // FIX 3: Ref-based mutex to prevent double-click duplicate saves
  const savingRef = useRef(false);

  // Phase 3 FIX 7: Track unsaved changes — warn before tab close
  const dirtyRef = useRef(false);
  const initialDataRef = useRef(data);

  // Mark dirty whenever data changes (except initial mount)
  useEffect(() => {
    if (initialDataRef.current !== data) {
      dirtyRef.current = true;
    }
  }, [data]);

  // Attach beforeunload handler — warns user about unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Restore saved step from localStorage on mount, then persist on change
  useEffect(() => {
    const saved = localStorage.getItem("networth_current_step");
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < STEPS.length) {
        setStep(parsed);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("networth_current_step", String(step));
  }, [step]);

  // Supabase state
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CertificateRecord[]>([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [aiFlashKey, setAiFlashKey] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'll help you fill out your net worth certificate. Let's start \u2014 what is the purpose of this certificate? (e.g. Travelling Visa, Study Loan, Bank Finance, etc.)",
    },
  ]);
  const [chatExtractedData, setChatExtractedData] = useState<Partial<FormData>>({});

  // ── AI Chat → Form real-time binding ─────────────────────────────────────

  const handleExtractedData = useCallback(
    (extracted: Partial<FormData>) => {
      setData((prev) => deepMergeFormData(prev, extracted) as FormData);
      // Trigger gold flash on form area
      setAiFlashKey((k) => k + 1);
    },
    [setData]
  );

  // ── Persistence helpers ──────────────────────────────────────────────────

  const updateCertificateId = useCallback((id: string | null) => {
    setCertificateId(id);
    if (id) {
      localStorage.setItem("networth_current_id", id);
    } else {
      localStorage.removeItem("networth_current_id");
    }
  }, []);

  // ── Load sidebar history ─────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const certs = await getAllCertificates();
      setHistory(certs);
    } catch (err) {
      // Suppress toast if user is not authenticated (middleware will redirect)
      if (err instanceof Error && err.message === "Not authenticated") return;
      toast("Failed to load history", "error");
    }
  }, [toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, certificateId]);

  // ── Resume / Restore on mount ────────────────────────────────────────────

  useEffect(() => {
    const handleInit = async () => {
      // 1. Manual resume from History page
      const resumeData = localStorage.getItem("networth_resume_data");
      const resumeId = localStorage.getItem("networth_resume_id");
      const viewOnly = localStorage.getItem("networth_view_only");

      if (resumeData && resumeId) {
        try {
          const parsed = JSON.parse(resumeData);
          if (parsed.purpose !== undefined) {
            setData(parsed);
            setCertificateId(resumeId);
            localStorage.setItem("networth_current_id", resumeId);
            if (viewOnly === "true") setStep(6);
            return;
          }
        } catch {
          // ignore parse errors
        } finally {
          localStorage.removeItem("networth_resume_data");
          localStorage.removeItem("networth_resume_id");
          localStorage.removeItem("networth_view_only");
        }
      }

      // 2. Restore certificate ID for continued editing (form data is already in localStorage)
      const currentId = localStorage.getItem("networth_current_id");
      if (currentId) {
        setCertificateId(currentId);
      }
    };

    handleInit();
  }, [setData]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setShowResetModal(true);
  }, []);

  const confirmReset = useCallback(async () => {
    setShowResetModal(false);

    // Auto-save current work before starting fresh
    const currentData = dataRef.current;
    const hasData = currentData.purpose || currentData.fullName || currentData.passportNumber;

    if (hasData) {
      try {
        setSaving(true);
        if (certificateId) {
          await updateCertificateDraft(certificateId, currentData);
        } else {
          // First-time save — create a new draft so it appears in sidebar
          const autoName = currentData.purpose
            ? currentData.purpose.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
            : "Untitled";
          const dataToSave = { ...currentData, nickname: currentData.nickname || autoName };
          await saveCertificateDraft(dataToSave);
        }
      } catch {
        // Save failed — still proceed with new certificate
      } finally {
        setSaving(false);
        savingRef.current = false;
      }
    }

    // Now start fresh
    setData(INITIAL_STATE);
    setStep(0);
    updateCertificateId(null);
    clearAudit();
    dirtyRef.current = false;
    localStorage.removeItem("networth_form_data");
    await loadHistory(); // Refresh sidebar to show the saved draft
    toast("New certificate started", "success");
    window.scrollTo(0, 0);
  }, [certificateId, setData, updateCertificateId, clearAudit, loadHistory, toast]);

  const handleSwitchCertificate = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const freshData = await getCertificate(id);
      setData(freshData);
      updateCertificateId(id);
      setStep(0);
    } catch {
      toast("Failed to switch certificate", "error");
    } finally {
      setLoading(false);
    }
  }, [setData, updateCertificateId, toast]);

  const handleRename = useCallback(async (id: string, newName: string) => {
    try {
      await renameCertificate(id, newName);
      if (id === certificateId) {
        setData((prev) => ({ ...prev, nickname: newName }));
      }
      loadHistory();
      toast("Certificate renamed", "success");
    } catch {
      toast("Failed to rename certificate", "error");
    }
  }, [certificateId, setData, loadHistory, toast]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteCertificate(id);
      if (certificateId === id) {
        setData(INITIAL_STATE);
        setStep(0);
        updateCertificateId(null);
      }
      await loadHistory();
      toast("Certificate deleted", "success");
    } catch {
      toast("Failed to delete certificate", "error");
    }
  }, [certificateId, setData, updateCertificateId, loadHistory, toast]);

  // ── Save draft ───────────────────────────────────────────────────────────

  const handleSave = useCallback(async (currentStep: number): Promise<boolean> => {
    // FIX 3: Ref-based mutex — skip if already saving (prevents double-click duplicates)
    if (savingRef.current) return false;
    savingRef.current = true;

    try {
      setSaving(true);

      // FIX 1: Read from ref instead of stale closure
      const newData = { ...dataRef.current };
      if (currentStep === 0 && !newData.nickname && newData.purpose) {
        newData.nickname = newData.purpose
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        setData(newData);
      }

      if (currentStep === 0 && !certificateId) {
        const id = await saveCertificateDraft(newData);
        updateCertificateId(id);
      } else if (certificateId) {
        await updateCertificateDraft(certificateId, newData);
      }

      dirtyRef.current = false; // Phase 3 FIX 7: Reset dirty flag after successful save
      toast("Draft saved", "success");
      return true; // FIX 2: Signal success
    } catch {
      toast("Failed to save draft", "error");
      return false; // FIX 2: Signal failure
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [certificateId, updateCertificateId, setData, toast]);

  // ── Next with Zod validation ─────────────────────────────────────────────

  const handleNext = useCallback(async () => {
    setValidationError(null);

    const result = validateFormStep(step, data);
    if (!result.success) {
      const messages = getValidationMessages(result);
      setValidationError(messages[0] ?? "Please fix the errors before continuing.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // FIX 2: Only advance step if save succeeded
    const saved = await handleSave(step);
    if (!saved) return;

    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo(0, 0);
  }, [step, data, handleSave]);

  const handleBack = useCallback(() => {
    setValidationError(null);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // ── Copy & Print ─────────────────────────────────────────────────────────

  // Recompute amount warnings when on Certificate step
  useEffect(() => {
    if (step === 7) {
      setAmountWarnings(validateAmountsForCertificate(data));
    } else {
      setAmountWarnings([]);
    }
  }, [step, data]);

  const copyText = useCallback(() => {
    const text = buildCertificateText(data);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast("Certificate text copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data, toast]);

  const printCertificate = useCallback(() => window.print(), []);

  // ── Step Renderer ────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepPurpose />;
      case 1:
        return <StepApplicant />;
      case 2:
        return <StepIncome certificateId={certificateId} />;
      case 3:
        return <StepImmovable certificateId={certificateId} />;
      case 4:
        return <StepMovable certificateId={certificateId} />;
      case 5:
        return <StepSavings certificateId={certificateId} />;
      case 6:
        return <StepSignatory />;
      case 7:
        return (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
              <h2 className="text-lg font-bold text-navy-950 m-0">
                Net Worth Certificate
              </h2>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyText}
                  disabled={amountWarnings.length > 0}
                  title={amountWarnings.length > 0 ? "Fix missing amounts first" : undefined}
                >
                  {copied ? "Copied!" : "Copy Text"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={printCertificate}
                  disabled={amountWarnings.length > 0}
                  title={amountWarnings.length > 0 ? "Fix missing amounts first" : undefined}
                >
                  Print
                </Button>
              </div>
            </div>

            {/* Amount warnings banner */}
            {amountWarnings.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 no-print">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  Missing amounts — fix before generating certificate:
                </p>
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  {amountWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* UDIN — collected at the end after CA signs */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 mb-6 no-print">
              <Input
                label="UDIN (Unique Document Identification Number)"
                hint="Enter the UDIN after the certificate is signed by the CA"
                placeholder="14-digit UDIN number"
                value={data.udin}
                onChange={(e) => updateField("udin", e.target.value)}
              />
            </div>

            {/* Self-review summary (collapsible) */}
            <details className="mb-6 no-print border border-slate-200 rounded-xl bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy-950 select-none hover:bg-slate-50 rounded-xl">
                Review Data Summary
              </summary>
              <div className="px-4 pb-4 pt-2 text-sm text-slate-700 space-y-4">
                {/* Applicant */}
                <div>
                  <h4 className="font-semibold text-navy-900 mb-1">Applicant</h4>
                  <p>{data.salutation} {data.fullName || "—"} &middot; Passport: {data.passportNumber || "—"}</p>
                  <p>Purpose: {data.purpose || "—"} &middot; Country: {data.country || "—"} &middot; Date: {data.certDate || "—"}</p>
                </div>

                {/* Annexure I — Income */}
                {data.incomeTypes.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-navy-900 mb-1">Annexure I — Income</h4>
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        {data.incomeTypes.map((person, i) => {
                          const name = data.incomeLabels[person]?.trim() || (person === "Self" ? data.fullName : person);
                          const inr = data.incomeRows[i]?.inr?.trim();
                          return (
                            <tr key={i} className="border-b border-slate-100">
                              <td className="py-1 pr-2">{person} — {name}</td>
                              <td className="py-1 text-right font-mono">{inr ? formatINR(parseAmount(inr)) : <span className="text-red-500">Missing</span>}</td>
                            </tr>
                          );
                        })}
                        <tr className="font-semibold">
                          <td className="py-1 pr-2">Total</td>
                          <td className="py-1 text-right font-mono">{formatINR(computeTotals(data).incomeINR)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Annexure II — Immovable */}
                {data.immovableRows.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-navy-900 mb-1">Annexure II — Immovable Assets</h4>
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        {data.immovableRows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="py-1 pr-2 max-w-[300px] truncate">{row.label || `Row ${i + 1}`}</td>
                            <td className="py-1 text-right font-mono">{row.inr?.trim() ? formatINR(parseAmount(row.inr)) : <span className="text-red-500">Missing</span>}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td className="py-1 pr-2">Total</td>
                          <td className="py-1 text-right font-mono">{formatINR(computeTotals(data).immovableINR)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Annexure III — Movable */}
                {data.movableRows.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-navy-900 mb-1">Annexure III — Movable Properties</h4>
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        {data.movableRows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="py-1 pr-2 max-w-[300px] truncate">{row.label || `Row ${i + 1}`}</td>
                            <td className="py-1 text-right font-mono">{row.inr?.trim() ? formatINR(parseAmount(row.inr)) : <span className="text-red-500">Missing</span>}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td className="py-1 pr-2">Total</td>
                          <td className="py-1 text-right font-mono">{formatINR(computeTotals(data).movableINR)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Annexure IV — Savings */}
                {(data.savingsRows ?? []).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-navy-900 mb-1">Annexure IV — Current Savings</h4>
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        {(data.savingsRows ?? []).map((row, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="py-1 pr-2 max-w-[300px] truncate">{row.label || `Row ${i + 1}`}</td>
                            <td className="py-1 text-right font-mono">{row.inr?.trim() ? formatINR(parseAmount(row.inr)) : <span className="text-red-500">Missing</span>}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td className="py-1 pr-2">Total</td>
                          <td className="py-1 text-right font-mono">{formatINR(computeTotals(data).savingsINR)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Grand Total */}
                <div className="pt-2 border-t border-slate-300">
                  <p className="font-bold text-navy-950">
                    Grand Total Net Worth: {formatINR(computeTotals(data).grandINR)}
                  </p>
                </div>

                {/* Signatory */}
                <div>
                  <h4 className="font-semibold text-navy-900 mb-1">Signatory</h4>
                  <p>{data.firmName || "—"}, Chartered Accountants, FRN {data.firmFRN || "—"}</p>
                  <p>{data.signatoryName || "—"} &middot; {data.signatoryTitle || "—"} &middot; M.No. {data.membershipNo || "—"}</p>
                  <p>Place: {data.signPlace || "—"}</p>
                </div>
              </div>
            </details>

            <div className="print-full">
              <CertificatePreview ref={certRef} data={data} />
            </div>
            <AuditLog entries={auditEntries} />
          </div>
        );
      default:
        return null;
    }
  };

  // ── Layout ───────────────────────────────────────────────────────────────

  // Block rendering until auth is confirmed
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen print-bg-none bg-slate-50">
      <div className="flex flex-col lg:flex-row min-h-screen">
        <Sidebar
          history={history}
          certificateId={certificateId}
          onNewCertificate={handleReset}
          onSwitchCertificate={handleSwitchCertificate}
          onRename={handleRename}
          onDelete={handleDelete}
          onToggleChat={() => setIsChatOpen((v) => !v)}
          loading={loading}
        />

        <main className={`flex-1 flex flex-col lg:flex-row min-w-0`}>
          {/* AI Chat Panel — desktop: side-by-side on left; mobile: full-screen overlay */}
          {isChatOpen && (
            <>
              {/* Mobile overlay backdrop */}
              <div
                className="lg:hidden fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm"
                onClick={() => setIsChatOpen(false)}
                aria-hidden="true"
              />
              <div
                className="
                  fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto
                  lg:flex-[27] lg:min-w-0 lg:border-r lg:border-slate-200
                  h-[100dvh] lg:sticky lg:top-0 lg:h-screen animate-panel-in
                "
              >
                <ChatPanel
                  onExtractedData={handleExtractedData}
                  onClose={() => setIsChatOpen(false)}
                  messages={chatMessages}
                  setMessages={setChatMessages}
                  latestExtractedData={chatExtractedData}
                  setLatestExtractedData={setChatExtractedData}
                />
              </div>
            </>
          )}

          {/* Form area — shrinks when chat is open */}
          <div className={`${isChatOpen ? "lg:flex-[73] lg:min-w-0" : "flex-1"} px-4 py-8 lg:px-12 lg:py-10 overflow-y-auto`}>
            <div className="max-w-4xl mx-auto">
            {/* Page Header */}
            <div className="no-print mb-6 mt-10 lg:mt-0">
              <h1 className="text-2xl lg:text-3xl font-black text-navy-950 tracking-tight">
                Net Worth Certificate
              </h1>
              <div className="flex flex-wrap items-center gap-2 lg:gap-3 mt-1">
                <p className="text-sm text-slate-500">
                  Fill in the details below to generate your certificate
                </p>
                <button
                  onClick={() => setIsChatOpen((v) => !v)}
                  className="text-xs font-semibold text-gold-600 hover:text-gold-700 whitespace-nowrap transition-colors"
                >
                  {isChatOpen ? "close AI panel" : "or fill with AI"}
                </button>
              </div>
            </div>

            {/* Progress Tabs */}
            <div className="no-print mb-8">
              <ProgressBar
                steps={STEPS}
                currentStep={step}
                onClickStep={(i) => i < step && setStep(i)}
              />
            </div>

            {/* Save Status Indicator */}
            <div className="h-5 flex justify-end no-print mb-1">
              {saving && (
                <span className="text-[10px] font-bold text-gold-700 animate-pulse">
                  Saving draft...
                </span>
              )}
            </div>

            {/* Step Content */}
            <div key={step} className="animate-fade-in relative">
              {loading ? (
                <StepSkeleton />
              ) : (
                <div key={`ai-${aiFlashKey}`} className={aiFlashKey > 0 ? "ai-flash rounded-xl" : ""}>
                  {renderStep()}
                </div>
              )}
            </div>

            {/* Navigation */}
            <WizardNav
              step={step}
              saving={saving}
              validationError={validationError}
              onBack={handleBack}
              onNext={handleNext}
              onResetStep={() => resetStep(step)}
            />
          </div>
          </div>
        </main>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        open={showResetModal}
        title="Start New Certificate"
        onClose={() => setShowResetModal(false)}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowResetModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={confirmReset}>
              Start New
            </Button>
          </>
        }
      >
        Your current certificate will be saved as a draft. You can switch back to it anytime from the sidebar.
      </Modal>
    </div>
  );
}
