import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Strategy, StrategyId } from "../services/strategyRouter";

interface Props {
  fromStrategy: Strategy;
  toStrategy: Strategy;
  adaPrice: number;
  minPrice: number;
  onClose: () => void;
}

type Phase = 0 | 1 | 2 | 3 | 4 | 5;

const STRATEGY_META: Record<StrategyId, { label: string; icon: string; color: string; bg: string }> = {
  staking:  { label: "Native Staking",  icon: "₳", color: "#6b7280", bg: "#f3f4f6" },
  liqwid:   { label: "Liqwid Lending",  icon: "L", color: "#0033AD", bg: "#eff6ff" },
  minswap:  { label: "Minswap LP",      icon: "M", color: "#10b981", bg: "#f0fdf4" },
};

// Phase timings (ms from mount)
const PHASE_TIMES: Record<Phase, number> = {
  0: 0,
  1: 350,
  2: 1200,
  3: 2300,
  4: 3000,
  5: 4600,
};

export function RebalanceAnimation({ fromStrategy, toStrategy, adaPrice, minPrice, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>(0);
  const delta = toStrategy.apy - fromStrategy.apy;
  const fromMeta = STRATEGY_META[fromStrategy.id];
  const toMeta   = STRATEGY_META[toStrategy.id];

  // Sorted strategies for bar chart (descending APY)
  const bars = [
    { id: fromStrategy.id, label: STRATEGY_META[fromStrategy.id].label, apy: fromStrategy.apy, isFrom: true, isTo: false },
    { id: toStrategy.id,   label: STRATEGY_META[toStrategy.id].label,   apy: toStrategy.apy,   isFrom: false, isTo: true  },
    { id: "staking",       label: "Native Staking", apy: 0.042,          isFrom: fromStrategy.id === "staking", isTo: toStrategy.id === "staking" },
  ]
    .filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i) // dedupe
    .sort((a, b) => b.apy - a.apy);

  const maxBarAPY = Math.max(...bars.map(b => b.apy));

  useEffect(() => {
    const timers = ([1, 2, 3, 4, 5] as Phase[]).map((p) =>
      setTimeout(() => setPhase(p), PHASE_TIMES[p])
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && phase >= 5) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[620px] overflow-hidden"
      >
        {/* ── HEADER ── */}
        <div className="relative bg-gradient-to-r from-[#001f80] via-[#0033AD] to-blue-500 px-7 py-5 overflow-hidden">
          {/* subtle grid lines */}
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
          />
          <div className="relative flex items-center gap-2.5 mb-1.5">
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"
            />
            <span className="text-white/60 text-[11px] font-bold uppercase tracking-widest">
              Charli3 Pull Oracle
            </span>
          </div>
          <h2 className="relative text-white text-[20px] font-bold leading-tight">
            Oracle Triggered Rebalancing
          </h2>
        </div>

        <div className="px-7 py-6 space-y-5">

          {/* ── PHASE 1: Oracle prices ── */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { label: "ADA / USD",   value: `$${adaPrice.toFixed(3)}`,       sub: "Live via Charli3",       subColor: "text-emerald-500" },
                  { label: "MIN / USD",   value: `$${minPrice.toFixed(4)}`,        sub: "Live via Charli3",       subColor: "text-emerald-500" },
                  { label: "APY Delta",   value: `+${(delta * 100).toFixed(1)}%`,  sub: "Threshold exceeded",     subColor: "text-amber-500"   },
                ].map(({ label, value, sub, subColor }) => (
                  <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-[22px] font-bold text-gray-900 leading-none mb-1">{value}</p>
                    <p className={`text-[11px] font-semibold ${subColor}`}>● {sub}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASE 2: APY comparison bars ── */}
          <AnimatePresence>
            {phase >= 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Strategy Comparison
                </p>
                <div className="space-y-3">
                  {bars.map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.12, duration: 0.3 }}
                    >
                      <div className="flex items-center justify-between text-[12px] mb-1.5">
                        <span className={`font-medium ${b.isTo ? "text-emerald-700 font-bold" : "text-gray-600"}`}>
                          {b.label}
                          {b.isFrom && !b.isTo && (
                            <span className="ml-1.5 text-gray-400 font-normal">(current)</span>
                          )}
                          {b.isTo && (
                            <span className="ml-1.5 text-emerald-600 font-bold">← Best</span>
                          )}
                        </span>
                        <span className={`font-bold ${b.isTo ? "text-emerald-600" : "text-gray-600"}`}>
                          {(b.apy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(b.apy / maxBarAPY) * 100}%` }}
                          transition={{ duration: 0.9, delay: i * 0.12, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{
                            background: b.isTo
                              ? "linear-gradient(90deg, #10b981, #34d399)"
                              : b.isFrom
                              ? "#0033AD"
                              : "#d1d5db",
                          }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASE 3: Decision callout ── */}
          <AnimatePresence>
            {phase >= 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
              >
                <span className="text-xl flex-shrink-0">⚡</span>
                <p className="text-[13px] font-semibold text-amber-800">
                  Delta +{(delta * 100).toFixed(1)}% exceeds the 5% threshold —
                  initiating rebalance
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASE 4: Fund flow animation ── */}
          <AnimatePresence>
            {phase >= 4 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
              >
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Rebalancing Funds
                </p>

                <div className="flex items-center gap-3">
                  {/* FROM card */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 rounded-xl p-4 text-center border-2 border-gray-200"
                    style={{ backgroundColor: fromMeta.bg }}
                  >
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">From</p>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-[14px] mx-auto mb-2"
                      style={{ backgroundColor: fromMeta.color }}
                    >
                      {fromMeta.icon}
                    </div>
                    <p className="font-bold text-gray-700 text-[13px] leading-tight">{fromMeta.label}</p>
                    <p className="text-[20px] font-bold text-gray-500 mt-0.5">{(fromStrategy.apy * 100).toFixed(1)}%</p>
                  </motion.div>

                  {/* Animated flow path */}
                  <div className="relative flex-shrink-0 w-24 h-14 flex items-center justify-center">
                    <svg viewBox="0 0 96 24" className="w-full overflow-visible" fill="none">
                      {/* Track */}
                      <line x1="4" y1="12" x2="92" y2="12" stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />
                      {/* Animated fill */}
                      <motion.path
                        d="M 4 12 L 88 12"
                        stroke="#0033AD"
                        strokeWidth="3"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.3, ease: "easeInOut" }}
                      />
                      {/* Arrowhead */}
                      <motion.polygon
                        points="88,7 96,12 88,17"
                        fill="#0033AD"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.1 }}
                      />
                    </svg>

                    {/* Moving ADA dots */}
                    {[0, 0.35, 0.7].map((delay) => (
                      <motion.div
                        key={delay}
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: "#0033AD",
                          boxShadow: "0 0 8px rgba(0,51,173,0.7)",
                          left: 0,
                        }}
                        animate={{ left: "calc(100% - 12px)", opacity: [0, 1, 1, 0] }}
                        transition={{ duration: 1.0, delay, ease: "easeInOut" }}
                      />
                    ))}
                  </div>

                  {/* TO card */}
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0, borderColor: ["#e5e7eb", "#10b981"] }}
                    transition={{ duration: 0.3, borderColor: { delay: 1.1, duration: 0.4 } }}
                    className="flex-1 rounded-xl p-4 text-center border-2"
                    style={{ backgroundColor: toMeta.bg }}
                  >
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1.5">To</p>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-[14px] mx-auto mb-2"
                      style={{ backgroundColor: toMeta.color }}
                    >
                      {toMeta.icon}
                    </div>
                    <p className="font-bold text-emerald-800 text-[13px] leading-tight">{toMeta.label}</p>
                    <p className="text-[20px] font-bold text-emerald-600 mt-0.5">{(toStrategy.apy * 100).toFixed(1)}%</p>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASE 5: Complete ── */}
          <AnimatePresence>
            {phase >= 5 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="text-2xl"
                  >
                    ✅
                  </motion.span>
                  <div>
                    <p className="font-bold text-emerald-800 text-[14px]">Rebalancing Complete</p>
                    <p className="text-[12px] text-emerald-600 mt-0.5">
                      APY +{(delta * 100).toFixed(1)}% — every decision powered by Charli3 oracle
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-[#0033AD] text-white text-[13px] font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0"
                >
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </motion.div>
  );
}
