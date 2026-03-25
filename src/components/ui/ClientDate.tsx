"use client";

import { useState, useEffect } from "react";

/**
 * Hydration-safe date formatter.
 * Renders nothing on the server, then the formatted date on the client.
 */
export function ClientDate({ date }: { date: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{new Date(date).toLocaleDateString()}</>;
}
