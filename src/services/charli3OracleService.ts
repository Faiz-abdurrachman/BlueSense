// Charli3 Oracle Service
// REST API: https://api.charli3.io/api/v1
// Auth: Authorization: Bearer YOUR_API_KEY
//
// How prices work:
//   GET /tokens/current?pool=TICKER_HASH
//   Returns { current_price: number } where price = TOKEN quantity per 1 ADA
//   (e.g. ADA.USDM price = 3.85 means 1 USDM costs 3.85 ADA)
//
//   ADA/USD  = 1 / (usdmPerAda)          e.g. 1 / 3.85 = $0.260
//   MIN/USD  = (minPerAda) * adaUsdPrice  e.g. 0.0215 * 0.260 = $0.0056
//
// Pool tickers: stable identifiers from MinswapV2 (highest liquidity for ADA pairs).
// Verified 2026-04-16 — TVL: USDM pool $5.2M, MIN pool $8.3M.

const MOCK_ADA_PRICE = 0.387;
const MOCK_MIN_PRICE = 0.024;
const CACHE_TTL_MS   = 30_000;

// ADA/USD Feed — Cardano Preprod Testnet
// Source: docs.charli3.io/oracles/resources/networks/preprod
export const ORACLE_CONTRACT_ADDRESS =
  import.meta.env.VITE_ORACLE_CONTRACT_ADDRESS ??
  "addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a";

export const ORACLE_FEED_POLICY_ID =
  "1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07";

// MinswapV2 pool ticker hashes (verified via /symbol_info?group=MinswapV2)
const USDM_POOL_TICKER =
  "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c" +
  "7dd6988c5a86693c76aeec1ea94afa41770be0de21a775ca7a2a1eabdb6a0171";
const MIN_POOL_TICKER =
  "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c" +
  "82e2b1fd27a7712a1a9cf750dfbea1a5778611b20e06dd6a611df7a643f8cb75";

export interface OraclePrices {
  adaPrice: number;   // ADA in USD, e.g. 0.260
  minPrice: number;   // MIN in USD, e.g. 0.0056
  isLive: boolean;
  fetchedAt: Date;
}

interface TokenCurrentResponse {
  current_price?: number;
  current_tvl?: number;
  s?: string;
  errmsg?: string;
}

interface CacheEntry {
  data: OraclePrices;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<OraclePrices> | null = null;

const BASE_URL =
  import.meta.env.VITE_CHARLI3_BASE_URL ?? "https://api.charli3.io/api/v1";
const API_KEY = import.meta.env.VITE_CHARLI3_API_KEY ?? "";

function hasRealKey(): boolean {
  return Boolean(API_KEY) && API_KEY !== "your_api_key_here";
}

async function fetchPool(ticker: string): Promise<TokenCurrentResponse> {
  const res = await fetch(`${BASE_URL}/tokens/current?pool=${ticker}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<TokenCurrentResponse>;
}

// Returns ADA price in USD
export async function fetchADAPrice(): Promise<number> {
  if (!hasRealKey()) return MOCK_ADA_PRICE;
  try {
    const data = await fetchPool(USDM_POOL_TICKER);
    // current_price = how many ADA per 1 USDM → invert for ADA/USD
    const usdmPerAda = data.current_price;
    if (!usdmPerAda || usdmPerAda <= 0) throw new Error("Invalid price");
    return 1 / usdmPerAda;
  } catch {
    return MOCK_ADA_PRICE;
  }
}

// Returns MIN price in USD
export async function fetchMINPrice(adaUsd?: number): Promise<number> {
  if (!hasRealKey()) return MOCK_MIN_PRICE;
  try {
    const data = await fetchPool(MIN_POOL_TICKER);
    // current_price = how many ADA per 1 MIN
    const minPerAda = data.current_price;
    if (!minPerAda || minPerAda <= 0) throw new Error("Invalid price");
    const ada = adaUsd ?? (await fetchADAPrice());
    return minPerAda * ada;
  } catch {
    return MOCK_MIN_PRICE;
  }
}

export async function fetchAllPrices(): Promise<OraclePrices> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  // Coalesce concurrent callers so a cold-start render burst (Dashboard +
  // Vaults + StrictMode double-mount) only fires one upstream request.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    let adaPrice = MOCK_ADA_PRICE;
    let minPrice = MOCK_MIN_PRICE;
    let isLive   = false;

    if (hasRealKey()) {
      try {
        const [usdmData, minData] = await Promise.all([
          fetchPool(USDM_POOL_TICKER),
          fetchPool(MIN_POOL_TICKER),
        ]);

        const usdmPerAda = usdmData.current_price;
        const minPerAda  = minData.current_price;

        if (usdmPerAda && usdmPerAda > 0) {
          adaPrice = 1 / usdmPerAda;
          isLive   = true;
        }
        if (minPerAda && minPerAda > 0 && isLive) {
          minPrice = minPerAda * adaPrice;
        }
      } catch {
        // On upstream failure (incl. 429), serve the most recent cached data
        // past its TTL rather than falling to mocks — keeps the UI stable.
        if (cache) {
          inFlight = null;
          return cache.data;
        }
        isLive = false;
      }
    }

    const result: OraclePrices = { adaPrice, minPrice, isLive, fetchedAt: new Date() };
    cache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
