/**
 * MRZ (Machine Readable Zone) utilities for passport validation.
 *
 * ICAO 9303 TD3 format — two 44-character lines at the bottom of the
 * passport data page.  This module provides:
 *   • isValidPassportNumber()  — broad alphanumeric validator
 *   • mrzCheckDigit()          — ICAO weighted-checksum verifier
 *   • parseMRZ()               — extract fullName + passportNumber from
 *                                 raw OCR text (tesseract output)
 */

// ─── Passport-number validation ──────────────────────────────────────────────

/**
 * Indian passport number: exactly 1 uppercase letter + 7 digits.
 * Rejects: all-same-char, letter + all-zeros.
 */
export function isValidPassportNumber(raw: string): boolean {
  const n = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z][0-9]{7}$/.test(n)) return false;
  // Reject garbage patterns
  if (/^(.)\1+$/.test(n)) return false;           // all same char
  if (/^[A-Z]0{7}$/.test(n)) return false;        // X0000000
  return true;
}

// ─── ICAO 9303 check-digit ──────────────────────────────────────────────────

/** Character → numeric value per ICAO 9303. '<' = 0, 0-9, A-Z = 10-35 */
function charValue(ch: string): number {
  if (ch === "<") return 0;
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;          // 0-9
  if (code >= 65 && code <= 90) return code - 55;          // A-Z → 10-35
  return -1; // invalid
}

const WEIGHTS = [7, 3, 1] as const;

/**
 * Compute the ICAO check digit over `field` and compare to `expected`.
 * Returns `true` only when every char is valid AND the checksum matches.
 */
export function mrzCheckDigit(field: string, expected: string): boolean {
  const expectedVal = charValue(expected.toUpperCase());
  if (expectedVal < 0) return false;

  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const v = charValue(field[i]!);
    if (v < 0) return false; // invalid character in field
    sum += v * WEIGHTS[i % 3]!;
  }
  return (sum % 10) === expectedVal;
}

// ─── MRZ TD3 parser ─────────────────────────────────────────────────────────

/** Minimum ratio of MRZ-valid chars (A-Z, 0-9, <) to consider a line as MRZ */
const MRZ_DENSITY_THRESHOLD = 0.8;

function isMRZLine(line: string): boolean {
  const trimmed = line.replace(/\s/g, "");
  if (trimmed.length < 40 || trimmed.length > 48) return false;
  const mrzChars = (trimmed.match(/[A-Z0-9<]/g) || []).length;
  return mrzChars / trimmed.length >= MRZ_DENSITY_THRESHOLD;
}

export interface MRZResult {
  fullName: string;
  passportNumber: string;
}

/**
 * Attempt to parse a TD3 MRZ from raw OCR text.
 *
 * Returns `{ fullName, passportNumber }` ONLY if:
 *   1. Two consecutive MRZ lines are found
 *   2. The passport-number ICAO checksum passes
 *   3. The passport number passes isValidPassportNumber()
 *
 * Returns `null` on any failure — caller falls back to Gemini result.
 */
export function parseMRZ(ocrText: string): MRZResult | null {
  // Normalize: uppercase, strip everything except MRZ-valid chars and newlines
  const normalized = ocrText.toUpperCase().replace(/[^A-Z0-9<\n]/g, "");
  const lines = normalized.split(/\n/).filter((l) => l.length > 0);

  // Find two consecutive lines that look like MRZ
  let line1 = "";
  let line2 = "";
  for (let i = 0; i < lines.length - 1; i++) {
    if (isMRZLine(lines[i]!) && isMRZLine(lines[i + 1]!)) {
      line1 = lines[i]!;
      line2 = lines[i + 1]!;
      break;
    }
  }

  if (!line1 || !line2) return null;

  // ── Line 2: passport number ──
  // Positions 0-8 = passport number (may have '<' padding), position 9 = check digit
  const rawPpNum = line2.substring(0, 9).replace(/</g, "");
  const ppCheck = line2[9];
  if (!ppCheck) return null;

  // Verify ICAO checksum over positions 0-8
  if (!mrzCheckDigit(line2.substring(0, 9), ppCheck)) return null;

  // Validate the actual passport number
  if (!isValidPassportNumber(rawPpNum)) return null;

  // ── Line 1: full name ──
  // Format: P<ISSUING_COUNTRY<SURNAME<<GIVEN_NAME<...
  // Skip "P" or "P<" type indicator, then 3-char country code
  const nameStart = line1.indexOf("<", 1);
  if (nameStart < 0) return null;

  // Everything after the country code is name data
  const nameSection = line1.substring(nameStart).replace(/^<+/, "");
  const parts = nameSection.split("<<").filter(Boolean);
  if (parts.length === 0) return null;

  const surname = (parts[0] || "").replace(/</g, " ").trim();
  const given = (parts.slice(1).join(" ") || "").replace(/</g, " ").trim();

  // Collapse multiple spaces — keep uppercase (MRZ has no case info;
  // aggressive title-casing corrupts names like McDonald, O'Brien, etc.)
  const fullName = [given, surname]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!fullName) return null;

  return { fullName, passportNumber: rawPpNum };
}
