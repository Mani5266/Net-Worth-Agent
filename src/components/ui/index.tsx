"use client";

import React from "react";

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  hint?: string;
}

export function Input({ label, required, hint, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {hint && <p className="text-xs text-gray-400 -mt-0.5">{hint}</p>}
      <input
        {...props}
        className={`w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
          focus:outline-none focus:border-emerald-700 transition-colors
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

export function Textarea({ label, required, hint, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {hint && <p className="text-xs text-gray-400 -mt-0.5">{hint}</p>}
      <textarea
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
          focus:outline-none focus:border-emerald-700 transition-colors
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

export function Select({ label, required, placeholder, options, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        {...props}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
          focus:outline-none focus:border-emerald-700 transition-colors bg-white cursor-pointer"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const label = typeof opt === "string" ? opt : opt.label;
          return <option key={value} value={value}>{label}</option>;
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
  return (
    <div className="flex items-center gap-2 mb-2">
      <label className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700 select-none shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 accent-emerald-700 cursor-pointer"
        />
        <span>{label}</span>
      </label>
      {onCustomLabelChange && (
        <input
          type="text"
          value={customLabel ?? ""}
          onChange={(e) => onCustomLabelChange(e.target.value)}
          placeholder={customPlaceholder ?? "Add details…"}
          className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg
            focus:outline-none focus:border-emerald-600 transition-colors bg-gray-50
            placeholder:text-gray-300"
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
    <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm border border-gray-100">
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
    <div className="mt-3 px-4 py-2.5 bg-emerald-50 rounded-lg text-xs text-emerald-800 border border-emerald-100">
      ℹ️ {children}
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
    primary:   "bg-emerald-800 text-white hover:bg-emerald-900 border-transparent",
    secondary: "bg-white text-gray-700 hover:bg-gray-50 border-gray-300",
    outline:   "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-700",
    danger:    "bg-white text-red-600 hover:bg-red-50 border-red-400",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3 text-base",
  };
  return (
    <button
      {...props}
      className={`font-semibold rounded-lg border transition-colors cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
