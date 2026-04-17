import { motion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

export function Navbar() {
  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-6 left-0 right-0 z-50 w-full"
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 md:px-12 pointer-events-none relative">
        
        {/* Left: Logo Pill */}
        <div className="pointer-events-auto flex z-10 h-[52px] items-center justify-center gap-2.5 rounded-full bg-white pl-6 pr-8 shadow-sm">
          <img src="/images/onramper-hero-orb.svg" alt="BlueSense Logo" className="w-[22px] h-[22px] object-contain opacity-90" />
          <span className="font-satoshi text-2xl font-bold tracking-tight text-[#0033AD]">
            BlueSense
          </span>
        </div>

        {/* Center: Links Pill (Absolutely centered for perfect alignment) */}
        <div className="pointer-events-auto z-0 absolute left-1/2 top-1/2 hidden h-[52px] -translate-x-1/2 -translate-y-1/2 items-center gap-8 rounded-full bg-white/10 px-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-white/10 backdrop-blur-2xl md:flex">
          <a href="#" className="font-sans text-sm font-medium text-white transition-colors hover:text-white/70">Vaults</a>
          <a href="#" className="font-sans text-sm font-medium text-white transition-colors hover:text-white/70">Analytics</a>
          
          <button className="font-sans flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-white/70">
            Oracles
            <CaretDown weight="bold" className="h-3 w-3" />
          </button>
          
          <button className="font-sans flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-white/70">
            Strategies
            <CaretDown weight="bold" className="h-3 w-3" />
          </button>
          
          <a href="#" className="font-sans text-sm font-medium text-white transition-colors hover:text-white/70">Docs</a>
        </div>

        {/* Right: Action Buttons */}
        <div className="pointer-events-auto flex z-10 items-center gap-3">
          <button className="font-sans hidden h-[52px] items-center rounded-full bg-white/10 px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-white/20 backdrop-blur-xl transition-all hover:bg-white/20 md:flex">
            View Demo
          </button>
          <Link 
            to="/vault"
            className="font-sans flex h-[52px] items-center rounded-full bg-[#0033AD] px-8 text-[15px] font-semibold text-white shadow-xl transition-transform active:scale-95 hover:bg-blue-800"
          >
            Start Earning
          </Link>
        </div>

      </div>
    </motion.nav>
  );
}
