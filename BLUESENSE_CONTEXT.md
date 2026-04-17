# BLUESENSE — MASTER CONTEXT FOR CLAUDE CODE
> Read this ENTIRE file before writing a single line of code.
> This is your source of truth for the entire project.

---

## 1. SITUASI & DEADLINE

- **Hackathon:** Charli3 Oracles Hackathon 2026
- **Track:** DeFi Applications & Integrations
- **Deadline:** April 16–19, 2026 (kita di hari pertama sekarang)
- **Waktu tersisa:** ~3 hari
- **Repo:** baru di-clone dari senior, mulai dari kondisi saat ini

---

## 2. APA ITU BLUESENSE?

BlueSense adalah **Smart Stake Router** — yield aggregator otomatis di Cardano.

### Konsep inti (1 kalimat):
> "User deposit ADA sekali → sistem otomatis pilih strategi yield terbaik → user tinggal duduk."

### Analogi:
- Mirip **Yearn Finance** (https://yearn.fi/vaults) tapi di Cardano
- User experience = staking biasa
- Di baliknya = DeFi otomatis yang digerakkan oracle

### Nama token:
- User deposit **ADA** → dapat **ssADA** (Smart Stake ADA)
- ssADA = share token, nilainya naik otomatis seiring yield terkumpul
- Mirip aToken di Aave, cToken di Compound

---

## 3. PROBLEM YANG DISELESAIKAN

| Kondisi | APY |
|---|---|
| Native staking Cardano | 3–5% |
| Liqwid lending | 8–15% |
| Minswap LP farming | 20–40% |

**1.3 juta ADA holder** stuck di 3–5% karena:
- DeFi terlalu kompleks (LP, impermanent loss, dll)
- Harus monitor manual tiap hari
- Tidak ada fallback otomatis kalau protokol bermasalah

BlueSense menjembatani gap ini.

---

## 4. CARA KERJA SISTEM (TECHNICAL FLOW)

```
User deposit ADA
      ↓
Vault mint ssADA (proporsional)
      ↓
Charli3 Pull Oracle dipanggil
      ↓
Fetch: ADA/USD, MIN/USD real-time via REST API
      ↓
Router hitung APY tiap strategi:
  - Native Staking: ~4%
  - Liqwid Lending: ~12%
  - Minswap LP: ~20-40%
      ↓
Bandingkan: delta APY > 5%?
      ↓
YA → trigger rebalancing ke strategi terbaik
TIDAK → tetap di strategi saat ini
      ↓
Update pricePerShare = totalAssets / totalSupply
      ↓
User bisa withdraw kapan saja → dapat ADA + yield
```

---

## 5. CHARLI3 ORACLE — DETAIL TEKNIS LENGKAP (SUDAH DIVERIFIKASI)

> ⚠️ INI YANG PALING PENTING. Juri akan spesifik menilai oracle integration.
> Tanpa oracle berjalan = project gagal di mata juri.

### Ada DUA sistem Charli3 yang berbeda:

---

### SISTEM A: Cardano Token Data API (REST) ← GUNAKAN INI UNTUK FRONTEND

Ini yang bisa langsung dipanggil dari frontend hari ini.

- **Base URL:** `https://api.charli3.io/api/v1/`
- **Auth:** Header `Authorization: Bearer YOUR_API_KEY`
- **API Key:** Daftar di Charli3 dashboard — TANYA KE USER apakah sudah punya

#### Endpoint yang dipakai:

```
GET /tokens/current?policy=POLICY_ID
→ Current price untuk satu token

GET /history?symbol=ADA&resolution=1min&from=TIMESTAMP&to=TIMESTAMP
→ OHLCV candles historis

GET /groups
→ List DEX yang tersedia (MinswapV2, SundaeSwap, Aggregate)

GET /symbol_info?group=MinswapV2
→ Trading pairs + policy IDs
```

#### Response shape untuk /history:
```json
{
  "s": "ok",
  "t": [timestamps],
  "o": [open],
  "h": [high],
  "l": [low],
  "c": [close],
  "v": [volume]
}
```

#### Untuk ADA/USD price:
Gunakan `/tokens/current` atau `/history` dengan `symbol=ADA` dan group `Aggregate`

---

### SISTEM B: Pull Oracle On-Chain (Plutus V3) ← UNTUK SMART CONTRACT

Ini "real" Charli3 pull oracle — bukan REST call.
DApp submit transaction ke oracle contract → nodes respond dengan signed data (~300ms) → aggregate on-chain.

**Preprod ADA/USD Feed Details (untuk teammate yang handle smart contract):**
- **Contract address:** `addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a`
- **Feed NFT Policy ID:** `1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07`
- **Hex name:** `4f7261636c6546656564` (OracleFeed)
- **Update frequency:** Setiap 30 menit, trigger juga pada 2% price move

**Strategy untuk hackathon:**
- Frontend: pakai REST API (`/tokens/current`) untuk tampilkan live ADA/USD price
- UI: tampilkan contract address oracle di UI sebagai bukti on-chain integration awareness
- Smart contract (jika ada waktu): integrate dengan Plutus V3 contract di atas

---

### Kenapa Pull Oracle (bukan Push)?
- **Push oracle** = kirim data setiap N detik terus-menerus → boros biaya
- **Pull oracle** = hanya dipanggil saat vault perlu keputusan → efisien

### 3 titik kritis oracle dipakai:

| Peran | Data | Kenapa Kritis |
|---|---|---|
| Yield Comparator | ADA/USD, MIN/USD real-time | Tanpa ini, APY comparison = asumsi |
| Rebalancing Trigger | Delta APY antar protokol | Dipanggil on-demand saat vault perlu keputusan |
| NAV Calculator | Total value semua asset di vault | Harga ssADA harus akurat untuk deposit/withdraw |

### Formula kunci:
```
pricePerShare = totalAssets (dalam ADA) ÷ totalSupply ssADA
```

---

## 6. REFERENSI RESMI — SUDAH DIVERIFIKASI WORKING

### Charli3 (URL yang confirmed working):
- `https://docs.charli3.io` — main docs
- `https://docs.charli3.io/oracles` — oracle overview
- `https://docs.charli3.io/cardano-price-api/quickstart` — REST API quickstart
- `https://docs.charli3.io/oracles/products/pull-oracle/summary` — pull oracle summary
- `https://docs.charli3.io/oracles/products/integration/offchain` — offchain integration
- `https://docs.charli3.io/oracles/resources/networks/preprod` — preprod network details
- `https://docs.charli3.io/oracles/open-source-project/sdk-and-platform-tools/pull-oracle/client-sdk/usage-guide` — SDK usage guide
- `https://api.charli3.io/api/v1/redoc` — API reference

### Cardano / Other:
- **Aiken smart contract:** https://aiken-lang.org/
- **Mesh SDK (wallet):** https://meshjs.dev/
- **Hackathon page:** https://charli3.io/hackathon

---

## 7. CURRENT STATE PROJECT (hasil eksplorasi + verifikasi)

### Yang sudah ada (60% UI):
- ✅ Landing page — Navbar, Hero, BlueSenseFeatures dengan animasi Framer Motion
- ✅ Wallet connection — Mesh SDK integrated, WalletConnect.tsx bisa connect/disconnect, real ADA balance
- ✅ Dashboard UI — vault table dengan filters, expandable rows, strategy donut chart
- ✅ Portfolio UI — position table, recommendations, ssADA holdings via useAssets()
- ✅ Design system — bluesense.css 800+ lines

### File kunci:
```
src/
├── components/
│   ├── WalletConnect.tsx     — Mesh SDK wallet modal
│   ├── BlueSenseFeatures.tsx — marketing features (376 lines)
│   └── Navbar.tsx
├── pages/
│   ├── Dashboard.tsx         — vault management UI (380 lines)
│   └── Portfolio.tsx         — holdings & recommendations (220 lines)
├── App.css
├── bluesense.css             — 800+ lines design tokens
└── main.tsx
```

### Yang BELUM ada (critical untuk hackathon):
- ❌ **Charli3 oracle integration — 0% implemented**
- ❌ Tidak ada `src/services/` directory sama sekali
- ❌ Tidak ada `src/hooks/` directory
- ❌ Semua APY dan TVL masih hardcoded string
- ❌ Tombol Deposit hanya update local state, tidak ada blockchain transaction
- ❌ Tidak ada `.env` / network config
- ❌ Belum ada smart contract (Aiken)

---

## 8. HARDCODED VALUES YANG HARUS DIGANTI (SUDAH DIVERIFIKASI LINE BY LINE)

### Dashboard.tsx:
| Line | Value | Variable |
|---|---|---|
| 24 | `1.025` | pricePerShare |
| 28 | `"12.5%"` | Liqwid strategy APY |
| 29 | `"4.2%"` | Native staking APY |
| 30 | `"28.0%"` | Minswap LP APY |
| 39–68 | `"12.5%"`, `"8.43%"`, `"42.0%"`, `"5.1%"` | Vault APYs (4 vaults) |
| 39–68 | `"$4.25M"`, `"$1.21M"`, `"$850K"`, `"$2.1M"` | Vault TVLs |

### Portfolio.tsx:
| Line | Value | Variable |
|---|---|---|
| 31 | `"12.5%"` | ssADA recommendation APY |
| 32 | `"$4.25M"` | ssADA recommendation TVL |
| 39 | `"5.1%"` | iUSD recommendation APY |
| 40 | `"$2.1M"` | iUSD recommendation TVL |
| 47 | `"4.44%"` | Djed recommendation APY |
| 48 | `"$8.81M"` | Djed recommendation TVL |
| 55 | `"0.75%"` | HOSKY recommendation APY |
| 56 | `"$3.62M"` | HOSKY recommendation TVL |

---

## 9. TECH STACK

| Layer | Teknologi |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS + bluesense.css custom |
| Animation | Framer Motion |
| Wallet | Mesh SDK |
| Oracle REST | Charli3 Token Data API (`api.charli3.io`) |
| Oracle On-chain | Charli3 Pull Oracle (Plutus V3, untuk smart contract) |
| Smart Contract | Aiken (belum dibangun) |
| Network | Cardano Preprod Testnet |

---

## 10. FILE YANG PERLU DIBUAT — URUTAN PRIORITAS

### PRIORITAS 1 — `.env` setup (5 menit)
```env
VITE_CHARLI3_API_KEY=your_api_key_here
VITE_CHARLI3_BASE_URL=https://api.charli3.io/api/v1
VITE_ORACLE_CONTRACT_ADDRESS=addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a
VITE_NETWORK=preprod
```

### PRIORITAS 2 — `src/services/charli3OracleService.ts`
```typescript
// Tujuan: fetch ADA/USD dan MIN/USD dari Charli3 REST API
// Endpoint: GET https://api.charli3.io/api/v1/tokens/current
// Auth: Authorization: Bearer ${VITE_CHARLI3_API_KEY}
// Harus include:
// - TypeScript types untuk response
// - Error handling dengan fallback mock data kalau API fail
// - Caching sederhana (jangan fetch ulang kalau data < 30 detik)
// - Export: fetchADAPrice(), fetchMINPrice(), fetchAllPrices()
// - Export: ORACLE_CONTRACT_ADDRESS (untuk display di UI)

// FALLBACK mock values (jika API key belum ada atau API fail):
// ADA/USD: 0.387
// MIN/USD: 0.024
```

### PRIORITAS 3 — `src/hooks/useOraclePrice.ts`
```typescript
// React hook yang wrap charli3OracleService
// Return: {
//   adaPrice: number,
//   minPrice: number,
//   loading: boolean,
//   error: string | null,
//   lastUpdated: Date | null,
//   isLive: boolean  // true jika dari API real, false jika mock
// }
// Auto-refresh setiap 30 detik
```

### PRIORITAS 4 — `src/services/strategyRouter.ts`
```typescript
// Decision engine — pilih strategi terbaik
// Input: { adaPrice: number, minPrice: number }
// Logic:
//   THRESHOLD = 0.05 (5%)
//   Hitung APY setiap strategi:
//     - Native Staking: BASE 4%, tidak dipengaruhi price
//     - Liqwid Lending: 8-15%, naik saat ADA price tinggi
//     - Minswap LP: 20-40%, berkorelasi dengan MIN/ADA ratio
//   Bandingkan: kalau best_apy - current_apy > THRESHOLD → rebalance
// Return: {
//   currentBest: 'staking' | 'liqwid' | 'minswap',
//   shouldRebalance: boolean,
//   allStrategies: { name, apy, risk }[],
//   reason: string  // untuk display di UI
// }
```

### PRIORITAS 5 — `src/hooks/useStrategyRecommendation.ts`
```typescript
// Combine useOraclePrice + strategyRouter
// Return: { recommendedStrategy, currentStrategy, shouldRebalance, apyComparison }
```

### PRIORITAS 6 — Update `Dashboard.tsx`
- Import `useOraclePrice` dan `useStrategyRecommendation`
- Replace hardcoded APY dengan oracle-derived values
- Tambah "Oracle Feed" section: tampilkan ADA/USD live price
- Tambah badge: "Powered by Charli3" dengan contract address
- Tambah timestamp: "Last updated: X seconds ago"
- Tambah visual indicator: hijau kalau oracle live, kuning kalau mock/fallback

### PRIORITAS 7 — Rebalancing Animation
- Tambah visual animasi saat strategy berubah
- Show: "Oracle detected delta > 5% → Rebalancing to [strategy]"
- Ini yang bikin demo WOW di mata juri

---

## 11. DEMO FLOW UNTUK JURI (5 MENIT) — TARGET AKHIR

```
1. [0:00] Buka app — juri langsung lihat:
          "Oracle Feed: ADA/USD $0.387 — Live via Charli3"
          badge hijau = oracle connected

2. [0:30] Connect wallet → real ADA balance muncul

3. [1:00] Deposit 100 ADA
          → Vault mint 100 ssADA
          → pricePerShare = 1.0

4. [1:30] Oracle pull terjadi (real-time)
          → Fetch ADA/USD dan MIN/USD dari Charli3
          → Router: Liqwid (12%) vs Staking (4%) → delta 8% > 5%

5. [2:00] Auto rebalancing trigger
          → Animasi: dana pindah dari Staking ke Liqwid
          → "Oracle triggered rebalancing: +8% APY improvement"

6. [2:30] Simulasi yield accumulate
          → totalAssets: 100 → 102.5 ADA
          → pricePerShare: 1.0 → 1.025

7. [3:00] APY shift simulasi
          → Minswap naik ke 20%
          → Oracle detect delta > 5% lagi
          → Rebalancing ke Minswap

8. [3:30] Withdraw
          → Redeem 100 ssADA → dapat 102.5 ADA
          → "Profit: +2.5 ADA, zero manual effort"

9. [4:00] Closing statement:
          "Every decision was driven by Charli3 oracle.
           Not hardcoded. Not guessed. Verifiable on-chain."
```

---

## 12. RISIKO DAN MITIGASI

| Risiko | Solusi |
|---|---|
| Belum punya Charli3 API key | Gunakan mock data dulu. Flag dengan "Demo Mode" badge di UI. Tetap tunjukkan code integration yang benar |
| API key ada tapi rate limited | Cache response 30 detik. Fallback ke mock gracefully |
| Smart contract belum ada | Mock deposit/withdraw dengan local state. Focus demo ke oracle decision engine |
| Charli3 API down saat demo | Siapkan mock yang sudah di-hardcode dengan nilai realistis ($0.387) sebagai fallback otomatis |

---

## 13. DEFINISI MVP YANG CUKUP UNTUK MENANG

**WAJIB ada:**
1. ✅ Charli3 oracle service berjalan (REST API atau mock yang realistis)
2. ✅ APY comparison logic dengan 5% threshold yang terlihat di UI
3. ✅ Oracle price visible dan live di Dashboard (bukan hardcoded)
4. ✅ "Powered by Charli3" dengan contract address ditampilkan
5. ✅ Demo flow 5 menit yang smooth dan bisa dijelaskan

**TIDAK perlu untuk hackathon:**
- ❌ Smart contract on-chain yang benar-benar execute
- ❌ Minswap LP integration
- ❌ Security audit
- ❌ Mainnet deployment

---

## 14. INSTRUKSI UNTUK CLAUDE CODE — LAKUKAN SECARA BERURUTAN

**STEP 1:** Tanya user — "Apakah sudah punya Charli3 API key? Jika sudah, share di sini. Jika belum, kita mulai dengan mock dulu."

**STEP 2:** Buat `.env` file di root project

**STEP 3:** Buat `src/services/charli3OracleService.ts` — real API call + fallback mock

**STEP 4:** Buat `src/hooks/useOraclePrice.ts`

**STEP 5:** Buat `src/services/strategyRouter.ts`

**STEP 6:** Update `Dashboard.tsx` — replace hardcoded values, tambah oracle feed display

**STEP 7:** Tunjukkan hasil ke user sebelum lanjut ke step berikutnya

**PENTING:**
- Jangan sentuh landing page atau styling yang sudah ada
- Setiap file baru harus TypeScript strict, proper error handling
- Selalu sediakan mock fallback untuk setiap external API call
- Commit setelah setiap step: `git add . && git commit -m "feat: ..."`

---

*Context terakhir diupdate: April 16, 2026 — Hari 1 Hackathon*
*API info verified dari: docs.charli3.io + api.charli3.io/api/v1/redoc*
*Project: BlueSense / Smart Stake Router*
*Hackathon: Charli3 Oracles Hackathon 2026*