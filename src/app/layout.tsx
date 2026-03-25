import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Net Worth Certificate Portal — B A S T & Associates",
  description:
    "Secure Net Worth Certificate generation portal for B A S T & Associates, Chartered Accountants (FRN 021029S). Prepare, review, and issue professional net worth certificates for Indian applicants.",
  keywords: [
    "net worth certificate",
    "chartered accountant",
    "BAST Associates",
    "financial certificate",
    "CA certificate",
    "India",
  ],
  authors: [{ name: "B A S T & Associates" }],
  robots: "noindex, nofollow", // Private portal — not for search engines
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased font-sans bg-slate-50 text-slate-900">
        <ErrorBoundary>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
