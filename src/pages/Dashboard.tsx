import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CaretDown, Moon, MagnifyingGlass, CheckCircle, Copy, Faders, ArrowsLeftRight } from "@phosphor-icons/react";
import { useWallet, useLovelace, useAssets } from "@meshsdk/react";
import { WalletConnect } from "../components/WalletConnect";
import { useStrategyRecommendation } from "../hooks/useStrategyRecommendation";
import { ORACLE_CONTRACT_ADDRESS } from "../services/charli3OracleService";
import { forceRebalanceTo, type Strategy, type StrategyId } from "../services/strategyRouter";
import { RebalanceAnimation } from "../components/RebalanceAnimation";
import { buildDepositTx, buildWithdrawTx, buildRebalanceTx, buildInjectYieldTx, fetchVaultUtxo, parseVaultState, initializeVault, SSADA_POLICY_ID, type Strategy as VaultStrategy, type VaultState } from "../services/vaultService";

const STRATEGY_ID_TO_VAULT: Record<StrategyId, VaultStrategy> = {
  staking: "NativeStaking",
  liqwid: "LiqwidLending",
  minswap: "MinswapLP",
};

function lovelaceToAda(lovelace: string | undefined): number {
  if (!lovelace) return 0;
  return parseInt(lovelace) / 1_000_000;
}

