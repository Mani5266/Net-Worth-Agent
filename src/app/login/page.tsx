"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  const switchTab = (tab: "login" | "signup") => {
    setMode(tab);
    setError("");
    setSuccess("");
  };

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

        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          router.replace("/");
          return;
        }

        // Account created but needs email confirmation — show success, switch to login WITHOUT clearing
        setSuccess("Account created! Please check your email to confirm, then login.");
        setMode("login"); // Don't call switchTab — it clears success message
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
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

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        color: "#94a3b8",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      {/* Left Panel */}
      <div style={{
        width: "50%",
        minHeight: "100vh",
        background: "#0f172a",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "2.5rem",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative gradient */}
        <div style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 350,
          height: 350,
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "100%",
          height: 6,
          background: "linear-gradient(90deg, #0f172a 0%, #1e293b 40%, #334155 70%, #0f172a 100%)",
        }} />

        <div>
          <div style={{ fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.02em" }}>OnEasy</div>
          <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.08)", margin: "2rem 0" }} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: "1.25rem" }}>
            Net Worth Certificate
          </h1>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 420 }}>
            Prepare, review, and issue professional net worth certificates for Indian applicants. Accurate, structured, and CA-ready.
          </p>
          <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {["AI-Powered OCR & Data Extraction", "Multi-Annexure Certificate Builder", "Real-Time Gold & Exchange Rates"].map((text) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.95rem", fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: "rgba(16,185,129,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>&copy; 2026 OnEasy. All rights reserved.</div>
      </div>

      {/* Right Panel */}
      <div style={{
        width: "50%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        padding: "2.5rem",
      }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "2rem" }}>
            {mode === "login" ? "Enter your credentials to access the dashboard." : "Enter your details to get started."}
          </p>

          {/* Tabs */}
          <div style={{ display: "flex", marginBottom: "2rem", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <button
              onClick={() => switchTab("login")}
              style={{
                flex: 1, padding: "0.75rem", border: "none",
                background: mode === "login" ? "#0f172a" : "transparent",
                color: mode === "login" ? "#ffffff" : "#94a3b8",
                fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
              }}
            >Login</button>
            <button
              onClick={() => switchTab("signup")}
              style={{
                flex: 1, padding: "0.75rem", border: "none",
                background: mode === "signup" ? "#0f172a" : "transparent",
                color: mode === "signup" ? "#ffffff" : "#94a3b8",
                fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
              }}
            >Sign Up</button>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "0.65rem 1rem", borderRadius: 8, fontSize: "0.85rem", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", padding: "0.65rem 1rem", borderRadius: 8, fontSize: "0.85rem", marginBottom: "1rem" }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#0f172a", marginBottom: "0.5rem", fontWeight: 600 }}>Email Address</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com" required autoComplete="email"
                style={{
                  width: "100%", padding: "0.75rem 1rem", background: "#ffffff",
                  border: "1px solid #e2e8f0", borderRadius: 8, color: "#0f172a",
                  fontFamily: "inherit", fontSize: "0.95rem", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#0f172a", marginBottom: "0.5rem", fontWeight: 600 }}>Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password" required minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                style={{
                  width: "100%", padding: "0.75rem 1rem", background: "#ffffff",
                  border: "1px solid #e2e8f0", borderRadius: 8, color: "#0f172a",
                  fontFamily: "inherit", fontSize: "0.95rem", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {mode === "signup" && (
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#0f172a", marginBottom: "0.5rem", fontWeight: 600 }}>Confirm Password</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password" autoComplete="new-password"
                  style={{
                    width: "100%", padding: "0.75rem 1rem", background: "#ffffff",
                    border: "1px solid #e2e8f0", borderRadius: 8, color: "#0f172a",
                    fontFamily: "inherit", fontSize: "0.95rem", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", padding: "0.85rem", background: "#0f172a", color: "#fff",
                border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: "0.95rem",
                fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                marginTop: "0.5rem", opacity: loading ? 0.5 : 1, transition: "opacity 0.2s",
              }}
            >
              {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "#94a3b8" }}>
            {mode === "login" ? (
              <>Don&apos;t have an account?{" "}<a onClick={() => switchTab("signup")} style={{ color: "#0f172a", cursor: "pointer", fontWeight: 600 }}>Sign up</a></>
            ) : (
              <>Already have an account?{" "}<a onClick={() => switchTab("login")} style={{ color: "#0f172a", cursor: "pointer", fontWeight: 600 }}>Login</a></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
