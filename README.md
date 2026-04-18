# BlueSense

> **Cardano yield aggregator vault with on-chain Charli3 oracle verification.**
> Submitted to **Charli3 Oracles Hackathon 2026** (April 16–19, 2026).

BlueSense is a DeFi vault on Cardano that automatically routes deposits to the
highest-yielding strategy (Native Staking / Liqwid / Minswap LP) based on live
Charli3 oracle price feeds. Rebalancing transactions are permissionless and
require the Charli3 oracle UTxO to be attached as a `reference_input` —
the Plutus V3 validator rejects any rebalance where the oracle feed is stale
or missing.

---

## Hackathon Integration Highlights

| Requirement | Implementation |
|---|---|
| **Charli3 oracle consumed on-chain** | `vault_spend.ak` `Rebalance` branch calls `oracle.find_oracle_input(tx)` + `oracle.is_price_fresh(...)`. Validator fails if oracle UTxO is absent from `reference_inputs` or if `expiry_ms <= tx.validity_range.upper_bound`. |
| **Reference input wiring in tx** | `buildRebalanceTx()` calls `txBuilder.readOnlyTxInReference(oracleUtxo...)` and `txBuilder.invalidHereafter(slot+300)` so the tx TTL falls inside the oracle's freshness window. |
| **ADA/USD feed** | Charli3 preprod `addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a` — `OracleFeed` token policy `1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07`. |
| **Live TVL** | Dashboard computes `TVL = vault.totalAdaLovelace × oracle.adaPrice` — both values live-read (chain + REST). |

---

## Live Deployment (Cardano Preprod)

| Component | Address / ID |
|---|---|
| Vault contract | `addr_test1wzsawswqa693tszntrfypmf9srkmmhdjqf59nccjpz7z8rcffau7u` |
| Vault script hash | `a1d741c0ee8b15c05358d240ed2580edbdddb2026859e31208bc238f` |
| ssADA policy ID | `1605fc3f5cbf65d6b6c2420ca3dcb373c981bec94bebce648d3bb9b1` |
| ssADA token name | `737341444100` (`ssADA\0` hex) |

### Verified Transactions

