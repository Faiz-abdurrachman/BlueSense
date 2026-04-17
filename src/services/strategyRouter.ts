// Strategy Router — BlueSense decision engine
// Powered by Charli3 oracle prices.
// Compares APY across strategies and triggers rebalancing when delta > 5%.

export type StrategyId = "staking" | "liqwid" | "minswap";

export interface Strategy {
  id: StrategyId;
  name: string;
  apy: number;       // decimal, e.g. 0.125 = 12.5%
  risk: "very_low" | "low" | "medium";
  description: string;
}

export interface RouterResult {
  currentBest: StrategyId;
  activeStrategy: StrategyId;
  shouldRebalance: boolean;
  allStrategies: Strategy[];
  reason: string;
  delta: number;     // decimal delta between best and current active
}

const REBALANCE_THRESHOLD = 0.05;   // 5%
const BASE_STAKING_APY   = 0.042;   // 4.2% — native staking, price-independent

// Liqwid ADA lending APY: higher when ADA price is higher (more demand for loans)
// Clamped to 8–15%
function calcLiqwidAPY(adaPrice: number): number {
  const base = 0.10;
  const priceBonus = Math.min((adaPrice - 0.3) * 0.12, 0.05);
  return Math.min(Math.max(base + priceBonus, 0.08), 0.15);
}

// Minswap ADA/MIN LP APY: scales with MIN/ADA ratio (proxy for trading demand)
// Clamped to 20–40%
function calcMinswapAPY(adaPrice: number, minPrice: number): number {
  const minAdaRatio = minPrice / Math.max(adaPrice, 0.001);
  const base = 0.24;
  const ratioBonus = Math.min(minAdaRatio * 2.5, 0.16);
  return Math.min(Math.max(base + ratioBonus, 0.20), 0.40);
}

// Module-scoped active strategy — persists across re-renders for demo
let activeStrategy: StrategyId = "liqwid";

export function runStrategyRouter(
  adaPrice: number,
  minPrice: number
): RouterResult {
  const stakingAPY  = BASE_STAKING_APY;
  const liqwidAPY   = calcLiqwidAPY(adaPrice);
  const minswapAPY  = calcMinswapAPY(adaPrice, minPrice);

  const allStrategies: Strategy[] = [
    {
      id: "staking",
      name: "Cardano Native Staking",
      apy: stakingAPY,
      risk: "very_low",
      description: "Delegate ADA to a stake pool. Stable ~4.2% APY. Default fallback.",
    },
    {
      id: "liqwid",
      name: "Liqwid ADA Lending",
      apy: liqwidAPY,
      risk: "low",
      description:
        "Supply ADA as a lender on Liqwid Finance. No impermanent loss. APY scales with demand.",
    },
    {
      id: "minswap",
      name: "Minswap ADA/MIN LP",
      apy: minswapAPY,
      risk: "medium",
      description:
        "Provide ADA/MIN liquidity on Minswap. Highest yield, carries impermanent loss risk.",
    },
  ];

  const best    = allStrategies.reduce((a, b) => (a.apy > b.apy ? a : b));
  const current = allStrategies.find((s) => s.id === activeStrategy)!;
  const delta   = best.apy - current.apy;
  const shouldRebalance = delta > REBALANCE_THRESHOLD && best.id !== activeStrategy;

  let reason: string;
  if (shouldRebalance) {
    reason = `Oracle detected +${(delta * 100).toFixed(1)}% APY delta — rebalancing from ${current.name} → ${best.name}`;
  } else if (best.id === activeStrategy) {
    reason = `${current.name} is already optimal at ${(current.apy * 100).toFixed(1)}% APY`;
  } else {
    reason = `Delta ${(delta * 100).toFixed(1)}% is below the 5% threshold — holding current strategy`;
  }

  if (shouldRebalance) {
    activeStrategy = best.id;
  }

  return {
    currentBest: best.id,
    activeStrategy,
    shouldRebalance,
    allStrategies,
    reason,
    delta,
  };
}

export function getActiveStrategy(): StrategyId {
  return activeStrategy;
}

// For demo: force a strategy switch to trigger the rebalancing animation
export function forceRebalanceTo(id: StrategyId): void {
  activeStrategy = id;
}
