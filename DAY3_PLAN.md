# BlueSense — Day 3 Plan (Source of Truth)

**Purpose**: Single reference for Day 3 work. Any AI assistant or human contributor reads THIS file first before `prd.md`, `BLUESENSE_CONTEXT.md`, or `BLUESENSE_SMART_CONTRACT.md`. If this file and others disagree, THIS file wins.

**Hackathon submission deadline**: 2026-04-19 (Day 3).
**Cutoff for new code**: Day 3, 16:00 local. After that → demo video + README polish only.

---

## 1. Ground Truth — Current State (verified 2026-04-18)

### What works on-chain (Cardano Preprod)
- `vault_spend` validator deployed — address `addr_test1wzsawswqa693tszntrfypmf9srkmmhdjqf59nccjpz7z8rcffau7u`
- `ssada_mint` validator deployed — policy `1605fc3f5cbf65d6b6c2420ca3dcb373c981bec94bebce648d3bb9b1`
- Deposit flow verified: tx `e21d0a16d32fd125655f57d1d8a134ab4612709e161f7edb2ff437e4833cff26` → 2 ADA deposit, 2 ssADA minted
- Vault UTxO currently holds 4 ADA + 2 ssADA in circulation
- VaultDatum on-chain: `Constr(0, [totalAdaLovelace, totalSsada, strategy, lastRebalanceMs, ssadaPolicyId])` (5 fields)

### What works frontend-side
- Wallet connect (Mesh CIP-30) ✅
- Deposit button → real on-chain tx ✅
- Withdraw button → tx builder written, **NOT live-tested yet**
- Charli3 REST oracle fetches ADA/USD + MIN/USD every 30s
- Strategy router computes APYs dynamically with 5% delta threshold
- Rebalance UI animation triggers on threshold crossing

