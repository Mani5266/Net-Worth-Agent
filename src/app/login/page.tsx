"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/* ── Checkmark icon used in feature bullets ─────────────────── */
function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#10b981"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Feature bullet ─────────────────────────────────────────── */
function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-[0.95rem] font-medium text-white/80">
      <div className="w-[22px] h-[22px] rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
        <CheckIcon />
      </div>
      {text}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  /* redirect if already authenticated */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  /* tab switch — clears messages */
  const switchTab = (tab: "login" | "signup") => {
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
      if (mode === "signup") {
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
        if (data.session) {
          router.replace("/");
          return;
        }

        setSuccess(
          "Account created! Please check your email to confirm, then login."
        );
        setMode("login");
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
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-400 font-sans">
        Loading...
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */
  const isLogin = mode === "login";

  return (
    <div className="min-h-screen flex font-sans">
      {/* ── Left panel ──────────────────────────────────────── */}
      <div className="w-1/2 min-h-screen bg-navy-900 text-white flex flex-col justify-between p-10 relative overflow-hidden">
        {/* decorative gradient */}
        <div className="absolute -top-20 -right-20 w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_70%)]" />
        <div className="absolute top-0 right-0 w-full h-1.5 bg-[linear-gradient(90deg,#0f172a_0%,#1e293b_40%,#334155_70%,#0f172a_100%)]" />

        {/* brand */}
        <div>
          <div className="text-lg font-extrabold tracking-tight">OnEasy</div>
          <div className="w-full h-px bg-white/[0.08] my-8" />
        </div>

        {/* content */}
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-[2.5rem] font-black tracking-tight leading-tight mb-5">
            Net Worth Certificate
          </h1>
          <p className="text-base text-white/55 leading-relaxed max-w-[420px]">
            Prepare, review, and issue professional net worth certificates for
            Indian applicants. Accurate, structured, and CA-ready.
          </p>
          <div className="mt-12 flex flex-col gap-4">
            <Feature text="AI-Powered OCR & Data Extraction" />
            <Feature text="Multi-Annexure Certificate Builder" />
            <Feature text="Real-Time Gold & Exchange Rates" />
          </div>
        </div>

        <div className="text-xs text-white/30">
          &copy; 2026 OnEasy. All rights reserved.
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────── */}
      <div className="w-1/2 min-h-screen flex items-center justify-center bg-white p-10">
        <div className="w-full max-w-[420px]">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </h2>
          <p className="text-sm text-slate-400 mb-8">
            {isLogin
              ? "Enter your credentials to access the dashboard."
              : "Enter your details to get started."}
          </p>

          {/* tabs */}
          <div className="flex mb-8 border border-slate-200 rounded-[10px] overflow-hidden">
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={`flex-1 py-3 text-sm font-semibold transition-all border-none cursor-pointer ${
                isLogin
                  ? "bg-slate-900 text-white"
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
                  ? "bg-slate-900 text-white"
                  : "bg-transparent text-slate-400"
              }`}
            >
              Sign Up
            </button>
          </div>

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
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-[0.95rem] outline-none focus:border-slate-900 transition-colors placeholder:text-slate-400"
              />
            </div>

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
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-[0.95rem] outline-none focus:border-slate-900 transition-colors placeholder:text-slate-400"
              />
            </div>

            {!isLogin && (
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
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-[0.95rem] outline-none focus:border-slate-900 transition-colors placeholder:text-slate-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-slate-900 text-white border-none rounded-lg text-[0.95rem] font-semibold cursor-pointer mt-2 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="text-center mt-5 text-sm text-slate-400">
            {isLogin ? (
              <>
                Don&apos;t have an account?{" "}
                <a
                  onClick={() => switchTab("signup")}
                  className="text-slate-900 font-semibold cursor-pointer hover:underline"
                >
                  Sign up
                </a>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <a
                  onClick={() => switchTab("login")}
                  className="text-slate-900 font-semibold cursor-pointer hover:underline"
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
