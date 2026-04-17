import { useState, useRef, useEffect } from "react";
import { useWallet, useWalletList, useLovelace } from "@meshsdk/react";
import { Wallet, X, CaretDown, SignOut } from "@phosphor-icons/react";

function shortenAddress(addr: string): string {
  if (!addr) return "";
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

function lovelaceToAda(lovelace: string | undefined): string {
  if (!lovelace) return "0.00";
  return (parseInt(lovelace) / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function WalletConnect() {
  const { connected, connecting, connect, disconnect, address } = useWallet();
  const wallets = useWalletList();
  const lovelace = useLovelace();

  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState(wallets);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Re-scan window.cardano when modal opens (extensions may inject after page load)
  useEffect(() => {
    if (!modalOpen) return;
    setDetectedWallets(wallets);
    if (wallets.length > 0) return;

    let attempts = 0;
    const interval = setInterval(() => {
      const cardano = (window as any).cardano;
      if (cardano) {
        const found = Object.keys(cardano)
          .filter((k) => cardano[k] && typeof cardano[k].enable === "function")
          .map((k) => ({
            name: k,
            icon: cardano[k].icon ?? "",
            version: cardano[k].apiVersion ?? "",
          }));
        if (found.length > 0) {
          setDetectedWallets(found as any);
          clearInterval(interval);
          return;
        }
      }
      attempts++;
      if (attempts >= 10) clearInterval(interval);
    }, 300);

    return () => clearInterval(interval);
  }, [modalOpen, wallets]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          disabled={connecting}
          className="flex items-center gap-2 h-10 rounded-lg bg-[#000] px-5 ml-1 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Wallet size={18} />
          {connecting ? "Connecting..." : "Connect wallet"}
        </button>

        {/* Wallet selection modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 relative">
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="font-bold text-[18px] text-gray-900 mb-1">Connect Wallet</h2>
              <p className="text-[13px] text-gray-500 mb-6">
                Select your Cardano wallet to continue
              </p>

              {detectedWallets.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[14px] text-gray-500 mb-4">No Cardano wallet detected.</p>
                  <p className="text-[12px] text-gray-400 mb-4">Scanning for wallets...</p>
                  <a
                    href="https://namiwallet.io"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[14px] font-semibold text-[#0033AD] hover:underline"
                  >
                    Install Nami Wallet →
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {detectedWallets.map((w) => (
                    <button
                      key={w.name}
                      onClick={async () => {
                        await connect(w.name);
                        setModalOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-[#0033AD] hover:bg-blue-50 transition-all group"
                    >
                      <img
                        src={w.icon}
                        alt={w.name}
                        className="w-9 h-9 rounded-lg object-contain"
                      />
                      <span className="font-semibold text-[15px] text-gray-800 capitalize group-hover:text-[#0033AD] transition-colors">
                        {w.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((o) => !o)}
        className="flex items-center gap-2 h-10 rounded-lg bg-[#000] px-4 ml-1 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-gray-800"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        <span className="hidden sm:inline">{shortenAddress(address)}</span>
        <span className="font-normal text-gray-300 hidden sm:inline">·</span>
        <span className="hidden sm:inline">{lovelaceToAda(lovelace)} ₳</span>
        <CaretDown size={14} weight="bold" className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-12 z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-56 py-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Balance</p>
            <p className="text-[16px] font-bold text-gray-900">{lovelaceToAda(lovelace)} ₳</p>
          </div>
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Address</p>
            <p className="text-[12px] font-mono text-gray-700 break-all">{shortenAddress(address)}</p>
          </div>
          <button
            onClick={() => {
              disconnect();
              setDropdownOpen(false);
            }}
            className="flex items-center gap-2 w-full px-4 py-3 text-[14px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
          >
            <SignOut size={16} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
