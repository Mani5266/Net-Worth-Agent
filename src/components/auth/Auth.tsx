"use client";

import React, { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { CA_FIRM } from "@/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthMode = "login" | "signup" | "forgot";

interface MessageState {
  text: string;
  type: "error" | "success" | "info";
}

// ─── Password Strength ──────────────────────────────────────────────────────

interface PasswordStrength {
  score: number; // 0-4
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
      // Genericize auth errors to prevent user enumeration
      const rawMsg = err instanceof Error ? err.message : "";
      let msg: string;
      if (mode === "login") {
        msg = "Invalid email or password. Please try again.";
      } else if (mode === "forgot") {
        // Always show success for forgot password to prevent enumeration
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 px-4 py-12">
      {/* ── Firm Header ── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-900 rounded-2xl shadow-lg shadow-emerald-900/20 mb-4">
          <span className="text-white font-black text-2xl tracking-tight">B</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {CA_FIRM.name}
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          {CA_FIRM.type} &middot; FRN {CA_FIRM.frn}
        </p>
      </div>

      {/* ── Auth Card ── */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden">
          {/* Card Header */}
          <div className="px-8 pt-8 pb-0">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {mode === "login" && "Sign In"}
              {mode === "signup" && "Create Account"}
              {mode === "forgot" && "Reset Password"}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              {mode === "login" && "Access the Net Worth Certificate portal."}
              {mode === "signup" && "Register for a new account to get started."}
              {mode === "forgot" && "Enter your email to receive a password reset link."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pt-6 pb-8 space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-slate-900
                  placeholder:text-slate-400 bg-white
                  focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
                  transition-all duration-200"
              />
            </div>

            {/* Password */}
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-emerald-700 font-semibold hover:text-emerald-800 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Min. 8 characters" : "Enter your password"}
                    required
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 text-sm text-slate-900
                      placeholder:text-slate-400 bg-white
                      focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
                      transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600
                      text-xs font-semibold transition-colors select-none"
                    tabIndex={-1}
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>

                {/* Password Strength Indicator (signup only) */}
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
                          className={`text-[10px] flex items-center gap-1 ${
                            check.passed ? "text-emerald-600" : "text-slate-400"
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
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  className={`w-full px-4 py-3 rounded-lg border text-sm text-slate-900
                    placeholder:text-slate-400 bg-white
                    focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600
                    transition-all duration-200 ${
                      confirmPassword && confirmPassword !== password
                        ? "border-red-400 focus:ring-red-200/50 focus:border-red-400"
                        : "border-slate-300"
                    }`}
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="mt-1 text-[11px] text-red-500 font-medium">
                    Passwords do not match.
                  </p>
                )}
              </div>
            )}

            {/* Message */}
            {message && (
              <div
                className={`p-3.5 rounded-lg text-sm font-medium border ${
                  message.type === "error"
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
              className="w-full py-3 px-4 rounded-lg font-semibold text-sm text-white
                bg-emerald-800 hover:bg-emerald-900
                focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 shadow-sm"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign In"
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Link"}
            </button>
          </form>

          {/* Footer Toggle */}
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 text-center">
            {mode === "login" && (
              <p className="text-sm text-slate-600">
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="text-emerald-700 font-semibold hover:text-emerald-800 transition-colors"
                >
                  Create one
                </button>
              </p>
            )}
            {mode === "signup" && (
              <p className="text-sm text-slate-600">
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="text-emerald-700 font-semibold hover:text-emerald-800 transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <p className="text-sm text-slate-600">
                Remember your password?{" "}
                <button
                  onClick={() => switchMode("login")}
                  className="text-emerald-700 font-semibold hover:text-emerald-800 transition-colors"
                >
                  Back to sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-10 text-center space-y-2">
        <p className="text-xs text-slate-400">
          Net Worth Certificate Portal &middot; {CA_FIRM.name}
        </p>
        <p className="text-[10px] text-slate-400 max-w-sm leading-relaxed">
          Your data is encrypted in transit and at rest. All financial information is
          stored securely and accessible only to authorised users.
        </p>
      </div>
    </div>
  );
}
