"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { INITIAL_STATE } from "@/hooks/useFormData";
import type { FormData } from "@/types";
import { ArrowLeft, Send, Sparkles, Loader2, Mic, Square } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Initial greeting (local-only, not sent to API on first turn) ────────────

const INITIAL_GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hello! I'll help you fill out your net worth certificate. Let's start — what is the purpose of this certificate? (e.g. Travelling Visa, Study Loan, Bank Finance, etc.)",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AIIntakePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [latestExtractedData, setLatestExtractedData] = useState<Partial<FormData>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice input state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice input refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, transcribing]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Detect voice support (client-only)
  useEffect(() => {
    setVoiceSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (mediaRecorderRef.current?.state === "recording")
        mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────

  const handleSend = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || sending) return;

    if (!overrideText) setInput("");
    setError(null);

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSending(true);

    try {
      const res = await fetch("/api/ai-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          currentExtractedData: latestExtractedData,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      // Merge safety — spread onto previous to prevent data loss if model omits a field
      if (data.extractedData && typeof data.extractedData === "object") {
        setLatestExtractedData((prev) => ({ ...prev, ...data.extractedData }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, messages, latestExtractedData]);

  // ── Voice: process recorded audio ───────────────────────────────────────

  const handleVoiceProcess = useCallback(
    async (blob: Blob) => {
      // Empty blob guard
      if (!blob || blob.size === 0) {
        setError("No audio detected. Please try again.");
        return;
      }

      setTranscribing(true);

      try {
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");

        const res = await fetch("/api/stt", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res
            .json()
            .catch(() => ({ error: `STT failed (${res.status})` }));
          throw new Error(errBody.error || `STT failed (${res.status})`);
        }

        const data = await res.json();

        if (!data.success || !data.text?.trim()) {
          setError("Couldn't understand audio. Please try again.");
          return;
        }

        // Feed transcript into existing AI intake flow
        await handleSend(data.text.trim());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Voice transcription failed. Please try typing instead."
        );
      } finally {
        setTranscribing(false);
      }
    },
    [handleSend]
  );

  // ── Voice: start recording ──────────────────────────────────────────────

  const handleVoiceStart = useCallback(async () => {
    if (recording || sending || transcribing) return;
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // MIME fallback — some browsers don't support opus codec
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        handleVoiceProcess(blob);
      };

      mediaRecorder.start();
      setRecording(true);

      // 30s auto-stop guard — prevents huge blobs + abuse
      autoStopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          handleVoiceStop();
        }
      }, 30_000);
    } catch {
      setError(
        "Microphone access denied. Please allow microphone in browser settings."
      );
    }
  }, [recording, sending, transcribing, handleVoiceProcess]);

  // ── Voice: stop recording ───────────────────────────────────────────────

  const handleVoiceStop = useCallback(() => {
    // Clear auto-stop timer
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    // Stop recorder (triggers onstop → handleVoiceProcess)
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    // Release mic stream
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setRecording(false);
  }, []);

  // ── Start Wizard ─────────────────────────────────────────────────────────

  const handleStartWizard = useCallback(() => {
    const prefillData = { ...INITIAL_STATE, ...latestExtractedData };
    localStorage.setItem("networth_resume_data", JSON.stringify(prefillData));
    localStorage.setItem("networth_resume_id", "ai-prefill");
    router.push("/");
  }, [latestExtractedData, router]);

  const canStartWizard = Object.keys(latestExtractedData).length > 0;
  const extractedCount = Object.keys(latestExtractedData).length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold-500" />
            <h1 className="text-sm font-bold text-navy-950">AI Intake</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canStartWizard && (
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              {extractedCount} field{extractedCount !== 1 ? "s" : ""} extracted
            </span>
          )}
          <Button
            size="sm"
            onClick={handleStartWizard}
            disabled={!canStartWizard}
            title={canStartWizard ? "Continue to wizard with extracted data" : "Chat with AI to extract data first"}
          >
            Start Wizard
          </Button>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-navy-950 text-white rounded-br-md"
                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                  <span className="text-xs text-slate-400 font-medium">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Transcribing indicator */}
          {transcribing && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                  <span className="text-xs text-slate-400 font-medium">Transcribing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 text-xs font-semibold ml-3"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              recording
                ? "Recording... click stop when done"
                : transcribing
                  ? "Transcribing..."
                  : "Tell me about your financial details..."
            }
            disabled={sending || recording || transcribing}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm
              focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-500
              hover:border-slate-400 transition-all duration-150
              bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {voiceSupported && (
            <button
              onClick={recording ? handleVoiceStop : handleVoiceStart}
              disabled={sending || transcribing}
              className={`p-2.5 rounded-xl transition-all duration-150 focus:outline-none focus:ring-2
                focus:ring-offset-1 shrink-0
                ${
                  recording
                    ? "bg-red-500 text-white hover:bg-red-600 focus:ring-red-400/30 animate-pulse"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:ring-gold-400/30"
                }
                disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label={recording ? "Stop recording" : "Start voice input"}
            >
              {recording ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || recording || transcribing}
            className="p-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-900
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:ring-offset-1 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
