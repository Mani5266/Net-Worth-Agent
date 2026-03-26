// ─── Re-export all types from Zod schemas ────────────────────────────────────
// This file exists for backward compatibility. All canonical types are now
// defined in src/lib/schemas.ts via Zod inference.

export type {
  PurposeValue,
  SalutationType,
  AnnexureRow,
  UploadedDoc,
  ImmovableProperty,
  MovableAsset,
  SavingsEntry,
  FormData,
  CertificateTotals,
  CertificateRecord,
  DocumentRecord,
  FormStatus,
  AuditEntry,
} from "@/lib/schemas";

// ─── Step Definition (UI-only, no Zod schema needed) ─────────────────────────

export interface StepDefinition {
  id: string;
  icon: string;
  label: string;
}
