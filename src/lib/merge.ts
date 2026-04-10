// ─── Deep Merge Helper for Extracted Form Data ──────────────────────────────
// Merges objects recursively but REPLACES arrays (AI returns complete arrays).
// Prevents shallow spread from overwriting nested objects like incomeLabels.

import type { FormData } from "@/types";

export function deepMergeFormData(
  target: Partial<FormData>,
  source: Partial<FormData>
): Partial<FormData> {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof FormData)[]) {
    const srcVal = source[key];
    const tgtVal = result[key];

    if (srcVal === undefined || srcVal === null) continue;

    // Arrays: replace entirely (AI returns the complete array each turn)
    if (Array.isArray(srcVal)) {
      (result as Record<string, unknown>)[key] = srcVal;
    }
    // Plain objects: merge recursively
    else if (
      typeof srcVal === "object" &&
      typeof tgtVal === "object" &&
      tgtVal !== null &&
      !Array.isArray(tgtVal)
    ) {
      (result as Record<string, unknown>)[key] = {
        ...(tgtVal as Record<string, unknown>),
        ...(srcVal as Record<string, unknown>),
      };
    }
    // Primitives: overwrite
    else {
      (result as Record<string, unknown>)[key] = srcVal;
    }
  }
  return result;
}
