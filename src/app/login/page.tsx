"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";

/* ── Feature bullet ─────────────────────────────────────────── */
function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-[0.95rem] font-medium text-white/80">
      <div className="w-[22px] h-[22px] rounded-full bg-gold-500/20 flex items-center justify-center shrink-0">
        <Check className="w-3 h-3 text-gold-400" strokeWidth={2.5} />
      </div>
      {text}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  /* redirect if already authenticated + read URL params for status messages */
  useEffect(() => {
    // FIX 6: getUser() validates token server-side; getSession() only reads local storage
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/");
      } else {
        // Read verification status from URL params (set by /api/verify-email redirect)
        const verified = searchParams.get("verified");
        const errorParam = searchParams.get("error");

        if (verified === "true") {
          setSuccess("Email verified successfully! Please sign in.");
        } else if (errorParam === "expired") {
          setError("Verification link has expired. Please request a new one.");
        } else if (errorParam === "invalid") {
          setError("Invalid verification link. Please request a new one.");
        }

        setChecking(false);
      }
    });
  }, [router, searchParams]);

  /* tab switch — clears messages */
  const switchTab = (tab: "login" | "signup" | "forgot") => {
    setMode(tab);
    setError("");
    setSuccess("");
  };

  /* form submit */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "forgot") {
        const res = await fetch("/api/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok && !data.success) {
          setError(data.error || "Something went wrong.");
          setLoading(false);
          return;
        }
        setSuccess("If an account exists with that email, a password reset link has been sent. Check your inbox.");
        setLoading(false);
        return;
      } else if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // Even if Supabase auto-confirms and returns a session,
        // we sign out and require the user to login explicitly.
        // This prevents bypassing the login step via signup.
        if (data.session) {
          await supabase.auth.signOut();
        }

        // Send verification email (fire-and-forget — don't block signup UX)
        // Email is used only for rate limiting; actual email is fetched from DB.
        if (data.user?.id) {
          fetch("/api/send-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, userId: data.user.id }),
          }).catch(() => {
            // Swallow — verification email failure should not break signup flow
          });
        }

        setSuccess(
          "Account created! Check your email to verify your account, then come back and login."
        );
        setPassword("");
        setConfirmPassword("");
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }
        router.replace("/");
        return;
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  /* ── Loading gate ───────────────────────────────────────── */
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900 text-slate-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */
  const isLogin = mode === "login";
  const isForgot = mode === "forgot";

  return (
    <div className="min-h-screen flex font-sans">
      {/* ── Left panel ──────────────────────────────────────── */}
      <div className="hidden md:flex w-1/2 min-h-screen bg-navy-900 text-white flex-col justify-between p-10 relative overflow-hidden">
        {/* decorative gradient */}
        <div className="absolute -top-20 -right-20 w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(240,185,41,0.08)_0%,transparent_70%)]" />
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-navy-900 via-gold-500/40 to-navy-900" />

        {/* brand */}
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gold-500 rounded-xl flex items-center justify-center text-navy-950 font-black text-base">
              O
            </div>
            <span className="text-lg font-extrabold tracking-tight">OnEasy</span>
          </div>
          <div className="w-full h-px bg-white/[0.06] my-8" />
        </div>

        {/* content */}
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-[2.5rem] font-black tracking-tight leading-tight mb-5">
            Net Worth
            <br />
            Certificate
          </h1>
          <p className="text-base text-white/50 leading-relaxed max-w-[420px]">
            Prepare, review, and issue professional net worth certificates for
            Indian applicants. Accurate, structured, and CA-ready.
          </p>
          <div className="mt-12 flex flex-col gap-4">
            <Feature text="AI-Powered OCR & Data Extraction" />
            <Feature text="Multi-Annexure Certificate Builder" />
            <Feature text="Real-Time Gold & Exchange Rates" />
          </div>
        </div>

        <div className="text-xs text-white/25">
          &copy; 2026 OnEasy. All rights reserved.
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────── */}
      <div className="w-full md:w-1/2 min-h-screen flex items-center justify-center bg-white p-8 md:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile brand */}
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-gold-500 rounded-xl flex items-center justify-center text-navy-950 font-black text-base">
              O
            </div>
            <span className="text-lg font-extrabold text-navy-950 tracking-tight">OnEasy</span>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
            {isForgot
              ? "Reset your password"
              : isLogin
                ? "Sign in to your account"
                : "Create your account"}
          </h2>
          <p className="text-sm text-slate-400 mb-8">
            {isForgot
              ? "Enter your email and we'll send you a reset link."
              : isLogin
                ? "Enter your credentials to access the dashboard."
                : "Enter your details to get started."}
          </p>

          {/* tabs */}
          {!isForgot && (
            <div className="flex mb-8 border border-slate-200 rounded-[10px] overflow-hidden">
              <button
                type="button"
                onClick={() => switchTab("login")}
                className={`flex-1 py-3 text-sm font-semibold transition-all border-none cursor-pointer ${
                  isLogin
                    ? "bg-navy-950 text-white"
                    : "bg-transparent text-slate-400"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchTab("signup")}
                className={`flex-1 py-3 text-sm font-semibold transition-all border-none cursor-pointer ${
                  !isLogin
                    ? "bg-navy-950 text-white"
                    : "bg-transparent text-slate-400"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-2.5 rounded-lg text-sm mb-4">
              {success}
            </div>
          )}

          {/* form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-sm text-slate-900 mb-2 font-semibold">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-[0.95rem] outline-none
                  focus:border-gold-500 focus:ring-2 focus:ring-gold-400/20 transition-all placeholder:text-slate-400"
              />
            </div>

            {!isForgot && (
              <div className="mb-5">
                <label className="block text-sm text-slate-900 mb-2 font-semibold">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={6}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-[0.95rem] outline-none
                    focus:border-gold-500 focus:ring-2 focus:ring-gold-400/20 transition-all placeholder:text-slate-400"
                />
                {isLogin && (
                  <div className="text-right mt-1.5">
                    <a
                      onClick={() => switchTab("forgot")}
                      className="text-xs text-slate-400 hover:text-navy-950 font-medium cursor-pointer hover:underline transition-colors"
                    >
                      Forgot password?
                    </a>
                  </div>
                )}
              </div>
            )}

            {!isLogin && !isForgot && (
              <div className="mb-5">
                <label className="block text-sm text-slate-900 mb-2 font-semibold">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-[0.95rem] outline-none
                    focus:border-gold-500 focus:ring-2 focus:ring-gold-400/20 transition-all placeholder:text-slate-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-navy-950 text-white border-none rounded-lg text-[0.95rem] font-semibold cursor-pointer mt-2
                transition-all hover:bg-navy-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "..."
                : isForgot
                  ? "Send Reset Link"
                  : isLogin
                    ? "Sign In"
                    : "Create Account"}
            </button>
          </form>

          <div className="text-center mt-5 text-sm text-slate-400">
            {isForgot ? (
              <>
                Remember your password?{" "}
                <a
                  onClick={() => switchTab("login")}
                  className="text-navy-950 font-semibold cursor-pointer hover:underline"
                >
                  Back to Login
                </a>
              </>
            ) : isLogin ? (
              <>
                Don&apos;t have an account?{" "}
                <a
                  onClick={() => switchTab("signup")}
                  className="text-navy-950 font-semibold cursor-pointer hover:underline"
                >
                  Sign up
                </a>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <a
                  onClick={() => switchTab("login")}
                  className="text-navy-950 font-semibold cursor-pointer hover:underline"
                >
                  Login
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Suspense wrapper (required for useSearchParams in Next.js 14) ── */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-navy-900 text-slate-400 font-sans">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
