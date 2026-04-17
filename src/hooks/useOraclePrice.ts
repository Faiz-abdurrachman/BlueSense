import { useState, useEffect, useCallback } from "react";
import { fetchAllPrices, type OraclePrices } from "../services/charli3OracleService";

export interface OraclePriceState {
  adaPrice: number;
  minPrice: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isLive: boolean;
}

const REFRESH_INTERVAL_MS = 30_000;

export function useOraclePrice(): OraclePriceState {
  const [state, setState] = useState<OraclePriceState>({
    adaPrice: 0.387,
    minPrice: 0.024,
    loading: true,
    error: null,
    lastUpdated: null,
    isLive: false,
  });

  const refresh = useCallback(async () => {
    try {
      const prices: OraclePrices = await fetchAllPrices();
      setState({
        adaPrice: prices.adaPrice,
        minPrice: prices.minPrice,
        loading: false,
        error: null,
        lastUpdated: prices.fetchedAt,
        isLive: prices.isLive,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Oracle fetch failed",
        isLive: false,
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return state;
}
