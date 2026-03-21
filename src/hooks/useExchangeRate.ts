"use client";

import { useState, useEffect } from "react";

interface ExchangeRateState {
  /** How many INR per 1 USD (e.g. 83.5). Divide INR by this to get USD. */
  usdRate: number | null;
  loading: boolean;
  error: string | null;
  /** ISO timestamp of when the rate was last fetched */
  fetchedAt: string | null;
}

export function useExchangeRate(): ExchangeRateState {
  const [state, setState] = useState<ExchangeRateState>({
    usdRate: null,
    loading: true,
    error: null,
    fetchedAt: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchRate() {
      try {
        const res = await fetch("/api/exchange-rate");
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setState({
            usdRate: json.rate,
            loading: false,
            error: json.fallback ? "Using approximate rate" : null,
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Could not fetch live rate",
            usdRate: prev.usdRate ?? 83.5, // keep stale or fallback
          }));
        }
      }
    }

    fetchRate();
    // Refresh every 10 minutes
    const interval = setInterval(fetchRate, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}
