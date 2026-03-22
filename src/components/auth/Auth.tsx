"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, Input } from "@/components/ui";

export function Auth_UI() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ text: "Success! Check your email for the confirmation link.", type: "success" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setMessage({ text: err.message || "An error occurred", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-emerald-900 tracking-tight mb-2">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-gray-500">
            {isSignUp ? "Sign up to start saving your certificates securely" : "Login to access your drafts and history"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {message && (
            <div className={`text-xs p-3 rounded-lg ${message.type === "error" ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
              {message.text}
            </div>
          )}

          <Button
            type="submit"
            className="w-full py-6 rounded-2xl text-base font-bold shadow-lg shadow-emerald-200"
            disabled={loading}
          >
            {loading ? "Processing..." : (isSignUp ? "Sign Up" : "Login")}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            {isSignUp ? "Already have an account?" : "New to Net Worth Agent?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-emerald-700 font-bold hover:underline"
            >
              {isSignUp ? "Login" : "Create one now"}
            </button>
          </p>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 max-w-xs text-center leading-relaxed">
        Your data is encrypted and stored securely in Supabase. We take your financial privacy seriously.
      </p>
    </div>
  );
}
