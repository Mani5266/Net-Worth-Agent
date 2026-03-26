<p align="center">
  <h1 align="center">Net Worth Certificate Generator</h1>
  <p align="center">
    A professional-grade web application for generating CA-certified Net Worth Certificates<br/>
    with structured annexures, live currency conversion, and intelligent document assistance.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white" alt="Zod" />
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License" />
</p>

---

## Overview

Net Worth Certificate Generator is a multi-step wizard application built for Chartered Accountant firms to produce compliant, print-ready net worth certificates. The application guides users through structured data entry across four annexures, computes totals with real-time currency conversion for international purposes, and renders a professional certificate ready for print or PDF export.

Built for **B A S T & Associates**, the application handles the full certificate lifecycle — from applicant details and asset declaration to signatory configuration and final document generation.

---

## Key Features

### Multi-Step Wizard (8 Steps)

| Step | Description |
|------|-------------|
| **1. Purpose** | Select the certificate purpose (visa, loan, tender, etc.) with automatic foreign currency detection |
| **2. Applicant** | Capture applicant identity — name, salutation, passport number, and UDIN |
| **3. Annexure I** | Current income declaration with per-person breakdown and assessment year tracking |
| **4. Annexure II** | Immovable assets — structured property entries with type, address, and ownership |
| **5. Annexure III** | Movable properties — vehicles, gold (with live price auto-calculation), investments |
| **6. Annexure IV** | Current savings — bank assets, insurance policies, and other financial instruments |
| **7. Signatory** | CA firm and partner details — fully editable, mapped into the certificate body |
| **8. Preview** | Live certificate preview with print and copy-to-clipboard support |

### Person-Based Declaration Model

Each annexure supports per-person asset declaration (Self, Mother, Father, Spouse). Users select which persons to include, provide their names, and add structured entries under each. Names auto-capitalize as the user types.

### Live Currency & Gold Integration

- **Exchange rates** fetched from a live API for foreign-purpose certificates (travel visa, study loan, foreign collaboration)
- **Gold prices** fetched in real-time — auto-calculates jewellery value from weight in grams using the 24K rate
- Graceful fallback to reference prices when APIs are unavailable

### Intelligent Document Assistance

- **Passport OCR** — upload a passport image and extract the applicant's name and passport number via Google Gemini AI
- **Aadhaar OCR** — extract name, address, and date of birth from Aadhaar card scans
- Multi-model fallback (Gemini 2.5 Flash / 1.5 Flash) for reliable extraction

### Professional Certificate Output

