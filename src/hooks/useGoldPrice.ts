"use client";

import { useState, useEffect, useCallback } from "react";
import { GOLD_REFERENCE_PRICES } from "@/constants";

interface GoldPriceState {
  /** 24K gold price per gram in INR */
  price24k: number | null;
  /** 22K gold price per gram in INR */
  price22k: number | null;
  /** Where the price data came from */
  source: string | null;
  /** ISO timestamp of when the price was last updated */
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
}

/** Client-side fallback so gold prices always display even if the API is unreachable */
const FALLBACK: GoldPriceState = {
  price24k: GOLD_REFERENCE_PRICES.price24kPerGram,
  price22k: GOLD_REFERENCE_PRICES.price22kPerGram,
  source: "Approximate (offline)",
  updatedAt: GOLD_REFERENCE_PRICES.lastUpdated,
  loading: false,
  error: null,
};

const INITIAL_STATE: GoldPriceState = {
  price24k: null,
  price22k: null,
  source: null,
  updatedAt: null,
  loading: true,
  error: null,
};

/**
 * Hook to fetch live gold prices from /api/gold-price.
 * Returns 22K and 24K prices per gram in INR.
 * Falls back to hardcoded approximate prices if the API is unreachable.
 * Refreshes every 15 minutes.
 */
export function useGoldPrice(): GoldPriceState & { refresh: () => void } {
  const [state, setState] = useState<GoldPriceState>(INITIAL_STATE);

  const fetchPrices = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const res = await fetch("/api/gold-price");
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setState({
        price24k: json.price24kPerGram ?? null,
        price22k: json.price22kPerGram ?? null,
        source: json.source ?? null,
        updatedAt: json.updatedAt ?? null,
        loading: false,
        error: null,
      });
    } catch {
      // API failed — use client-side fallback so gold prices always display
      setState(FALLBACK);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    // Refresh every 15 minutes
    const interval = setInterval(fetchPrices, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return { ...state, refresh: fetchPrices };
}
