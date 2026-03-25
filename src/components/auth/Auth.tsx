"use client";

import React, { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, CheckCircle2, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthMode = "login" | "signup" | "forgot";

interface MessageState {
  text: string;
  type: "error" | "success" | "info";
}

// ─── Password Strength ──────────────────────────────────────────────────────

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  checks: { label: string; passed: boolean }[];
}

function evaluatePassword(password: string): PasswordStrength {
  const checks = [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "Contains uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", passed: /[a-z]/.test(password) },
    { label: "Contains a number", passed: /[0-9]/.test(password) },
    { label: "Contains special character", passed: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter((c) => c.passed).length;

  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#059669"];

  return {
    score: Math.max(0, score - 1),
    label: labels[Math.max(0, score - 1)] ?? "Very Weak",
    color: colors[Math.max(0, score - 1)] ?? "#ef4444",
    checks,
  };
}

// ─── Feature Item ───────────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      </div>
      <span className="text-sm text-slate-300 font-medium">{text}</span>
    </div>
  );
}

// ─── Background Orbs ────────────────────────────────────────────────────────

function BackgroundOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Large primary orb */}
      <div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full animate-float"
        style={{
          background: "radial-gradient(circle at center, rgba(59, 94, 232, 0.15) 0%, rgba(59, 94, 232, 0.05) 40%, transparent 70%)",
        }}
      />
      {/* Medium secondary orb */}
      <div
        className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full animate-float-delayed"
        style={{
          background: "radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.03) 40%, transparent 70%)",
        }}
      />
      {/* Small accent orb */}
      <div
        className="absolute top-1/2 left-1/3 w-[250px] h-[250px] rounded-full animate-float-slow"
        style={{
          background: "radial-gradient(circle at center, rgba(139, 92, 246, 0.08) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}

// ─── Auth Component ──────────────────────────────────────────────────────────

export function Auth_UI() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  const passwordStrength = useMemo(
    () => (mode === "signup" ? evaluatePassword(password) : null),
    [mode, password]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", type: "error" });
      return;
    }
    if (password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters.", type: "error" });
      return;
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    setMessage({
      text: "Account created successfully. Please check your email for the confirmation link.",
      type: "success",
    });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setMessage({ text: "Please enter your email address.", type: "error" });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    });
    if (error) throw error;
    setMessage({
      text: "Password reset link sent. Please check your email inbox.",
      type: "success",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      switch (mode) {
        case "login":
          await handleLogin();
          break;
        case "signup":
          await handleSignUp();
          break;
        case "forgot":
          await handleForgotPassword();
          break;
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "";
      let msg: string;
      if (mode === "login") {
        msg = "Invalid email or password. Please try again.";
      } else if (mode === "forgot") {
        msg = "";
        setMessage({
          text: "If an account with that email exists, a password reset link has been sent.",
          type: "success",
        });
      } else {
        msg = rawMsg || "An unexpected error occurred.";
      }
      if (msg) {
        setMessage({ text: msg, type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ────────────────────── LEFT PANEL — Branding ────────────────────── */}
      <div
        className="relative w-full lg:w-[55%] flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden"
        style={{
          background: "linear-gradient(165deg, #0b1220 0%, #0f1a2e 50%, #111d35 100%)",
        }}
      >
        <BackgroundOrbs />

        {/* Content wrapper */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <div className="mb-12 lg:mb-20">
            <span className="text-white text-xl font-semibold tracking-tight">
              OnEasy
            </span>
          </div>

          {/* Hero copy */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-white leading-tight tracking-tight mb-5">
              Net Worth Agent
              <br />
            </h1>
            <p className="text-base sm:text-lg text-slate-400 leading-relaxed mb-10 max-w-md">
              Generate Net Worth certificate in minutes.
              Professional, accurate, and ready to sign.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              <FeatureItem text="AI-Powered Document Generation" />
              <FeatureItem text="Legally Compliant Templates" />
              <FeatureItem text="Instant DOCX Export" />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 lg:mt-20">
            <p className="text-xs text-slate-500">
              &copy; 2026 OnEasy. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ────────────────────── RIGHT PANEL — Auth Form ──────────────────── */}
      <div
        className="w-full lg:w-[45%] flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16"
        style={{ backgroundColor: "#f5f7fb" }}
      >
        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="mb-8">
            {/* Mobile-only logo */}
            <div className="lg:hidden mb-6">
              <span className="text-navy-950 text-xl font-semibold tracking-tight">
                OnEasy
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {mode === "forgot" ? "Reset your password" : "Sign in to your account"}
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {mode === "forgot"
                ? "Enter your email to receive a password reset link."
                : "Enter your credentials to access the dashboard."}
            </p>
          </div>

          {/* Tab Switch (Login / Sign Up) */}
          {mode !== "forgot" && (
            <div className="flex mb-8 bg-slate-200/60 rounded-lg p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all duration-200 ${mode === "login"
                    ? "bg-navy-950 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all duration-200 ${mode === "signup"
                    ? "bg-navy-950 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Mail className="w-[18px] h-[18px]" />
                </div>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900
                    placeholder:text-slate-400 bg-white
                    focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
                    hover:border-slate-300
                    transition-all duration-200 shadow-sm"
                />
              </div>
            </div>

            {/* Password */}
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-navy-700 font-semibold hover:text-navy-900 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-[18px] h-[18px]" />
                  </div>
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="w-full pl-11 pr-12 py-3 rounded-xl border border-slate-200 text-sm text-slate-900
                      placeholder:text-slate-400 bg-white
                      focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
                      hover:border-slate-300
                      transition-all duration-200 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600
                      transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-[18px] h-[18px]" />
                    ) : (
                      <Eye className="w-[18px] h-[18px]" />
                    )}
                  </button>
                </div>

                {/* Password Strength (signup only) */}
                {mode === "signup" && password.length > 0 && passwordStrength && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${((passwordStrength.score + 1) / 5) * 100}%`,
                            backgroundColor: passwordStrength.color,
                          }}
                        />
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: passwordStrength.color }}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {passwordStrength.checks.map((check) => (
                        <p
                          key={check.label}
                          className={`text-[10px] flex items-center gap-1 ${check.passed ? "text-emerald-600" : "text-slate-400"
                            }`}
                        >
                          <span>{check.passed ? "+" : "-"}</span>
                          {check.label}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Password (signup only) */}
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-[18px] h-[18px]" />
                  </div>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    autoComplete="new-password"
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm text-slate-900
                      placeholder:text-slate-400 bg-white
                      focus:outline-none focus:ring-2 focus:ring-navy-900/10 focus:border-navy-800
                      hover:border-slate-300
                      transition-all duration-200 shadow-sm ${confirmPassword && confirmPassword !== password
                        ? "border-red-400 focus:ring-red-200/50 focus:border-red-400"
                        : "border-slate-200"
                      }`}
                  />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">
                    Passwords do not match.
                  </p>
                )}
              </div>
            )}

            {/* Message */}
            {message && (
              <div
                className={`p-3.5 rounded-xl text-sm font-medium border ${message.type === "error"
                    ? "bg-red-50 text-red-800 border-red-200"
                    : message.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-blue-50 text-blue-800 border-blue-200"
                  }`}
              >
                {message.text}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (mode === "signup" && password !== confirmPassword)}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white
                bg-navy-950 hover:bg-navy-900
                focus:outline-none focus:ring-2 focus:ring-navy-900/30 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 shadow-sm hover:shadow-md
                flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === "login"
                      ? "Sign In"
                      : mode === "signup"
                        ? "Create Account"
                        : "Send Reset Link"}
                  </span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Toggle */}
          <div className="mt-8 text-center">
            {mode === "login" && (
              <p className="text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="text-navy-800 font-semibold hover:text-navy-950 transition-colors"
                >
                  Create one
                </button>
              </p>
            )}
            {mode === "signup" && (
              <p className="text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="text-navy-800 font-semibold hover:text-navy-950 transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <p className="text-sm text-slate-500">
                Remember your password?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="text-navy-800 font-semibold hover:text-navy-950 transition-colors"
                >
                  Back to sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
