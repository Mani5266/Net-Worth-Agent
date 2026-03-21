"use client";

import type { StepDefinition } from "@/types";

interface ProgressBarProps {
  steps: StepDefinition[];
  currentStep: number;
  onClickStep: (index: number) => void;
}

export function ProgressBar({ steps, currentStep, onClickStep }: ProgressBarProps) {
  return (
    <div className="flex items-start overflow-x-auto pb-1 mb-7">
      {steps.map((step, i) => {
        const done   = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={step.id} className="flex items-center flex-1 min-w-[60px]">
            {/* Node */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => done && onClickStep(i)}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm
                  transition-all duration-200 border-2 flex-shrink-0
                  ${done
                    ? "bg-emerald-800 text-white border-emerald-800 cursor-pointer"
                    : active
                    ? "bg-green-500 text-white border-green-400 shadow-[0_0_0_4px_rgba(34,197,94,0.2)]"
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-default"
                  }`}
              >
                {done ? "✓" : step.icon}
              </button>
              <span
                className={`text-[10px] whitespace-nowrap font-medium
                  ${active ? "text-emerald-800 font-bold" : "text-gray-400"}`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-4 transition-colors duration-200
                  ${done ? "bg-emerald-800" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
