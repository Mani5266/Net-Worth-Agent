# OnEasy - Net Worth Certificate Agent

A premium, AI-powered SaaS platform for generating professional Net Worth Certificates. Built with a modern navy-themed UI, Supabase authentication, and intelligent document processing.

## Features

- **Guided Multi-Step Wizard**: Navigate through Purpose, Applicant Details, Income, Immovable Assets, Movable Assets, Savings, and Certificate generation with a visual progress stepper.
- **AI-Powered PAN Extraction**: Upload a PAN card and the agent automatically extracts details using Gemini AI with multi-model fallback.
- **Dynamic Annexures**:
  - **Annexure I (Income)**: Automatic Assessment Year calculation with income breakdown.
  - **Annexure II (Immovable Assets)**: Person-based property tracking with address details and valuation.
  - **Annexure III (Movable Assets)**: Specialized handling for gold (grams), vehicles, and household assets.
  - **Annexure IV (Savings)**: Categorical handling for bank accounts, insurance policies, and investments.
- **Supporting Document Uploads**: Integrated file upload across all annexures for valuation reports, statements, and invoices.
- **Live Currency Conversion**: Real-time USD to INR conversion for foreign-purpose certificates.
- **AI Certificate Drafting**: One-click professional drafting of the certificate text using Gemini AI.
- **Certificate History**: View, manage, and resume previously created certificates.
- **Audit Logging**: Track all changes made to certificate data.
- **Rate Limiting**: API protection via Upstash Redis.
- **Authentication**: Secure email/password auth with Supabase, including password strength validation.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) with custom navy color palette |
| Authentication | [Supabase Auth](https://supabase.com/auth) (SSR) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) |
| AI Engine | [Google Gemini API](https://ai.google.dev/) (2.5 Flash / 1.5 Flash fallback) |
| Rate Limiting | [Upstash Redis](https://upstash.com/) |
| Validation | [Zod](https://zod.dev/) |
| Icons | [Lucide React](https://lucide.dev/) |

## Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Mani5266/Net-Worth-Agent.git
   cd Net-Worth-Agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Google Gemini AI
   GEMINI_API_KEY=your_gemini_api_key

   # Upstash Redis (optional — rate limiting)
   UPSTASH_REDIS_REST_URL=your_upstash_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the app**:
   Navigate to `http://localhost:3000` in your browser.

## Project Structure

```
src/
  app/            # Next.js pages, layouts, and API routes (OCR, AI generation)
  components/     # UI components, form steps, sidebar, auth, and certificate preview
    auth/         # Authentication UI (split-screen login/signup)
    steps/        # Wizard step components (Applicant, Income, Immovable, etc.)
    ui/           # Reusable UI primitives (Button, Input, Select, Toast, etc.)
  constants/      # Step definitions and application constants
  hooks/          # Custom hooks (form state, exchange rates)
  lib/            # Supabase clients, rate limiting, auth guards, utilities
  types/          # Centralized TypeScript type definitions
  middleware.ts   # Supabase auth session middleware
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |

## License

Internal use only.
