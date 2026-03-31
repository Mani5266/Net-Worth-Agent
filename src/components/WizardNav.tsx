"use client";

import { Button } from "@/components/ui";
import { STEPS } from "@/constants";

interface WizardNavProps {
  step: number;
  saving: boolean;
  validationError: string | null;
  onBack: () => void;
  onNext: () => void;
  onResetStep?: () => void;
}

export function WizardNav({ step, saving, validationError, onBack, onNext, onResetStep }: WizardNavProps) {
  return (
    <div className="mt-8 no-print border-t border-slate-100 pt-6">
      {validationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs font-bold animate-shake">
          <span>Warning:</span> {validationError}
        </div>
      )}
      <div className="flex justify-between items-center">
        <Button
          variant="secondary"
          size="md"
          onClick={onBack}
          disabled={step === 0}
        >
          Back
        </Button>

        {step < STEPS.length - 1 && onResetStep && (
          <Button
            variant="danger"
            size="sm"
            onClick={onResetStep}
          >
            Clear This Step
          </Button>
        )}

        {step < STEPS.length - 1 && (
          <Button
            variant="primary"
            size="md"
            onClick={onNext}
            disabled={saving}
          >
            {saving ? "Saving..." : (step === STEPS.length - 2 ? "View Certificate" : "Next")}
          </Button>
        )}
      </div>
    </div>
  );
}