- Print-optimized HTML rendering with proper page breaks and typography
- Plain-text builder for clipboard copy (`buildCertificateText`)
- Indian numbering system (Crore, Lakh, Thousand) with amount-to-words conversion
- Currency symbols on every line item — `Rs.` for INR, appropriate symbol for foreign values
- Zero/empty amounts display as "NA" instead of placeholder text

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript 5.5](https://www.typescriptlang.org/) |
| **UI** | [React 18](https://react.dev/) with [Tailwind CSS 3.4](https://tailwindcss.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Validation** | [Zod 4](https://zod.dev/) — runtime schema validation with inferred types |
| **AI / OCR** | [Google Gemini API](https://ai.google.dev/) (server-side, multi-model fallback) |
| **Auth & DB** | [Supabase](https://supabase.com/) (authentication, database, file storage) |
| **Rate Limiting** | [Upstash Redis](https://upstash.com/) (sliding window, per-endpoint limits) |
| **State** | Custom React hooks (`useFormData`, `useFormContext`) |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── exchange-rate/      # Live currency exchange rate endpoint
│   │   ├── gold-price/         # Live gold price endpoint (24K/22K per gram)
│   │   └── ocr/                # Passport & Aadhaar OCR via Gemini AI
│   ├── history/                # Certificate history page
│   ├── layout.tsx              # Root layout with providers
│   └── page.tsx                # Main wizard page (step navigation)
│
├── components/
│   ├── auth/                   # Authentication components
│   ├── certificate/
│   │   └── CertificatePreview.tsx  # Print-ready certificate HTML renderer
│   ├── steps/
│   │   ├── StepPurpose.tsx     # Step 1 — Certificate purpose & date
│   │   ├── StepApplicant.tsx   # Step 2 — Applicant identity
│   │   ├── StepIncome.tsx      # Step 3 — Annexure I: Current Income
│   │   ├── StepImmovable.tsx   # Step 4 — Annexure II: Immovable Assets
│   │   ├── StepMovable.tsx     # Step 5 — Annexure III: Movable Properties
│   │   ├── StepSavings.tsx     # Step 6 — Annexure IV: Current Savings
│   │   └── StepSignatory.tsx   # Step 7 — CA Firm / Signatory Details
│   └── ui/                     # Shared UI components (Modal, Toast, FileUpload, etc.)
│
├── constants/
│   └── index.ts                # Purpose options, countries, currency mappings, step definitions
│
├── hooks/
│   ├── useAuditTrail.ts        # Change tracking for form modifications
│   ├── useExchangeRate.ts      # Live exchange rate fetching with caching
│   ├── useFormContext.tsx       # React Context provider for form state
│   ├── useFormData.ts          # Core form state management (INITIAL_STATE, updateField, etc.)
│   └── useGoldPrice.ts         # Live gold price fetching with fallback
│
├── lib/
│   ├── auth-guard.ts           # Route-level authentication guard
│   ├── db.ts                   # Database operations
│   ├── ratelimit.ts            # Upstash Redis rate limiter factory
│   ├── schemas.ts              # Zod schemas — single source of truth for all types
│   ├── supabase.ts             # Supabase client initialisation
│   ├── utils.ts                # Formatting, totals computation, certificate text builder
│   └── validation.ts           # Per-step form validation logic
│
├── middleware.ts                # Next.js middleware (auth, rate limiting)
└── types/
    └── index.ts                # Re-exported types from Zod schemas + UI-only types
```

---

## Getting Started

### Prerequisites

- **Node.js** 18.17 or later
- **npm** 9+ (or equivalent package manager)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (required for OCR features)

### Installation

```bash
# Clone the repository
git clone https://github.com/Mani5266/Net-Worth-Agent.git
cd Net-Worth-Agent

# Install dependencies
npm install
```

### Environment Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI-powered OCR |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `UPSTASH_REDIS_REST_URL` | Production | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Production | Upstash Redis token |
| `METALS_API_KEY` | No | Premium metals API key (free fallback available) |

> Rate limiting is silently disabled when Upstash credentials are absent, allowing local development without Redis.

### Development

```bash
# Start the development server
npm run dev

# Type-check without emitting
npm run type-check

# Lint the codebase
npm run lint

# Production build
npm run build
```

The application will be available at **http://localhost:3000**.

---

## API Endpoints

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/api/ocr` | POST | Extract text from passport/Aadhaar images via Gemini AI | 5 req/hr |
| `/api/exchange-rate` | GET | Fetch live foreign currency to INR exchange rate | 30 req/hr |
| `/api/gold-price` | GET | Fetch live 22K/24K gold prices per gram | — |

---

## Architecture Notes

- **Single source of truth**: All types are defined as Zod schemas in `src/lib/schemas.ts` and inferred via `z.infer<>`. The `src/types/index.ts` file re-exports these for backward compatibility.
- **Form state**: Managed by `useFormData` hook with a flat state object (`INITIAL_STATE`). All field updates flow through `updateField`, which handles auto-capitalisation of name fields.
- **Certificate output** is produced in two synchronized formats:
  - `CertificatePreview.tsx` — HTML rendering for print/PDF
  - `buildCertificateText()` in `utils.ts` — plain text for clipboard
- **Validation** is per-step (optional for annexure steps) with strict validation only on Purpose and Applicant steps.
- **Signatory details** are form-editable (Step 7) rather than hardcoded, with fallback placeholder text when fields are empty.

---

## License

Proprietary. Internal use only.

**B A S T & Associates** — Chartered Accountants
