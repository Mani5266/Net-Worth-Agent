// ─── Deep Merge Helper for Extracted Form Data ──────────────────────────────
// Merges objects recursively but REPLACES arrays (AI returns complete arrays).
// Prevents shallow spread from overwriting nested objects like incomeLabels.

import type { FormData } from "@/types";

function deepMergeObjects(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];

    if (srcVal === undefined || srcVal === null) continue;

    // Arrays: replace entirely (AI returns the complete array each turn)
    if (Array.isArray(srcVal)) {
      result[key] = srcVal;
    }
    // Plain objects: merge recursively
    else if (
      typeof srcVal === "object" &&
      typeof tgtVal === "object" &&
      tgtVal !== null &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMergeObjects(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>
      );
    }
    // Primitives: overwrite
    else {
      result[key] = srcVal;
    }
  }
  return result;
}

export function deepMergeFormData(
  target: Partial<FormData>,
  source: Partial<FormData>
): Partial<FormData> {
  return deepMergeObjects(
    target as Record<string, unknown>,
    source as Record<string, unknown>
  ) as Partial<FormData>;
}
