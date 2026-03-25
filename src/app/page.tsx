"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button, Input } from "@/components/ui";
import { Sidebar } from "@/components/Sidebar";
import { WizardNav } from "@/components/WizardNav";
import { StepPurpose } from "@/components/steps/StepPurpose";
import { StepApplicant } from "@/components/steps/StepApplicant";
import { StepIncome } from "@/components/steps/StepIncome";
import { StepImmovable } from "@/components/steps/StepImmovable";
import { StepMovable } from "@/components/steps/StepMovable";
import { StepSavings } from "@/components/steps/StepSavings";
import { CertificatePreview } from "@/components/certificate/CertificatePreview";
import { AuditLog } from "@/components/AuditLog";
import { FormDataProvider, useFormContext } from "@/hooks/useFormContext";
import { INITIAL_STATE } from "@/hooks/useFormData";
import { STEPS } from "@/constants";
import { buildCertificateText } from "@/lib/utils";
import { validateFormStep, getValidationMessages } from "@/lib/validation";
import {
  saveCertificateDraft,
  updateCertificateDraft,
  getAllCertificates,
  getCertificate,
  renameCertificate,
  deleteCertificate,
} from "@/lib/db";
import type { CertificateRecord } from "@/types";
import { Auth_UI } from "@/components/auth/Auth";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { StepSkeleton } from "@/components/ui/Skeleton";

// ─── Main Page (wraps inner content with FormDataProvider) ───────────────────

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s)).catch(() => setSession(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (!session) return <Auth_UI />;

  return (
    <FormDataProvider>
      <WizardShell session={session} />
    </FormDataProvider>
  );
}

// ─── Wizard Shell (consumes FormDataContext) ─────────────────────────────────

function WizardShell({ session }: { session: Session }) {
  const { data, setData, updateField, auditEntries, clearAudit } = useFormContext();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const certRef = useRef<HTMLDivElement>(null);

  // Supabase state
  const [certificateId, setCertificateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CertificateRecord[]>([]);
  const [showResetModal, setShowResetModal] = useState(false);

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
    } catch {
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

      // 2. Refresh persistence
      const currentId = localStorage.getItem("networth_current_id");
      if (currentId) {
        try {
          setLoading(true);
          const freshData = await getCertificate(currentId);
          setData(freshData);
          setCertificateId(currentId);
        } catch {
          localStorage.removeItem("networth_current_id");
        } finally {
          setLoading(false);
        }
      }
    };

    handleInit();
  }, [setData]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(async () => {
    // Clear all sensitive data from localStorage
    localStorage.removeItem("networth_current_id");
    localStorage.removeItem("networth_resume_data");
    localStorage.removeItem("networth_resume_id");
    localStorage.removeItem("networth_view_only");
    updateCertificateId(null);
    await supabase.auth.signOut();
  }, [updateCertificateId]);

  const handleReset = useCallback(() => {
    setShowResetModal(true);
  }, []);

  const confirmReset = useCallback(() => {
    setData(INITIAL_STATE);
    setStep(0);
    updateCertificateId(null);
    clearAudit();
    setShowResetModal(false);
    toast("New certificate started", "success");
    window.scrollTo(0, 0);
  }, [setData, updateCertificateId, clearAudit, toast]);

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

  const handleSave = useCallback(async (currentStep: number) => {
    try {
      setSaving(true);

      const newData = { ...data };
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

      toast("Draft saved", "success");
    } catch {
      toast("Failed to save draft", "error");
    } finally {
      setSaving(false);
    }
  }, [certificateId, data, updateCertificateId, setData, toast]);

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

    await handleSave(step);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo(0, 0);
  }, [step, data, handleSave]);

  const handleBack = useCallback(() => {
    setValidationError(null);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // ── Copy & Print ─────────────────────────────────────────────────────────

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
        return (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
              <h2 className="text-lg font-bold text-navy-950 m-0">
                Net Worth Certificate
              </h2>
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="sm" onClick={copyText}>
                  {copied ? "Copied!" : "Copy Text"}
                </Button>
                <Button variant="secondary" size="sm" onClick={printCertificate}>
                  Print
                </Button>
              </div>
            </div>

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f7fb" }}>
      <div className="flex flex-col lg:flex-row min-h-screen">
        <Sidebar
          session={session}
          history={history}
          certificateId={certificateId}
          onNewCertificate={handleReset}
          onSwitchCertificate={handleSwitchCertificate}
          onRename={handleRename}
          onDelete={handleDelete}
          onSignOut={handleSignOut}
          loading={loading}
        />

        <main className="flex-1 px-4 py-8 lg:p-12 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {/* Progress Bar */}
            <div className="no-print mb-8">
              <ProgressBar
                steps={STEPS}
                currentStep={step}
                onClickStep={(i) => i < step && setStep(i)}
              />
            </div>

            {/* Save Status Indicator */}
            <div className="h-6 flex justify-end no-print mb-2">
              {saving && (
                <span className="text-[10px] font-bold text-navy-700 animate-pulse">
                  Saving draft...
                </span>
              )}
            </div>

            {/* Step Content */}
            <div key={step} className="animate-fade-in relative">
              {loading ? (
                <StepSkeleton />
              ) : (
                renderStep()
              )}
            </div>

            {/* Navigation */}
            <WizardNav
              step={step}
              saving={saving}
              validationError={validationError}
              onBack={handleBack}
              onNext={handleNext}
            />
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
            <Button variant="danger" size="sm" onClick={confirmReset}>
              Start New
            </Button>
          </>
        }
      >
        Are you sure you want to start a new certificate? This will clear all current inputs.
      </Modal>
    </div>
  );
}