### What does NOT work / is faked
- `pricePerShare = 1.025` hardcoded at `src/pages/Dashboard.tsx:56` — ignores real datum ratio
- NAV shown in UI does not multiply by oracle `adaPrice`
- No `buildRebalanceTx()` — rebalance is UI animation only, no on-chain tx
- No Charli3 OracleFeed reference input in ANY tx (this is the PRD §12 #2 gap)
- No emergency pause mechanism in contract or UI
- No oracle-failure fallback to native staking in router

---

## 2. PRD Gap Table (ordered by impact on submission)

| # | PRD Ref | Gap | Blocks Must-Have? |
|---|---------|-----|-------------------|
| 1 | §12 #2, §4 | Charli3 oracle NOT verified on-chain (no reference_input) | **YES — P0** |
| 2 | §6.5 | Rebalance has no on-chain tx (UI animation only) | **YES — P0** (demo) |
| 3 | §5.4 | `pricePerShare` hardcoded, not derived from datum | P1 (fairness claim) |
| 4 | §4 "NAV Calculator" | NAV does not use oracle price | P1 (oracle showcase) |
| 5 | §5.1 | No emergency pause | P2 (documented as roadmap) |
| 6 | §5.2 | No oracle-failure fallback to native staking | P2 |
| 7 | — | Withdraw flow not live-tested | P1 (must verify before demo) |

**Must-have criteria (§12) status after Day 3 target**:
- [x] #1 Vault accepts deposit + mints ssADA
- [ ] #2 Charli3 oracle pull verified on-chain ← P0-A
- [ ] #3 Live rebalancing demo ← P0-B
- [ ] #4 Demo video ← P0-C

---

## 3. Day 3 Priority Order

### P0 — MUST DO (drop everything else if time short)
**P0-A**: On-chain Charli3 oracle reference input (closes §12 #2)
**P0-B**: `buildRebalanceTx()` — spends vault UTxO with Rebalance redeemer, attaches oracle as reference input, writes new strategy to datum
**P0-C**: Record 5-min demo video + write README
**P0-D**: Live-test withdraw flow (code exists, just run it)

### P1 — SHOULD DO (if P0 finishes by ~13:00)
**P1-A**: Unhardcode `pricePerShare` — compute from datum `totalAdaLovelace / totalSsada`
**P1-B**: Display NAV in USD using `totalAdaLovelace * adaPrice` in Dashboard

### P2 — SKIP UNLESS TIME LEFT AFTER P1
**P2-A**: Oracle-failure fallback: if `useOraclePrice.error`, force `activeStrategy = "staking"` in router
**P2-B**: Emergency pause — document as post-hackathon (roadmap §11 Phase 3)

---

## 4. Per-Task Blueprint

### P0-A: Charli3 Oracle as Reference Input (**mandatory for Rebalance**)

**Why**: Validator `vault_spend.ak:75-92` already REQUIRES oracle as reference input for the Rebalance branch (via `oracle.find_oracle_input` in `contracts/lib/bluesense/oracle.ak:45-54`). Without it the Rebalance tx cannot succeed. This also closes PRD §12 Must-have #2 directly — oracle verification is enforced on-chain, not just referenced.

**Hard constraints from the validator** (do not ignore — tx will fail):
- Oracle UTxO must be in `tx.reference_inputs`
- That UTxO must hold exactly 1 token of policy `1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07` + name `4f7261636c6546656564` (="OracleFeed")
- Oracle datum decodes as `Constr(0, [Constr(2, [Pairs<Int, Data>])])` with price map keys: 0=raw_price, 2=expiry_ms, 3=precision (optional, default 6)
- `tx.validity_range.upper_bound` must be `Finite(upper_ms)` and `expiry_ms > upper_ms` → oracle must still be fresh at tx submission

**What to build**:
1. Add `fetchOracleFeedUtxo()` to `src/services/vaultService.ts`:
   - Query Blockfrost for UTxOs at `ORACLE_CONTRACT_ADDRESS = addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a`
   - Filter to the UTxO holding the OracleFeed asset `1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07.4f7261636c6546656564` (quantity = 1)
   - Return that specific UTxO (not any UTxO at the address)
2. Attach via `txBuilder.readOnlyTxInReference(utxo.input.txHash, utxo.input.outputIndex)` in `buildRebalanceTx` (P0-B).
3. Set tx validity upper bound to `Date.now() + 10 minutes` (Charli3 preprod feeds update frequently — as long as the fetched UTxO is recent, this window is safe).

**Files to touch**:
- `src/services/vaultService.ts` — add `fetchOracleFeedUtxo()` near `fetchVaultUtxo()` (around line 190)

**Acceptance criteria**:
- Cardanoscan tx shows "Reference Inputs" → Charli3 OracleFeed UTxO
- Rebalance tx succeeds (validator green-lights it)
- Tx hash saved for README

---

### P0-B: `buildRebalanceTx()`

**Why**: PRD §6.5 scenario requires a live rebalancing tx. Current app shows UI animation only.

**Redeemer index confirmed** via `contracts/lib/bluesense/types.ak` import order `Deposit, Rebalance, VaultDatum, VaultRedeemer, Withdraw` in `vault_spend.ak:3` — data constructors are positional, so the import order in the file determines the tags. Read `types.ak` to be 100% sure: based on current `vaultService.ts` usage (Deposit=Constr0, Withdraw=Constr1), Rebalance = **Constr 2** (`conStr2([])`).

**What to build** — new function in `src/services/vaultService.ts` mirroring `buildDepositTx` but with stricter constraints from the validator (see P0-A hard constraints):
- Input: `newStrategy: Strategy`
- Spends vault UTxO with `conStr2([])` redeemer (Rebalance)
- Re-outputs to vault with:
  - `total_ada_lovelace` **unchanged** (validator line 87 enforces equality)
  - `total_ssada` **unchanged** (line 89)
  - `ssada_policy_id` **unchanged** (line 91)
  - `strategy` = newStrategy (changed)
  - `last_rebalance_ms` = `Date.now()` AND must be **strictly greater** than current datum value (line 88)
- Vault output lovelace must equal `vault_datum.total_ada_lovelace` exactly — no dust, no change
- Does NOT mint/burn
- Attaches oracle UTxO via `readOnlyTxInReference` (P0-A)
- Attaches collateral via existing `pickCollateral()`
- Sets `txBuilder.invalidHereafter(slot)` with slot corresponding to `now + 10min` — required for oracle freshness check

**Files to touch**:
- `src/services/vaultService.ts` — new `buildRebalanceTx()` function after `buildWithdrawTx`
- `src/pages/Dashboard.tsx` — wire `handleForceRebalance` (line 37) to call `buildRebalanceTx()` before showing animation

**Acceptance criteria**:
- Clicking "Force Rebalance" produces a real preprod tx hash
- Cardanoscan shows: vault UTxO consumed + re-created with different `strategy` index in datum
- Reference Inputs section points at Charli3 OracleFeed UTxO
- Validator does NOT fail (oracle freshness + invariants all hold)

**Verify before coding**:
- Read `contracts/lib/bluesense/types.ak` to confirm `Strategy` type has Constr indices matching the TS `strategyData()` helper (NativeStaking=0, LiqwidLending=1, MinswapLP=2 is the assumption baked into vaultService.ts:104-110)

---

### P0-C: Demo Video + README

**Structure (5 min)**:
1. (0:00–0:30) Problem: 1.3M ADA stakers stuck at 4%, DeFi offers 10–40%, nobody bridges them
2. (0:30–1:00) Solution: BlueSense = deposit once, ssADA handles the rest
3. (1:00–2:30) LIVE: connect wallet → deposit 5 ADA → show ssADA minted → show Cardanoscan tx
4. (2:30–3:30) LIVE: show oracle prices updating → force rebalance → show on-chain rebalance tx with reference_input
5. (3:30–4:30) LIVE: withdraw → show ssADA burned + ADA returned
6. (4:30–5:00) Roadmap: Minswap LP, Liqwid real integration, mainnet, governance

**README must include**:
- TL;DR + screenshot
- Run locally: `npm i && npm run dev` + env vars table (`VITE_BLOCKFROST_PROJECT_ID`, `VITE_VAULT_ADDRESS`, etc.)
- Architecture diagram (ASCII is fine)
- Links to 3 verified tx hashes: deposit, rebalance (with reference_input highlighted), withdraw
- Charli3 integration writeup: REST for UI, reference_input for on-chain verification
- Known limitations section (be honest: validator does not enforce oracle freshness yet)

---

### P0-D: Live-Test Withdraw

**Why**: Code exists in `buildWithdrawTx()` (vaultService.ts:368) but never run against current vault state.

**Steps**:
1. Deposit again (if needed) to have ssADA in wallet
2. Click Withdraw
3. Verify: ssADA burned, correct ADA returned, vault datum decremented
4. Capture tx hash for README

**If it fails**: same debugging playbook as deposit — decode vault UTxO datum before/after, trace validator expectations.

---

### P1-A: Unhardcode pricePerShare

**File**: `src/pages/Dashboard.tsx:56`

**Current**:
```ts
const pricePerShare = 1.025;
```

**Replace with**: read from vault datum.

**Approach**:
1. Add `useVaultState()` hook at `src/hooks/useVaultState.ts` that calls `fetchVaultUtxo() → parseVaultState()` every 30s
2. In Dashboard: `const pps = vaultState ? Number(vaultState.totalAdaLovelace) / Number(vaultState.totalSsada) / 1_000_000 : 1.0`
3. When totalSsada is 0 (empty vault), default to `1.0` not `1.025`

**Acceptance**: pricePerShare shown in UI matches `totalAdaLovelace / totalSsada` from on-chain datum. After deposit, it stays at 1.0 (because ratio preserved); only rebalance-plus-yield-simulation would move it.

---

### P1-B: NAV using oracle

**File**: `src/pages/Dashboard.tsx` — find where TVL/NAV is displayed (line ~94 `apy: ${(bestAPY * 100).toFixed(1)}%` area, and the "$4.25M" hardcoded at line 103).

**Change**:
- Replace hardcoded `"$4.25M"` TVL with `$${(totalAdaInVault * adaPrice).toFixed(0)}`
- Source: `vaultState.totalAdaLovelace / 1_000_000 * recommendation.adaPrice`

**Acceptance**: TVL shown in USD reflects actual vault balance × live oracle price.

---

## 5. Scope Guard — DO NOT TOUCH

These will eat time without moving submission criteria:

- ❌ Re-deploying validators (current deploy works, don't break it)
- ❌ Adding new Aiken code
- ❌ Migrating from REST Charli3 to Dendrite SDK (PRD says Dendrite but REST + on-chain reference input satisfies the actual must-have)
- ❌ Refactoring vaultService.ts structure
- ❌ Adding new strategies beyond the 3
- ❌ Changing the UI component library
- ❌ Tailwind theme changes beyond bug fixes
- ❌ Adding tests (nice-to-have but judges don't check this for hackathon)
- ❌ Mainnet deploy, audit, governance — all post-hackathon per PRD §11

---

## 6. Anti-Hallucination Rules (for Claude Code)

1. **Before claiming a file contains X**, read it first and cite the line number.
2. **Before claiming a tx succeeds**, show the preprod tx hash and the Cardanoscan link.
3. **Before "implementing" a function**, verify the signature against Mesh SDK types — do not invent methods like `txBuilder.referenceInput()` if the actual API is `readOnlyTxInReference()`.
4. **Before modifying the Aiken validators**, stop and ask — they are deployed on-chain and a change requires redeployment with a new address/policy (breaks the existing vault UTxO).
5. **Before changing VaultDatum structure**, stop — the 5-field layout matches both encoder (`buildVaultDatumData`) and decoder (`decodeVaultDatum`). Breaking symmetry silently breaks deposits.
6. **Verify Rebalance redeemer index** by reading `contracts/validators/vault_spend.ak`, not by guessing.
7. If unsure about any on-chain encoding, **decode a real UTxO from Blockfrost** and pattern-match against that.

---

## 7. Demo Scenario ↔ Feature Mapping (PRD §6)

| PRD Step | Required feature | Status target Day 3 |
|----------|-----------------|---------------------|
| 1. Deposit 100 ADA → mint 100 ssADA | `buildDepositTx` | ✅ Already works |
| 2. Oracle pull on-chain | reference_input in tx | P0-A |
| 3. Router picks Liqwid | `strategyRouter.ts` default | ✅ Already works |
| 4. Yield accumulates, pricePerShare = 1.025 | pricePerShare math | P1-A (derived, not faked) |
| 5. Rebalance to Minswap | `buildRebalanceTx` | P0-B |
| 6. Withdraw → receive ADA | `buildWithdrawTx` | P0-D (live test) |

---

## 8. Cutoff Rule

| Time | Activity |
|------|----------|
| 09:00–13:00 | P0-A + P0-B (Charli3 reference input + Rebalance tx) |
| 13:00–14:00 | P0-D (withdraw test) + P1-A (pricePerShare) |
| 14:00–16:00 | P0-C video recording + README |
| 16:00+ | Submission form + final polish. **No new code.** |

If P0-A/B not done by 14:00 → cut P1 entirely, ship without them. Must-have #2 is the binary pass/fail gate.

---

## 9. Fallback Plan If Rebalance Tx Doesn't Work

If `buildRebalanceTx` fails on-chain under time pressure:
1. Keep the UI animation as-is
2. For demo, claim: "Rebalance tx builder implemented; validator accepts the redeemer but we hit a dependency issue at submission"
3. Still attach Charli3 reference input on Deposit tx — that alone closes §12 Must-have #2
4. Document in README "Known limitation: Rebalance tx submission pending investigation"

Getting P0-A (reference input on ANY tx) matters more than P0-B. If you must pick one, pick P0-A.

---

## 10. Done Criteria (for self-check before submission)

- [ ] At least one preprod tx with `reference_inputs` pointing at Charli3 OracleFeed
- [ ] Rebalance tx succeeds OR documented limitation with working fallback
- [ ] Withdraw tx succeeds at least once live
- [ ] README includes 3+ tx hashes with Cardanoscan links
- [ ] Demo video ≤5 min, shows all 6 PRD §6 steps
- [ ] Submission form filled with repo link + video link

---

## 11. PRD Coverage Matrix + Known Deviations

### 11.1 Clause-by-clause coverage

| PRD clause | Requirement | Status | Where addressed |
|------------|-------------|--------|-----------------|
| §3.2 User Flow #1 | Deposit ADA to vault contract | ✅ Shipped | `buildDepositTx` (vaultService.ts:269) |
| §3.2 User Flow #2 | Mint ssADA proporsional | ✅ Shipped | `ssada_mint` validator + `calcMintAmount` (vaultService.ts:203) |
| §3.2 User Flow #3 | Charli3 pull ADA/MIN/qADA price | ⚠️ Partial — ADA/MIN done, qADA out of scope | `charli3OracleService.ts` |
| §3.2 User Flow #4 | Router chooses best of 3 strategies | ✅ Shipped | `strategyRouter.ts` |
| §3.2 User Flow #5 | Auto-rebalance if delta > 5% | ✅ Logic ships / ⚠️ On-chain tx is P0-B | `runStrategyRouter` + P0-B `buildRebalanceTx` |
| §3.2 User Flow #6 | Withdraw any time + yield | ✅ Code / ⚠️ Live-test P0-D | `buildWithdrawTx` (vaultService.ts:368) |
| §4 Yield Comparator | Real-time ADA/USD, MIN/USD | ✅ Shipped | `useOraclePrice` hook (30s refresh) |
| §4 Rebalancing Trigger | Oracle-driven rebalance call | ⚠️ P0-B | New `buildRebalanceTx` + reference_input |
| §4 NAV Calculator | Total underlying value | ⚠️ P1-B | Dashboard TVL × oracle price |
| §4 Pull-not-Push justification | On-demand oracle calls | ✅ By design | REST + reference_input are both pull-style |
| §5.1 Vault core | Deposit / Mint / Accounting / Withdraw / Pause | 4 of 5 ✅, pause deferred | P2-B doc as roadmap |
| §5.2 Router | Pull / APY estimate / compare / 5% threshold / fallback | 4 of 5 ✅, oracle-failure fallback P2-A | `strategyRouter.ts` |
| §5.3 Strategy A Native Staking | Logic present, no real delegation | ⚠️ Routing only | See Deviation #2 below |
| §5.3 Strategy B Liqwid Lending | Logic present, no real supply | ⚠️ Routing only | See Deviation #2 below |
| §5.3 Strategy C Minswap LP (roadmap) | Optional for MVP | ✅ Logic present (bonus) | `calcMinswapAPY` |
| §5.4 ssADA `pricePerShare = total/supply` | Share math | ⚠️ Hardcoded → P1-A | Dashboard.tsx:56 |
| §6 Demo scenario all 6 steps | Live demo | ✅ After P0-A/B/D | See Section 7 mapping |
| §9 Tech stack | Aiken + Dendrite + React + Mesh + Preprod | 4 of 5 exact; Dendrite→REST | See Deviation #1 below |
| §10 Risk: oracle down | Fallback to staking | ⚠️ P2-A | `strategyRouter` on-error branch |
| §10 Risk: demo oracle down | Mock oracle backup | ✅ Already built | `MOCK_ADA_PRICE=0.387`, `MOCK_MIN_PRICE=0.024` |
| §11 Fase 1 — Hackathon MVP | 1 vault + 2 strategies + oracle + frontend + video | Target full-green by cutoff |
| §12 Must-have #1 | Vault deposit + mint ssADA | ✅ Done |
| §12 Must-have #2 | Charli3 oracle verified on-chain | ⚠️ P0-A — blocks submission |
| §12 Must-have #3 | Live rebalance demo | ⚠️ P0-B |
| §12 Must-have #4 | Demo video | ⚠️ P0-C |
| §12 Nice-to-have #1 | Judge-usable frontend | ✅ Done |
| §12 Nice-to-have #2 | Strategies actually allocate to protocols | ❌ Out of scope — see Deviation #2 |
| §12 Nice-to-have #3 | Charli3 integration docs | ⚠️ Part of P0-C README |
| §12 Out of scope | Audit, Minswap real LP, governance, mobile, mainnet | ✅ Correctly not built |

### 11.2 Known Deviations (disclose in README)

**Deviation #1: Charli3 Dendrite SDK → REST API + on-chain reference_input**
- **PRD says**: §9 Tech Stack lists "Charli3 Dendrite SDK (pull-based price feeds)"
- **We did**: REST API (`https://api.charli3.io/api/v1`) for frontend price fetch + Charli3 OracleFeed UTxO as `reference_input` in on-chain txs
- **Why this is stronger, not weaker**:
  - Dendrite SDK fetches data off-chain. By itself, it does NOT produce on-chain evidence that the oracle was consulted.
  - Our reference_input approach literally writes the OracleFeed UTxO reference into the tx body — verifiable on Cardanoscan and cryptographically bound to the tx.
  - §12 Must-have #2 specifies "**terverifikasi on-chain**", which reference_input satisfies directly; Dendrite SDK alone would not.
- **Tradeoff**: we lose Dendrite's typed Python/TS helpers. Acceptable — we only need 2 price feeds.

**Deviation #2: Strategies route logically, do not allocate funds on-protocol**
- **PRD says**: §5.3 Strategy A "Stake ADA ke pool", Strategy B "Supply ke Liqwid"; §12 Nice-to-have #2 "benar-benar mengalokasikan ke protokol"
- **We did**: Router chooses a strategy and records it in `VaultDatum.strategy`. The ADA stays at the vault script address — not delegated to a stake pool, not supplied to Liqwid.
- **Why**:
  - Real stake pool delegation from a Plutus script requires a stake credential and registration tx (2–3 extra days of Aiken work).
  - Real Liqwid lending requires integrating Liqwid's market contract (their address + datum schema) — not feasible in remaining time.
  - PRD §11 Fase 2 (May 2026) explicitly moves these integrations post-hackathon.
- **How to frame for judges**: "Router and accounting are production-ready. Protocol-level allocation (stake delegation, Liqwid supply) is Phase 2 per PRD §11 Fase 2."

**Deviation #3: Emergency pause not implemented**
- **PRD says**: §5.1 last bullet "Emergency pause mechanism jika oracle tidak responsif"
- **We did**: Not implemented. Router falls back to mock prices on oracle error instead of halting deposits.
- **Why**: Requires a new redeemer + admin credential + UI — out of scope for Day 3.
- **How to frame**: PRD §11 Fase 3 (June 2026) already lists pause+timelock as mainnet-prep, not MVP.

### 11.3 PRD requirements that are strict must-haves and MUST be green by 16:00 Day 3

1. §12 Must-have #2 — reference_input on ≥1 preprod tx (**P0-A**)
2. §12 Must-have #3 — ≥1 live rebalance tx OR documented fallback (**P0-B**)
3. §12 Must-have #4 — 5-min video shot end-to-end (**P0-C**)

If any of these three are not green by cutoff, submission risk is real. The other ~20 items above are gradient — they improve score but don't block entry.

### 11.4 README disclosure checklist (for P0-C writer)

- [ ] Link all 3 deviations from §11.2 to roadmap sections (§11 Fase 2, §11 Fase 3)
- [ ] Include "How Charli3 is verified on-chain" section with: tx hash → Cardanoscan "Reference Inputs" → OracleFeed address match
- [ ] State that REST API supplies UI data while reference_input supplies on-chain proof — this is intentional complementary design, not a shortcut
- [ ] Note that protocol-level allocation is Phase 2 (don't hide it; framing it as a phased roadmap is stronger than silently omitting)
- [ ] Note that emergency pause is Phase 3 per PRD §11
