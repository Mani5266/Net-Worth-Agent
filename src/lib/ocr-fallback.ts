/**
 * OCR fallback: tesseract.js MRZ extraction for passport images.
 *
 * Run for ALL passport image uploads (not PDFs).
 * MRZ is ground truth — when it produces a valid checksum-verified
 * result, it ALWAYS overrides Gemini output.
 *
 * Worker lifecycle:
 *   • Lazy-loaded on first call
 *   • Singleton reused across requests
 *   • Auto-terminated after 60 s of idle time
 */

import { parseMRZ, type MRZResult } from "./mrz";

// ─── Worker singleton ────────────────────────────────────────────────────────

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const IDLE_TIMEOUT_MS = 60_000;   // terminate worker after 60 s idle
const OCR_TIMEOUT_MS = 15_000;    // per-recognition timeout

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (workerPromise) {
      try {
        const w = await workerPromise;
        await w.terminate();
      } catch { /* ignore */ }
      workerPromise = null;
    }
  }, IDLE_TIMEOUT_MS);
}

async function getWorker(): Promise<import("tesseract.js").Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker("eng");
      return worker;
    })();
  }
  resetIdleTimer();
  return workerPromise;
}

// ─── Image cropping (bottom 35%) ─────────────────────────────────────────────

async function cropBottom35(buffer: Buffer): Promise<Buffer | null> {
  try {
    // sharp is an optional peer dep (used by next/image) — may not be installed.
    // Use eval("require") to completely bypass webpack static analysis.
    // eslint-disable-next-line no-eval
    const sharp = eval("require")("sharp") as (input: Buffer) => any;
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) return null;
    const top = Math.floor(meta.height * 0.65);
    return await sharp(buffer)
      .extract({ left: 0, top, width: meta.width, height: meta.height - top })
      .toBuffer();
  } catch {
    // sharp not available or image corrupt — skip crop
    return null;
  }
}

// ─── Recognize helper with timeout ───────────────────────────────────────────

async function recognizeWithTimeout(
  worker: import("tesseract.js").Worker,
  imageData: Buffer | string,
): Promise<string> {
  const result = await Promise.race([
    worker.recognize(imageData),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tesseract timeout")), OCR_TIMEOUT_MS)
    ),
  ]);
  return (result as import("tesseract.js").RecognizeResult).data.text;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Try to extract passport data from MRZ via tesseract.js.
 *
 * @param base64Data — raw base64 image data (no data-URI prefix)
 * @param mimeType  — e.g. "image/jpeg"
 * @returns MRZResult or null
 */
export async function extractPassportMRZ(
  base64Data: string,
  mimeType: string,
): Promise<MRZResult | null> {
  // Skip PDFs — tesseract can't process them
  if (mimeType === "application/pdf") return null;

  try {
    const worker = await getWorker();
    const buffer = Buffer.from(base64Data, "base64");

    // Attempt 1: full image
    const fullText = await recognizeWithTimeout(worker, buffer);
    const result1 = parseMRZ(fullText);
    if (result1) return result1;

    // Attempt 2: crop bottom 35% (MRZ is at the bottom of passport pages)
    const cropped = await cropBottom35(buffer);
    if (cropped) {
      const croppedText = await recognizeWithTimeout(worker, cropped);
      const result2 = parseMRZ(croppedText);
      if (result2) return result2;
    }

    return null;
  } catch (err) {
    console.warn("[OCR] MRZ fallback error:", err instanceof Error ? err.message : err);
    return null;
  }
}