All three core flows confirmed on preprod. Open in
[Cardanoscan Preprod](https://preprod.cardanoscan.io/) to inspect:

- **Deposit** — mints ssADA via `ssada_mint.MintSSADA`, updates vault datum.
  Tx: `fe2c8556bb8de42f478a...bffe8572`
- **Rebalance** — Charli3 oracle UTxO in `reference_inputs`, validator verifies
  freshness, datum updates `last_rebalance_ms` + strategy.
  Tx: `f960dccbee5c03f56432...178c9e65`
  (inspect → Reference Inputs tab → Charli3 feed UTxO)
- **Withdraw** — burns ssADA via `ssada_mint.BurnSSADA`, returns proportional
  ADA, caps so vault retains `MIN_VAULT_LOVELACE` (2 ADA minUtxo).
  Tx: `e1f9f99e7b0d7d0dd01b...514be465`

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        Frontend (React/Vite)                      │
│  Dashboard ─┬─ useStrategyRecommendation (Charli3 REST → router)  │
│             ├─ useAssets (wallet ssADA balance, via Mesh CIP-30)  │
│             └─ fetchVaultUtxo → parseVaultState (Blockfrost)      │
└──────────────────────────────┬────────────────────────────────────┘
                               │ build & sign tx
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                  vaultService.ts (MeshTxBuilder)                  │
│   • buildDepositTx      → conStr0([]) / mint ssADA                │
│   • buildWithdrawTx     → conStr1([]) / burn ssADA                │
│   • buildRebalanceTx    → conStr2([]) + readOnlyTxInReference()   │
└──────────────────────────────┬────────────────────────────────────┘
                               │ submit
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                     Cardano Preprod (Plutus V3)                   │
│   vault_spend.ak  ─┬─ Deposit:   check ADA↑ + ssADA↑ + datum sync │
│                    ├─ Withdraw:  check ADA↓ + ssADA↓ + datum sync │
│                    └─ Rebalance: check Charli3 ref_input fresh +  │
│                                  ADA/ssADA unchanged + ts↑        │
│   ssada_mint.ak   ─┬─ MintSSADA:  expected_mint == ada_in ratio   │
│                    └─ BurnSSADA:  ada_returned >= expected_ratio  │
└───────────────────────────────────────────────────────────────────┘
```

### Contracts (Aiken)

- `contracts/validators/vault_spend.ak` — spending validator with Deposit,
  Withdraw, Rebalance branches. No parameters (deterministic script hash).
- `contracts/validators/ssada_mint.ak` — minting policy parameterised by
  `vault_script_hash`. Mint/burn only valid when the vault UTxO referenced by
  the redeemer is spent in the same tx.
- `contracts/lib/bluesense/oracle.ak` — Charli3 oracle helpers
  (`find_oracle_input`, `is_price_fresh`, `decode_price`).
- `contracts/lib/bluesense/math.ak` — proportional mint/redeem formulas.
- `contracts/lib/bluesense/types.ak` — `VaultDatum`, `VaultRedeemer`,
  `Strategy`, `MintRedeemer` type definitions.

### Frontend

- `src/services/vaultService.ts` — tx builders (deposit, withdraw, rebalance,
  vault init), datum CBOR encode/decode, asset-aware collateral picker with
  multi-asset `setTotalCollateral` / `collateralReturn` fallback.
- `src/services/charli3OracleService.ts` — REST client for Charli3 Token Data
  API with in-flight dedup and stale-on-429 resilience.
- `src/hooks/useOraclePrice.ts` — 30-second polling of ADA/USD + MIN/USD.
- `src/hooks/useStrategyRecommendation.ts` — runs the router on every oracle
  tick; returns `{ activeStrategy, allStrategies, shouldRebalance, reason }`.
- `src/pages/Dashboard.tsx` — vault UI, force-rebalance button, deposit/withdraw
  forms, live TVL. Reads `totalAdaLovelace` from chain and multiplies by
  oracle price.
- `src/pages/Portfolio.tsx` — wallet ssADA holdings (filtered by policy ID).

---

## How to Run

### Prerequisites
- Node 20+, npm
- A Cardano preprod wallet (Eternl recommended) with ≥10 tADA.
  Fund via [https://docs.cardano.org/cardano-testnet/tools/faucet](https://docs.cardano.org/cardano-testnet/tools/faucet).
- Blockfrost preprod project ID ([blockfrost.io](https://blockfrost.io)).
- Charli3 API key ([charli3.io](https://charli3.io)). Optional — UI falls back
  to mock prices if missing.

### Setup

```bash
git clone <this-repo>
cd BlueSense
npm install
cp .env.example .env   # then fill in your keys
npm run dev
```

### `.env` variables

```
VITE_BLOCKFROST_PROJECT_ID=preprod...
VITE_CHARLI3_API_KEY=cta_...
VITE_CHARLI3_BASE_URL=https://api.charli3.io/api/v1
VITE_NETWORK=preprod

# Contract addresses (already deployed — these defaults work)
VITE_VAULT_ADDRESS=addr_test1wzsawswqa693tszntrfypmf9srkmmhdjqf59nccjpz7z8rcffau7u
VITE_VAULT_SCRIPT_HASH=a1d741c0ee8b15c05358d240ed2580edbdddb2026859e31208bc238f
VITE_SSADA_POLICY_ID=1605fc3f5cbf65d6b6c2420ca3dcb373c981bec94bebce648d3bb9b1
VITE_SSADA_TOKEN_NAME=737341444100
VITE_ORACLE_CONTRACT_ADDRESS=addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a
```

---

## Demo Scenario

1. **Connect Eternl** (preprod network) — wallet balance loads.
2. **Deposit** — type `10` ADA → "Mint ssADA" → Eternl signs → tx submitted.
   Eternl shows `+₳10 to Contract, mint ssADA`. ~20s confirmation on preprod.
3. **Force Rebalance** — click the blue button. Validator requires Charli3
   oracle in `reference_inputs`; `buildRebalanceTx` attaches the live oracle
   UTxO automatically. Open the tx on Cardanoscan → **Reference Inputs** tab →
   see the Charli3 feed UTxO pinned.
4. **Withdraw** — click the red WITHDRAW link. Burns user's ssADA, returns
   proportional ADA (minus 2 ADA kept in vault for minUtxo headroom).

Dashboard TVL moves live with each tx because `vaultLovelace × adaPrice`
re-fetches after every `txHash` change.

---

## Known Deviations from PRD

1. **Charli3 integration via REST + direct `reference_input`**, not Dendrite
   SDK. Dendrite was evaluated but the pull-oracle reference-input pattern is
   simpler and equivalently verifiable on-chain. PRD §12 requirement #2 is
   satisfied.
2. **Strategy routing is logical only** — the validator enforces the strategy
   field in the datum is updated, but there is no real allocation to Liqwid
   or Minswap Plutus contracts yet. A `Strategy` tag swap is a
   demo-representative substitute.
3. **No emergency pause / admin key** — deferred to Phase 3 (post-hackathon).
   Current validator is permissionless: any wallet can rebalance provided the
   oracle freshness check passes.

---

## Build Contracts from Source

```bash
cd contracts
aiken build
# build/ contains compiled plutus.json with cbor for each validator.
```

The frontend embeds the compiled CBOR inline in
`src/services/vaultService.ts` (`VAULT_SCRIPT_CBOR`, `SSADA_MINT_SCRIPT_CBOR`).
If you re-compile, copy the new `cborHex` values from
`contracts/plutus.json` into those constants.

---

## License

MIT.
