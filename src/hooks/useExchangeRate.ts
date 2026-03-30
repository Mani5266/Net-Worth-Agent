"use client";

import { useState, useEffect, useRef } from "react";
import { DEFAULT_CURRENCY } from "@/constants";
import type { CurrencyInfo } from "@/constants";

interface ExchangeRateState {
  /** How many INR per 1 unit of the target currency (e.g. 83.5 for USD, 106 for GBP). */
  rate: number | null;
  /** The currency code this rate is for */
  currencyCode: string;
  loading: boolean;
  error: string | null;
  /** ISO timestamp of when the rate was last fetched */
  fetchedAt: string | null;
}

/**
 * Fetches live exchange rates from `/api/exchange-rate?currency=XXX`.
 * Re-fetches when the currency code changes. Refreshes every 10 minutes.
 * Falls back to CurrencyInfo.fallbackRate on failure.
 */
export function useExchangeRate(currency: CurrencyInfo = DEFAULT_CURRENCY): ExchangeRateState {
  const [state, setState] = useState<ExchangeRateState>({
    rate: null,
    currencyCode: currency.code,
    loading: true,
    error: null,
    fetchedAt: null,
  });

  // Track the currency code to detect changes
  const currencyRef = useRef(currency.code);

  useEffect(() => {
    let cancelled = false;
    currencyRef.current = currency.code;

    // Reset state when currency changes — clear old rate to prevent stale values
    setState({
      rate: null,
      currencyCode: currency.code,
      loading: true,
      error: null,
      fetchedAt: null,
    });

    async function fetchRate() {
      try {
        const res = await fetch(`/api/exchange-rate?currency=${currency.code}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled && currencyRef.current === currency.code) {
          setState({
            rate: json.rate,
            currencyCode: json.currency || currency.code,
            loading: false,
            error: json.fallback ? "Using approximate rate" : null,
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch {
        if (!cancelled && currencyRef.current === currency.code) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Could not fetch live rate",
            rate: prev.rate ?? currency.fallbackRate,
            currencyCode: currency.code,
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
  }, [currency.code, currency.fallbackRate]);

  return state;
}
