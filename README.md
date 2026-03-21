# Net Worth Certificate Agent 📜

A premium, AI-powered web application for generating professional Net Worth Certificates. Designed for accuracy, compliance, and aesthetic excellence.

## ✨ Features

- **Guided Multi-Step Form**: Seamlessly navigate through Purpose, Applicant Details, and Annexures.
- **AI-Powered PAN Extraction**: Upload a PAN card, and the agent automatically extracts details using client-side OCR (Tesseract.js) and Gemini AI.
- **Dynamic Annexures**: 
  - **Annexure I (Income)**: Automatically calculates Assessment Year.
  - **Annexure II (Immovable Assets)**: Capture property details with specific placeholders and address tracking.
  - **Annexure III (Movable Assets)**: Special handling for gold (grams), vehicles, and household assets.
  - **Annexure IV (Savings)**: Categorical handling for bank assets, insurance policies, and investments.
- **Supporting Document Uploads**: Integrated `FileUpload` pattern across all annexures for valuation reports, statements, or invoices.
- **Live Currency Conversion**: Real-time USD to INR conversion for foreign purposes.
- **Aesthetic Refinement**: Clean, professional header with premium typography and subtle status badges.
- **AI Refinement**: One-click professional drafting of the certificate text using Gemini AI multi-model fallback.
- **Professional Print/PDF**: High-quality certificate preview ready for printing or exporting.

## 🚀 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: Vanilla CSS with modern UI principles (Gradients, Glassmorphism)
- **OCR**: [Tesseract.js](https://tesseract.projectnaptha.com/)
- **AI Engine**: [Google Gemini API](https://ai.google.dev/) (2.5 Flash / 1.5 Flash fallback)
- **State Management**: Custom React Hooks (`useFormData`)

## 🛠️ Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Mani5266/Net-Worth-Agent.git
   cd Net-Worth-Agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the app**:
   Navigate to `http://localhost:3000` in your browser.

## 📁 Project Structure

- `src/app`: Next.js pages and API routes (OCR, AI Generation).
- `src/components`: UI components, form steps, and certificate preview.
- `src/hooks`: Custom hooks for state management and exchange rates.
- `src/lib`: Utility functions and assessment year logic.
- `src/types`: Centralized TypeScript definitions.

## 📄 License

Internal use only.
