"use client";

import React, { useId } from "react";
import { Info } from "lucide-react";

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  hint?: string;
}

export function Input({ label, required, hint, className, id: propId, ...props }: InputProps) {
  const autoId = useId();
  const inputId = propId || autoId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {hint && <p className="text-xs text-slate-500 -mt-0.5">{hint}</p>}
      <input
        id={inputId}
        {...props}
        className={`w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm
          focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
          transition-all duration-150
          bg-white font-[inherit] ${className ?? ""}`}
      />
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  required?: boolean;
  hint?: string;
}

export function Textarea({ label, required, hint, id: propId, ...props }: TextareaProps) {
  const autoId = useId();
  const inputId = propId || autoId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {hint && <p className="text-xs text-slate-500 -mt-0.5">{hint}</p>}
      <textarea
        id={inputId}
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm
          focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
          transition-all duration-150
          bg-white font-[inherit] resize-vertical"
      />
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  placeholder?: string;
  options: { value: string; label: string }[] | string[];
}

export function Select({ label, required, placeholder, options, id: propId, ...props }: SelectProps) {
  const autoId = useId();
  const inputId = propId || autoId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={inputId}
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm
          focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
          transition-all duration-150 bg-white cursor-pointer"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={value} value={value}>
              {optLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}

// ─── Checkbox Row (with optional write-beside) ────────────────────────────────

interface CheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  customLabel?: string;
  onCustomLabelChange?: (value: string) => void;
  customPlaceholder?: string;
}

export function Checkbox({
  label,
  checked,
  onToggle,
  customLabel,
  onCustomLabelChange,
  customPlaceholder,
}: CheckboxProps) {
  const checkId = useId();

  return (
    <div className="flex items-center gap-2 mb-2">
      <label htmlFor={checkId} className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 select-none shrink-0">
        <input
          id={checkId}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 rounded border-slate-300 text-emerald-700
            focus:ring-2 focus:ring-emerald-600/20 focus:ring-offset-0
            accent-emerald-700 cursor-pointer"
        />
        <span>{label}</span>
      </label>
      {onCustomLabelChange && (
        <input
          type="text"
          value={customLabel ?? ""}
          onChange={(e) => onCustomLabelChange(e.target.value)}
          placeholder={customPlaceholder ?? "Add details..."}
          className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
            transition-all duration-150 bg-slate-50
            placeholder:text-slate-400"
        />
      )}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm border border-slate-100">
      <h2 className="font-bold text-emerald-800 text-base mb-5 pb-3 border-b-2 border-emerald-100">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function InfoBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 px-4 py-2.5 bg-emerald-50 rounded-lg text-xs text-emerald-800 border border-emerald-100 flex items-start gap-2">
      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  const variants = {
    primary: "bg-emerald-800 text-white hover:bg-emerald-900 border-transparent shadow-sm",
    secondary: "bg-white text-slate-700 hover:bg-slate-50 border-slate-300",
    outline: "bg-transparent text-emerald-800 hover:bg-emerald-50 border-emerald-700",
    danger: "bg-white text-red-600 hover:bg-red-50 border-red-300",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3 text-base",
  };
  return (
    <button
      {...props}
      className={`font-semibold rounded-lg border transition-all duration-150 cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