export function Dashboard() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Strategies');

  const { connected, wallet } = useWallet();
  const lovelace = useLovelace();
  const assets = useAssets();
  const walletAda = lovelaceToAda(lovelace);

  // Hydrate ssADA position from wallet every render — single source of truth.
  // Previous local-state counter didn't survive page reloads or cross-session deposits.
  const ssAdaAsset = assets?.find((a) => a.unit.startsWith(SSADA_POLICY_ID));
  const walletSsAdaTokens = ssAdaAsset ? BigInt(ssAdaAsset.quantity) : 0n;
  const walletSsAdaBalance = Number(walletSsAdaTokens) / 1_000_000;

  const [ssAdaBalance, setSsAdaBalance] = useState(0);
  const [ssAdaTokens, setSsAdaTokens] = useState(0n);
  useEffect(() => {
    setSsAdaBalance(walletSsAdaBalance);
    setSsAdaTokens(walletSsAdaTokens);
  }, [walletSsAdaBalance, walletSsAdaTokens]);
  const [depositAmount, setDepositAmount] = useState("");
  const [rebalanceNotice, setRebalanceNotice] = useState<string | null>(null);
  const [demoRebalance, setDemoRebalance] = useState<{ from: Strategy; to: Strategy } | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const recommendation = useStrategyRecommendation();

  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceTxHash, setRebalanceTxHash] = useState<string | null>(null);

  // Live vault state from chain — refreshes on tx changes + 30s interval.
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [yieldTxHash, setYieldTxHash] = useState<string | null>(null);
  const [simulatingYield, setSimulatingYield] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const utxo = await fetchVaultUtxo();
      if (!utxo || cancelled) return;
      const state = parseVaultState(utxo);
      if (state && !cancelled) setVaultState(state);
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [txHash, rebalanceTxHash, yieldTxHash]);

  const vaultLovelace = vaultState?.totalAdaLovelace ?? 0n;
  const vaultAdaTotal = Number(vaultLovelace) / 1_000_000;
  const vaultTvlUsd = vaultAdaTotal * recommendation.adaPrice;
  const yieldAccruedAda = Number(vaultState?.yieldAccruedLovelace ?? 0n) / 1_000_000;
  const formatTvl = (usd: number): string => {
    if (usd === 0) return "$0.00";
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`;
    return `$${usd.toFixed(2)}`;
  };

  const handleForceRebalance = async () => {
    const current = recommendation.allStrategies.find((s) => s.id === recommendation.activeStrategy);
    const best = recommendation.allStrategies
      .filter((s) => s.id !== recommendation.activeStrategy)
      .reduce((a, b) => (a.apy > b.apy ? a : b));
    if (!current) return;

    // If a wallet is connected, submit a real on-chain Rebalance tx.
    // Validator attaches Charli3 oracle as reference_input — closes PRD §12 #2.
    if (connected && wallet) {
      setRebalancing(true);
      setRebalanceTxHash(null);
      setTxError(null);
      try {
        const result = await buildRebalanceTx(wallet, STRATEGY_ID_TO_VAULT[best.id]);
        setRebalanceTxHash(result.txHash);
        forceRebalanceTo(best.id);
        setDemoRebalance({ from: current, to: best });
      } catch (err) {
        setTxError(err instanceof Error ? err.message : "Rebalance failed");
      } finally {
        setRebalancing(false);
      }
      return;
    }

    // Wallet not connected → UI-only demo fallback
    forceRebalanceTo(best.id);
    setDemoRebalance({ from: current, to: best });
  };

  // Show rebalance banner for 8 seconds when oracle triggers a strategy switch
  useEffect(() => {
    if (recommendation.shouldRebalance) {
      setRebalanceNotice(recommendation.reason);
      const t = setTimeout(() => setRebalanceNotice(null), 8000);
      return () => clearTimeout(t);
    }
  }, [recommendation.shouldRebalance, recommendation.reason]);

  // Live pricePerShare from on-chain vault — totalAda / totalSsada. Rises after
  // every InjectYield tx (yield simulation), reflecting real compounding on-chain.
  const pricePerShare =
    vaultState && vaultState.totalSsada > 0n
      ? Number(vaultState.totalAdaLovelace) / Number(vaultState.totalSsada)
      : 1;

  const liqwidAPY   = recommendation.allStrategies.find((s) => s.id === "liqwid")?.apy   ?? 0.125;
  const stakingAPY  = recommendation.allStrategies.find((s) => s.id === "staking")?.apy  ?? 0.042;
  const minswapAPY  = recommendation.allStrategies.find((s) => s.id === "minswap")?.apy  ?? 0.28;
  const bestAPY     = recommendation.allStrategies.find((s) => s.id === recommendation.currentBest)?.apy ?? 0.125;

  // Real allocation: 10% to reserve, 90% to active strategy.
  const reserveTvl = vaultTvlUsd * 0.1;
  const activeTvl  = vaultTvlUsd * 0.9;
  const strategies = [
    { name: "BlueSense Target Reserve", apy: "0%", color: "#93c5fd", percentage: "10%", tvl: formatTvl(reserveTvl) },
    {
      name: `Liqwid ADA Lending${recommendation.activeStrategy === "liqwid" ? " (Active)" : ""}`,
      apy: `${(liqwidAPY * 100).toFixed(1)}%`,
      color: recommendation.activeStrategy === "liqwid" ? "#0033AD" : "#dbeafe",
      percentage: recommendation.activeStrategy === "liqwid" ? "90%" : "0%",
      tvl: recommendation.activeStrategy === "liqwid" ? formatTvl(activeTvl) : "$0.00",
    },
    {
      name: `Cardano Native Staking${recommendation.activeStrategy === "staking" ? " (Active)" : ""}`,
      apy: `${(stakingAPY * 100).toFixed(1)}%`,
      color: recommendation.activeStrategy === "staking" ? "#0033AD" : "#dbeafe",
      percentage: recommendation.activeStrategy === "staking" ? "90%" : "0%",
      tvl: recommendation.activeStrategy === "staking" ? formatTvl(activeTvl) : "$0.00",
    },
    {
      name: `Minswap ADA/MIN LP${recommendation.activeStrategy === "minswap" ? " (Active)" : ""}`,
      apy: `${(minswapAPY * 100).toFixed(1)}%`,
      color: recommendation.activeStrategy === "minswap" ? "#0033AD" : "#dbeafe",
      percentage: recommendation.activeStrategy === "minswap" ? "90%" : "0%",
      tvl: recommendation.activeStrategy === "minswap" ? formatTvl(activeTvl) : "$0.00",
    },
  ];

  const vaults = [
    {
      id: "ssADA",
      name: "ssADA",
      labels: ["Cardano", "Auto-Compound", "Single Asset"],
      fees: "0% | 0%",
      apy: `${(bestAPY * 100).toFixed(1)}%`,
      tvl: formatTvl(vaultTvlUsd),
      hasCheck: true
    },
    {
      id: "adaUSDM",
      name: "abUSDM",
      labels: ["Minswap", "Stablecoin", "LP Token"],
      fees: "0.25% | 10%",
      apy: "8.43%",
      tvl: "$1.21M",
      hasCheck: true
    },
    {
      id: "snekADA",
      name: "abSNEK",
      labels: ["WingRiders", "Volatile", "LP Token"],
      fees: "0% | 10%",
      apy: "42.0%",
      tvl: "$850K",
      hasCheck: true
    },
    {
      id: "iUSD",
      name: "ibUSD",
      labels: ["Indigo", "Stablecoin", "Single Asset"],
      fees: "0% | 10%",
      apy: "5.1%",
      tvl: "$2.1M",
      hasCheck: false
    }
  ];

  const handleDeposit = async () => {
    if (!connected || !wallet) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0 || amount > walletAda) return;

    setTxStatus("pending");
    setTxHash(null);
    setTxError(null);
    try {
      const result = await buildDepositTx(wallet, amount);
      setSsAdaBalance((prev) => prev + amount / pricePerShare);
      setSsAdaTokens((prev) => prev + result.ssadaMinted);
      setTxHash(result.txHash);
      setTxStatus("success");
      setDepositAmount("");
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus("error");
    }
  };

  const [initializing, setInitializing] = useState(false);
  const handleInitVault = async () => {
    if (!connected || !wallet) return;
    setInitializing(true);
    setTxError(null);
    try {
      const txHash = await initializeVault(wallet);
      setTxHash(txHash);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Init failed");
    } finally {
      setInitializing(false);
    }
  };

  const handleSimulateYield = async () => {
    if (!connected || !wallet) return;
    setSimulatingYield(true);
    setYieldTxHash(null);
    setTxError(null);
    try {
      // Inject 0.5 ADA as simulated yield — rises pricePerShare for all holders.
      const result = await buildInjectYieldTx(wallet, 0.5);
      setYieldTxHash(result.txHash);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Yield simulation failed");
    } finally {
      setSimulatingYield(false);
    }
  };

  const handleWithdraw = async () => {
    if (!connected || !wallet || ssAdaTokens === 0n) return;

    setTxStatus("pending");
    setTxHash(null);
    setTxError(null);
    try {
      const result = await buildWithdrawTx(wallet, ssAdaTokens);
      setSsAdaBalance(0);
      setSsAdaTokens(0n);
      setTxHash(result.txHash);
      setTxStatus("success");
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus("error");
    }
  };

  return (
    <div className="w-full bg-[#fcfcfc] min-h-screen text-gray-900 font-sans selection:bg-[#0033AD]/20 selection:text-gray-900">
      
      {/* Top Header */}
      <nav className="w-full px-8 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-3">
            <img src="/images/onramper-hero-orb.svg" alt="BlueSense" className="w-[30px] h-[30px] object-contain" />
            <span className="font-sans text-[22px] font-bold tracking-tight text-[#0033AD] translate-y-[-1px]">
              BlueSense
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-[15px] text-gray-600 font-medium">
             <button className="flex items-center gap-1.5 hover:text-black transition-colors">Ecosystem <CaretDown weight="bold" size={12} /></button>
             <button className="flex items-center gap-1.5 hover:text-black transition-colors">Resources <CaretDown weight="bold" size={12} /></button>
          </div>
        </div>
        
        <div className="flex items-center bg-white rounded-lg p-1.5 shadow-[0_2px_8px_rgb(0,0,0,0.04)] border border-gray-200">
           <button className="px-5 py-2 font-bold text-[15px] text-gray-900">Vaults</button>
           <Link to="/portfolio" className="px-3 py-2 font-medium text-[15px] text-gray-500 hover:text-black transition-colors">Portfolio</Link>
           <button className="px-3 py-2 text-gray-500 hover:text-black transition-colors">
              <Moon size={20} weight="regular" />
           </button>
           <div className="w-px h-6 bg-gray-200 mx-1" />
           <WalletConnect />
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto pt-6 px-8 pb-24">
        
        {/* Breadcrumb */}
        <div className="text-[13px] text-gray-500 mb-8">
           <Link to="/" className="hover:text-gray-900 transition-colors">Home</Link> <span className="mx-2 text-gray-300">&gt;</span> <span className="text-gray-900 font-medium">Vaults</span>
        </div>

        {/* Oracle Feed Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3 mb-5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${recommendation.isLive ? "bg-emerald-500 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
            <span className="text-[13px] font-semibold text-gray-700">
              {recommendation.isLive ? "Charli3 Oracle — Live" : "Charli3 Oracle — Demo Mode"}
            </span>
            {!recommendation.isLive && (
              <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                Mock Data
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[13px]">
            <span className="text-gray-500">
              ADA/USD{" "}
              <span className="font-bold text-gray-900">
                ${recommendation.adaPrice.toFixed(3)}
              </span>
            </span>
            <span className="text-gray-500">
              MIN/USD{" "}
              <span className="font-bold text-gray-900">
                ${recommendation.minPrice.toFixed(4)}
              </span>
            </span>
            <span className="hidden xl:inline text-gray-400 font-mono text-[11px]">
              Feed: {ORACLE_CONTRACT_ADDRESS.slice(0, 22)}…
            </span>
            {recommendation.lastUpdated && (
              <span className="text-gray-400 text-[11px]">
                Updated {Math.floor((Date.now() - recommendation.lastUpdated.getTime()) / 1000)}s ago
              </span>
            )}
            {!vaultState && connected && (
              <button
                onClick={handleInitVault}
                disabled={initializing}
                title="Vault UTxO not found. Init deposits 2 ADA seed so Deposit/Rebalance/InjectYield flows can run."
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold rounded-lg transition-colors shadow-sm flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {initializing ? (
                  <>
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Initializing…
                  </>
                ) : (
                  <>
                    <span>🚀</span> Init Vault
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleForceRebalance}
              disabled={rebalancing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0033AD] hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg transition-colors shadow-sm flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {rebalancing ? (
                <>
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Rebalancing…
                </>
              ) : (
                <>
                  <span>⚡</span> Force Rebalance
                </>
              )}
            </button>
            <button
              onClick={handleSimulateYield}
              disabled={simulatingYield || !connected}
              title="Injects 0.5 ADA into the vault as simulated yield. pricePerShare rises for all ssADA holders."
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg transition-colors shadow-sm flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {simulatingYield ? (
                <>
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Injecting…
                </>
              ) : (
                <>
                  <span>🎲</span> Simulate Yield
                </>
              )}
            </button>
          </div>
        </div>

        {/* Rebalance Notification Banner */}
        <AnimatePresence>
          {rebalanceNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 mb-5 shadow-sm"
            >
              <span className="text-emerald-500 mt-0.5 flex-shrink-0">⚡</span>
              <div>
                <p className="text-[13px] font-bold text-emerald-800">Oracle Triggered Rebalancing</p>
                <p className="text-[12px] text-emerald-700 mt-0.5">{rebalanceNotice}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rebalance On-Chain Tx Banner */}
        <AnimatePresence>
          {rebalanceTxHash && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5 mb-5 shadow-sm"
            >
              <span className="text-[#0033AD] mt-0.5 flex-shrink-0">⛓</span>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-blue-900">Rebalance Tx Submitted On-Chain</p>
                <p className="text-[12px] text-blue-700 mt-0.5">
                  Charli3 oracle attached as <span className="font-mono">reference_input</span> — verified on-chain per PRD §12 #2
                </p>
                <a
                  href={`https://preprod.cardanoscan.io/transaction/${rebalanceTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-mono text-[#0033AD] hover:underline break-all"
                >
                  {rebalanceTxHash.slice(0, 24)}…{rebalanceTxHash.slice(-10)}
                </a>
              </div>
              <button
                onClick={() => setRebalanceTxHash(null)}
                className="text-blue-400 hover:text-blue-600 text-lg flex-shrink-0"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Yield Injection Tx Banner */}
        <AnimatePresence>
          {yieldTxHash && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 mb-5 shadow-sm"
            >
              <span className="text-emerald-500 mt-0.5 flex-shrink-0">🎲</span>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-emerald-800">Yield Injected On-Chain</p>
                <p className="text-[12px] text-emerald-700 mt-0.5">
                  Vault ADA grew — pricePerShare now <span className="font-mono font-bold">{pricePerShare.toFixed(4)}</span>.
                  Total yield accrued: <span className="font-mono font-bold">{yieldAccruedAda.toFixed(4)} ADA</span>.
                </p>
                <a
                  href={`https://preprod.cardanoscan.io/transaction/${yieldTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-mono text-emerald-700 hover:underline break-all"
                >
                  {yieldTxHash.slice(0, 24)}…{yieldTxHash.slice(-10)}
                </a>
              </div>
              <button
                onClick={() => setYieldTxHash(null)}
                className="text-emerald-400 hover:text-emerald-600 text-lg flex-shrink-0"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
           <div className="flex flex-wrap items-center gap-4">
              {/* Vault Type Tabs */}
              <div className="flex items-center bg-white border border-gray-200 rounded-[0.5rem] p-1 shadow-sm">
                 <button className="px-4 py-1.5 text-[14px] font-bold bg-gray-100 rounded-[0.25rem] text-gray-900">All Vaults</button>
                 <button className="px-4 py-1.5 text-[14px] font-medium text-gray-500 hover:text-gray-900 transition-colors">Single Asset</button>
                 <button className="px-4 py-1.5 text-[14px] font-medium text-gray-500 hover:text-gray-900 transition-colors">LP Token</button>
              </div>

              {/* Chain Selector */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-[0.5rem] p-1.5 shadow-sm">
                 <button className="flex items-center gap-2 px-3 py-1 text-[14px] font-bold text-gray-900 border-r border-gray-200 pr-4">
                    <img src="/images/onramper-hero-orb.svg" className="w-[18px] h-[18px]" /> All Chains
                 </button>
                 <button className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-[#0033AD] mx-1 border border-blue-200">₳</button>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-gray-700 bg-white border border-gray-200 rounded-[0.5rem] shadow-sm hover:bg-gray-50 transition-colors">
                 <Faders size={16} /> Filters
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-gray-700 bg-white border border-gray-200 rounded-[0.5rem] shadow-sm hover:bg-gray-50 transition-colors">
                 <ArrowsLeftRight size={16} /> Compare
              </button>
              <div className="relative w-64 hidden xl:block">
                <input 
                  type="text" 
                  placeholder="Find a Vault" 
                  className="w-full bg-white border border-gray-200 rounded-[0.5rem] py-2 pl-3 pr-8 text-[14px] outline-none focus:border-[#0033AD] transition-colors shadow-sm"
                />
                <MagnifyingGlass className="absolute right-3 top-2.5 text-gray-400" size={16} />
              </div>
           </div>
        </div>

        {/* Vault Table Container */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
           
           {/* Column Headers */}
           <div className="flex justify-between items-center text-[13px] text-gray-500 py-4 px-6 border-b border-gray-200 bg-white">
              <div className="w-1/2 md:w-1/3 pl-2">Vault</div>
              <div className="flex items-center gap-12 md:gap-32 pr-2">
                 <div className="w-24 flex items-center gap-1 cursor-pointer hover:text-gray-800 transition-colors">Est. APY <CaretDown weight="bold" size={12} /></div>
                 <div className="w-24 flex items-center gap-1 cursor-pointer hover:text-gray-800 transition-colors">TVL <CaretDown weight="bold" size={12} /></div>
                 <div className="w-10"></div> {/* Spacing for chevron column */}
              </div>
           </div>

           {/* Table Rows Map */}
           <div className="flex flex-col">
              {vaults.map((vault, index) => {
                 const isExpanded = expandedRow === vault.id;
                 return (
                    <div key={vault.id} className={`${index !== vaults.length - 1 ? 'border-b border-gray-200' : ''}`}>
                       {/* Row Header */}
                       <div 
                         className={`flex justify-between items-center py-6 px-6 cursor-pointer transition-colors ${isExpanded ? 'bg-white' : 'hover:bg-gray-50'}`}
                         onClick={() => setExpandedRow(isExpanded ? null : vault.id)}
                       >
                          {/* Left Column (Icon + Title) */}
                          <div className="flex items-center gap-4 w-1/2 md:w-1/3 pl-2">
                             <div className="w-[42px] h-[42px] bg-gray-50 rounded-full border border-gray-200 flex items-center justify-center relative flex-shrink-0">
                                {vault.id === 'ssADA' ? (
                                  <img src="/images/onramper-hero-orb.svg" className="w-[42px] h-[42px] object-contain opacity-90" />
                                ) : (
                                  <div className="text-gray-400 font-bold text-lg">{vault.name.charAt(2)}</div>
                                )}
                                
                                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-[#0A3FFF] rounded-full flex items-center justify-center">
                                   <span className="text-[8px] text-white font-bold">₳</span>
                                </div>
                             </div>
                             <div>
                                <h3 className="font-bold text-[17px] text-gray-900 leading-none mb-2.5 flex items-center gap-2">
                                  {vault.name}
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                   {vault.labels.map(label => (
                                     <span key={label} className="text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-medium">{label}</span>
                                   ))}
                                   <span className="text-[11px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-medium border border-gray-200 border-dashed">Fees: {vault.fees}</span>
                                </div>
                             </div>
                          </div>

                          {/* Right Column (Data + Chevron) */}
                          <div className="flex items-center gap-12 md:gap-32 pr-2">
                             <div className="w-24 flex flex-col items-start md:items-center">
                                {vault.hasCheck && <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Up To</div>}
                                <div className={`font-bold text-[15px] flex items-center gap-1.5 ${vault.hasCheck ? 'text-[#10B981]' : 'text-gray-900'}`}>
                                   {vault.hasCheck && <CheckCircle weight="fill" className="text-emerald-500" size={15} />}
                                   {!vault.hasCheck && <span className="mr-1.5" />}
                                   {vault.apy}
                                   {vault.hasCheck && <span className="text-[11px] text-gray-400 font-normal leading-none inline-block -translate-y-1">*</span>}
                                </div>
                             </div>
                             
                             <div className="w-24 font-bold text-[15px] text-gray-900 flex justify-start md:justify-center">
                                {vault.tvl}
                             </div>

                             <div className="w-10 flex justify-end">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-[#e5e7eb] shadow-inner' : 'bg-gray-100 hover:bg-gray-200'}`}>
                                   <CaretDown weight="bold" size={14} className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* Expanded UI (Only for ssADA currently) */}
                       <AnimatePresence>
                         {isExpanded && vault.id === 'ssADA' && (
                           <motion.div 
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: "auto", opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="overflow-hidden border-t border-gray-200 bg-white"
                           >
                             <div className="p-6 md:p-8 flex flex-col lg:flex-row gap-4 border border-[#0033AD] m-2 rounded-xl shadow-[0_8px_30px_rgb(0,51,173,0.06)]">
                                
                                {/* Left Panel */}
                                <div className="w-full lg:w-1/3">
                                   <p className="text-[14px] text-gray-600 leading-relaxed mb-6">
                                      Cardano denominated, cross-protocol, cross-asset vault. Optionally lock shares to earn a higher yield by allowing the vault to take on longer duration positions.
                                   </p>
                                   
                                   <div className="flex items-center gap-2 text-[13px] text-gray-500 mb-4 pb-4 border-b border-gray-100">
                                     <span className="font-mono">0x696d02Db93291651ED51...</span>
                                     <button className="hover:text-gray-900 transition-colors"><Copy size={16} /></button>
                                   </div>

                                   {/* Oracle Feed Detail */}
                                   <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                                     <div className="flex items-center gap-2 mb-3">
                                       <span className={`w-1.5 h-1.5 rounded-full ${recommendation.isLive ? "bg-emerald-500" : "bg-amber-400"}`} />
                                       <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                         Charli3 Pull Oracle
                                       </span>
                                     </div>
                                     <div className="grid grid-cols-2 gap-3 text-[12px] mb-3">
                                       <div>
                                         <p className="text-gray-400 mb-0.5">ADA/USD</p>
                                         <p className="font-bold text-gray-900">${recommendation.adaPrice.toFixed(3)}</p>
                                       </div>
                                       <div>
                                         <p className="text-gray-400 mb-0.5">MIN/USD</p>
                                         <p className="font-bold text-gray-900">${recommendation.minPrice.toFixed(4)}</p>
                                       </div>
                                       <div>
                                         <p className="text-gray-400 mb-0.5">Active Strategy</p>
                                         <p className="font-bold text-[#0033AD] capitalize">{recommendation.activeStrategy}</p>
                                       </div>
                                       <div>
                                         <p className="text-gray-400 mb-0.5">Best APY</p>
                                         <p className="font-bold text-emerald-600">{(bestAPY * 100).toFixed(1)}%</p>
                                       </div>
                                     </div>
                                     <p className="text-[11px] text-gray-400 font-mono truncate">
                                       Feed: {ORACLE_CONTRACT_ADDRESS.slice(0, 28)}…
                                     </p>
                                     <p className="text-[11px] text-gray-400 mt-1.5 italic">{recommendation.reason}</p>
                                   </div>

                                   <div className="space-y-6 max-w-sm">
                                      {!connected ? (
                                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-6 text-center">
                                          <p className="text-[13px] text-gray-500 mb-3">Connect your wallet to deposit</p>
                                          <WalletConnect />
                                        </div>
                                      ) : (
                                        <>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              value={depositAmount}
                                              onChange={(e) => setDepositAmount(e.target.value)}
                                              placeholder="0.0"
                                              className="w-full bg-white border border-gray-300 rounded-[0.5rem] py-3 pl-3 pr-16 text-[15px] font-semibold outline-none focus:border-[#0033AD] transition-all shadow-sm"
                                            />
                                            <span className="absolute right-4 top-3 font-semibold text-gray-400">ADA</span>
                                            <div className="text-[12px] text-gray-400 mt-2 text-right">
                                              Wallet: {walletAda.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ADA
                                            </div>
                                          </div>

                                          <button
                                            onClick={handleDeposit}
                                            disabled={txStatus === "pending"}
                                            className="w-full rounded-[0.5rem] bg-[#0033AD] py-3.5 text-[15px] font-bold text-white shadow-md transition-transform active:scale-[0.98] hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                          >
                                            {txStatus === "pending" ? (
                                              <>
                                                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                                </svg>
                                                Submitting…
                                              </>
                                            ) : "Mint ssADA"}
                                          </button>

                                          {txStatus === "success" && txHash && (
                                            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-[12px]">
                                              <p className="font-bold text-emerald-700 mb-1">✓ Transaction submitted</p>
                                              <a
                                                href={`https://preprod.cardanoscan.io/transaction/${txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-mono text-[#0033AD] hover:underline break-all"
                                              >
                                                {txHash.slice(0, 20)}…{txHash.slice(-8)}
                                              </a>
                                            </div>
                                          )}

                                          {txStatus === "error" && txError && (
                                            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[12px]">
                                              <p className="font-bold text-red-700 mb-0.5">Transaction failed</p>
                                              <p className="text-red-600">{txError}</p>
                                            </div>
                                          )}
                                        </>
                                      )}

                                      {ssAdaBalance > 0 && (
                                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                                          <span className="font-semibold text-gray-900">
                                            Position:{" "}
                                            <span className="text-[#0033AD]">{ssAdaBalance.toFixed(2)} ssADA</span>
                                          </span>
                                          <button
                                            onClick={handleWithdraw}
                                            disabled={txStatus === "pending"}
                                            className="text-red-500 font-bold text-[13px] hover:underline uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {txStatus === "pending" ? "…" : "Withdraw"}
                                          </button>
                                        </div>
                                      )}
                                   </div>
                                </div>

                                {/* Right Panel */}
                                <div className="w-full lg:w-2/3 lg:pl-10">
                                   
                                   {/* Nested Tabs Header */}
                                   <div className="flex items-center justify-between mb-8">
                                      <div className="flex items-center border border-gray-200 p-0.5 rounded-lg shadow-sm w-fit">
                                         {['Strategies', 'APY', 'Performance', 'TVL'].map(tab => (
                                           <button 
                                             key={tab}
                                             onClick={() => setActiveTab(tab)}
                                             className={`px-5 py-2 text-[14px] font-bold rounded-md transition-all ${activeTab === tab ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 fill-transparent stroke-transparent hover:text-gray-700'}`}
                                           >
                                             {tab}
                                           </button>
                                         ))}
                                      </div>
                                      <button className="hidden sm:block px-6 py-2.5 text-[14px] font-bold text-white bg-[#0033AD] rounded-lg shadow-sm hover:bg-blue-800 transition-colors">
                                         Go to Vault
                                      </button>
                                   </div>

                                   {/* Tab Content */}
                                   <div className="w-full">
                                      {activeTab === 'Strategies' && (
                                         <div className="flex flex-col md:flex-row gap-6 items-center w-full">
                                            {/* Left Data List */}
                                            <div className="flex-1 w-full flex flex-col space-y-4 pt-2">
                                               {strategies.map((strat, idx) => (
                                                  <div key={idx} className="flex justify-between items-center group w-full">
                                                     <div className="flex items-center gap-4">
                                                        {/* Single Color Dot like Yearn */}
                                                        {strat.color === '#0033AD' ? (
                                                          <div className="w-3 h-3 rounded bg-[#0033AD]" />
                                                        ) : (
                                                          <div className="w-3 h-3 rounded bg-blue-200" />
                                                        )}
                                                        <div>
                                                           <div className="text-[14px] font-medium text-gray-700 leading-tight">
                                                             {strat.name}
                                                           </div>
                                                           <div className="text-[13px] text-gray-500 mt-0.5">$0.00</div>
                                                        </div>
                                                     </div>
                                                  </div>
                                               ))}
                                            </div>

                                            {/* Right Allocation Chart */}
                                            <div className="w-48 h-48 relative flex-shrink-0 mr-8">
                                               <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                                 <circle cx="50" cy="50" r="40" fill="none" stroke="#DBEAFE" strokeWidth="12" />
                                                 {/* Active Strategy Split */}
                                                 <circle cx="50" cy="50" r="40" fill="none" stroke="#0033AD" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset="25.12" className="transition-all duration-1000 ease-out" /> 
                                               </svg>
                                               <div className="absolute inset-0 flex flex-col items-center justify-center text-center mt-1">
                                                  <span className="text-[11px] text-gray-500 font-semibold tracking-wide">allocation %</span>
                                               </div>
                                            </div>
                                         </div>
                                      )}

                                      {activeTab !== 'Strategies' && (
                                         <div className="h-48 w-full flex flex-col items-center justify-center text-gray-400">
                                           <span className="font-medium text-[14px]">Metrics syncing...</span>
                                         </div>
                                      )}
                                   </div>

                                </div>

                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>
                 )
              })}
           </div>
        </div>

      </div>

      {/* Rebalancing Demo Overlay */}
      <AnimatePresence>
        {demoRebalance && (
          <RebalanceAnimation
            fromStrategy={demoRebalance.from}
            toStrategy={demoRebalance.to}
            adaPrice={recommendation.adaPrice}
            minPrice={recommendation.minPrice}
            onClose={() => setDemoRebalance(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
