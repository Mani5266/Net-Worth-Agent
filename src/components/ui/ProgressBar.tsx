"use client";

import type { StepDefinition } from "@/types";
import {
  Target,
  User,
  IndianRupee,
  Building,
  Car,
  Landmark,
  PenTool,
  FileText,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STEP_ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  user: User,
  "indian-rupee": IndianRupee,
  building: Building,
  car: Car,
  landmark: Landmark,
  "pen-tool": PenTool,
  "file-text": FileText,
};

interface ProgressBarProps {
  steps: StepDefinition[];
  currentStep: number;
  onClickStep: (index: number) => void;
}

export function ProgressBar({ steps, currentStep, onClickStep }: ProgressBarProps) {
  return (
    <div className="flex items-start overflow-x-auto pb-1 mb-7">
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const Icon = STEP_ICON_MAP[step.icon];

        return (
          <div key={step.id} className="flex items-center flex-1 min-w-[60px]">
            {/* Node */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => done && onClickStep(i)}
                aria-label={`Step ${i + 1}: ${step.label}${done ? " (completed)" : active ? " (current)" : ""}`}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm
                  transition-all duration-200 border-2 flex-shrink-0
                  ${
                    done
                      ? "bg-navy-950 text-white border-navy-950 cursor-pointer hover:bg-navy-900"
                      : active
                      ? "bg-navy-700 text-white border-navy-600 shadow-[0_0_0_4px_rgba(15,26,46,0.12)]"
                      : "bg-slate-100 text-slate-400 border-slate-200 cursor-default"
                  }`}
              >
                {done ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : Icon ? (
                  <Icon className="w-4 h-4" />
                ) : (
                  <span className="text-xs">{i + 1}</span>
                )}
              </button>
              <span
                className={`text-[10px] whitespace-nowrap font-medium
                  ${active ? "text-navy-950 font-bold" : done ? "text-navy-700" : "text-slate-400"}`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-4 transition-colors duration-200
                  ${done ? "bg-navy-950" : "bg-slate-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
