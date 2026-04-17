import { useMemo } from "react";
import { useOraclePrice } from "./useOraclePrice";
import { runStrategyRouter, type RouterResult } from "../services/strategyRouter";

export interface StrategyRecommendation extends RouterResult {
  adaPrice: number;
  minPrice: number;
  oracleLoading: boolean;
  oracleError: string | null;
  isLive: boolean;
  lastUpdated: Date | null;
}

export function useStrategyRecommendation(): StrategyRecommendation {
  const oracle = useOraclePrice();

  const routerResult = useMemo(
    () => runStrategyRouter(oracle.adaPrice, oracle.minPrice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oracle.adaPrice, oracle.minPrice]
  );

  return {
    ...routerResult,
    adaPrice: oracle.adaPrice,
    minPrice: oracle.minPrice,
    oracleLoading: oracle.loading,
    oracleError: oracle.error,
    isLive: oracle.isLive,
    lastUpdated: oracle.lastUpdated,
  };
}
