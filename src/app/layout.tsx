import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Net Worth Certificate Agent — B A S T & Associates",
  description:
    "AI-powered Net Worth Certificate generation for B A S T & Associates, Chartered Accountants",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-gray-50">{children}</body>
    </html>
  );
}
