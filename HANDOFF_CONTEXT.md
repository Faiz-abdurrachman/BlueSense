# BlueSense — Full Handoff Context (for next AI)

> **This doc is everything another AI needs to continue this project.** Read it top-to-bottom before touching any code. Context window: everything from PRD → architecture → what's done → what's broken → what to do next.

---

## 0. TL;DR — What you're walking into

- **Project:** BlueSense — a Cardano DeFi yield aggregator vault (Yearn Finance style) for the **Charli3 Oracles Hackathon 2026**
- **User:** Faiz Abdurrachman — **frontend dev, beginner in smart contracts**. He has a teammate for contract work but is now doing everything himself in "vibe-coding" mode to hit the deadline.
- **Deadline:** **2026-05-19** (submission) — today is **2026-04-19**, so ~1 month runway.
- **Current state:** Web3 deposit/withdraw/rebalance worked previously on Preprod. **A redeploy was done to add yield-simulation functionality, and deposit is now broken with a Plutus script evaluation error.**
- **Blocker:** `Evaluate redeemers failed: spend:0 missingRequiredScripts` error when submitting deposit tx. Init Vault tx succeeded (vault UTxO on-chain has 2 ADA). Deposit fails at Ogmios evaluation stage.
- **User's last message before handoff:** He wanted a full context dump to switch to another AI — you.

---

## 1. Product Overview (from PRD)

**Smart Stake Router / BlueSense** = Single-click DeFi yield aggregator for Cardano ADA holders.

### Problem (from PRD)
- 1.3M Cardano stakers earn 3–5% APY from native staking
- Liqwid offers 8–15%, Minswap LP offers 20–40%
- Nobody bridges the gap with simple UX → barrier too high for normies
- **No dedicated yield aggregator exists on Cardano** (the gap)

### Solution
Deposit ADA → receive **ssADA** share token → vault automatically routes to best-yielding strategy (Native Staking / Liqwid Lending / Minswap LP). **Charli3 Pull Oracle** is the decision engine that feeds on-chain prices to trigger rebalances.

### Core flows (PRD §6 demo scenario)
1. **Deposit:** 100 ADA → mint 100 ssADA (`pricePerShare = 1.0`)
2. **Oracle Pull:** Charli3 feeds ADA/USD + MIN/USD on-chain
3. **Strategy Selection:** Router picks Liqwid (12% APY demo)
4. **Yield Simulation:** Vault's `totalAssets` grows to 102.5 ADA → `pricePerShare = 1.025`
5. **Rebalance:** APY delta >5% → oracle-triggered strategy switch to Minswap
6. **Withdraw:** Burn 100 ssADA → receive 102.5 ADA (2.5 ADA profit)

### Hackathon must-haves (PRD §12)
1. ✅ Vault contract accepting deposit, mints ssADA
2. ✅ Charli3 oracle pull verified on-chain (`reference_input`)
3. ✅ Rebalance demo live
4. ⏳ Demo video (post-submission task)

### Key PRD note
> "Setiap keputusan rebalancing dimulai dari oracle pull — bukan hardcoded. Charli3 adalah jantung produk ini, bukan dekorasi." (Every rebalance decision starts from an oracle pull — not hardcoded. Charli3 is the heart of the product.)

---

## 2. Tech Stack

| Layer | Tech |
|---|---|
| Smart contracts | **Aiken** (compiles to Plutus V3) |
| Blockchain | **Cardano Preprod** testnet |
| Oracle | **Charli3** — consumed two ways: REST API (off-chain UI display) + `reference_input` pattern (on-chain validator verification) |
| Frontend | **React 18 + TypeScript + Vite + TailwindCSS + Framer Motion** |
| Cardano SDK | **Mesh SDK** (`@meshsdk/core@^1.9.0-beta.102`, `@meshsdk/react@^2.0.0-beta.2`) |
| Chain provider | **Blockfrost** (preprod project ID) |
| Wallet | CIP-30 compatible — **Eternl** recommended |

### Key dependency quirk
Mesh SDK is on a **beta** channel. Some APIs behave differently from stable v1.x. Notably: `signTxReturnFullTx(tx, true)` (partialSign=true) is the right call for scripts.

---

## 3. Repo Layout

```
/home/faiz/hackaton/bs/BlueSense/
├── contracts/                    # Aiken smart contracts
│   ├── aiken.toml
│   ├── plutus.json               # Compiled blueprint (CBOR hex for each validator)
│   ├── validators/
│   │   ├── vault_spend.ak        # Main vault spending validator (no params, deterministic hash)
│   │   └── ssada_mint.ak         # ssADA minting policy (parameterized by vault_script_hash)
│   └── lib/bluesense/
│       ├── types.ak              # VaultDatum, VaultRedeemer, Strategy, MintRedeemer
│       ├── math.ak               # calc_mint_amount, calc_redeem_amount (proportional formulas)
│       └── oracle.ak             # Charli3 helpers: find_oracle_input, is_price_fresh, decode_price
├── scripts/
│   └── compute_addresses.mjs     # Derives vault addr + ssADA policy from CBOR (run after aiken build)
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx         # Main UI — deposit, withdraw, rebalance, init, simulate yield
│   │   └── Portfolio.tsx         # User's ssADA holdings view
│   ├── services/
│   │   ├── vaultService.ts       # **CORE** — builds all txs using MeshTxBuilder, encode/decode CBOR datum
│   │   ├── charli3OracleService.ts  # REST client for Charli3 price feeds (off-chain)
│   │   └── strategyRouter.ts     # APY comparison + threshold logic
│   ├── hooks/
│   │   ├── useOraclePrice.ts     # 30s polling of Charli3 REST
│   │   └── useStrategyRecommendation.ts  # Routes strategy based on oracle data
│   └── components/
│       ├── WalletConnect.tsx
│       └── RebalanceAnimation.tsx
├── .env                          # Contract addresses, API keys (in repo, testnet only)
├── prd.md                        # Full PRD (Indonesian)
├── README.md                     # Public hackathon README (has OUTDATED addresses — see §10)
├── PLAN_SUBMISSION.md            # 4-week implementation plan
├── DAY3_PLAN.md                  # Legacy day-3 plan, can ignore
└── HANDOFF_CONTEXT.md            # THIS FILE
```

---

## 4. Smart Contract Architecture

### 4.1 `vault_spend.ak` — no parameters, deterministic hash

**Why no params?** ssADA mint policy needs vault's script hash as a param. If vault had params, this would create a circular dependency. Solution: vault is param-less (stable hash) → ssADA mint is parameterized by that hash → vault stores `ssada_policy_id` in its datum (set at init, validated by mint policy on every mint/burn).

### 4.2 Datum (6 fields, recently changed)
```aiken
pub type VaultDatum {
  total_ada_lovelace: Int,         // lovelace in vault
  total_ssada: Int,                // ssADA in circulation
  strategy: Strategy,              // NativeStaking | LiqwidLending | MinswapLP
  last_rebalance_ms: Int,          // monotonic timestamp
  ssada_policy_id: PolicyId,       // locked at init, validated by mint policy
  yield_accrued_lovelace: Int,     // NEW — simulated yield tracking for APR display
}
```

### 4.3 Redeemer (4 variants)
```aiken
pub type VaultRedeemer {
  Deposit                                       // Constr(0)
  Withdraw                                      // Constr(1)
  Rebalance                                     // Constr(2)
  InjectYield { amount_lovelace: Int }          // Constr(3) — NEW for yield simulation
}
```

### 4.4 On-chain validator invariants

| Redeemer | Rules enforced |
|---|---|
| `Deposit` | ssADA minted > 0, ADA in > 0, datum `total_ada/ssada` incremented, `yield_accrued` unchanged |
| `Withdraw` | ssADA burned > 0, ADA out > 0, datum decremented, `yield_accrued` unchanged |
| `Rebalance` | Charli3 oracle UTxO in `reference_inputs`, oracle `expiry_ms > tx.upper_bound`, ADA/ssADA/yield unchanged, `last_rebalance_ms` strictly increases |
| `InjectYield` | amount > 0, vault ADA += amount, `total_ada += amount`, `yield_accrued += amount`, ssADA/strategy/timestamp UNCHANGED → **pricePerShare rises** |

### 4.5 `ssada_mint.ak` — parameterized by `vault_script_hash`
- `MintSSADA`: verifies vault input exists, `minted == calc_mint_amount(ada_in, totalAda, totalSsada)`
- `BurnSSADA`: verifies `ada_returned >= calc_redeem_amount(burn, totalAda, totalSsada)`
- Both branches preserve `yield_accrued_lovelace` unchanged

---

## 5. Frontend Architecture

### Dashboard (`src/pages/Dashboard.tsx`, 835 lines)
- **Reads chain state** every 30s via `fetchVaultUtxo()` → `parseVaultState()` → `VaultState`
- Shows live TVL = `vaultState.totalAdaLovelace × recommendation.adaPrice`
- Live `pricePerShare = totalAda / totalSsada` (climbs after each InjectYield)
- Four transaction buttons:
  - **Init Vault** (amber, only shows when `vaultState === null`)
  - **Deposit** (uses `buildDepositTx`)
  - **Withdraw** (uses `buildWithdrawTx`)
  - **Force Rebalance** (blue, uses `buildRebalanceTx` with Charli3 reference input)
  - **Simulate Yield** (emerald — injects 0.5 ADA via `buildInjectYieldTx`)

### vaultService.ts (core tx-building)
- Contains **hardcoded CBOR hex** for both scripts — copied from `contracts/plutus.json` after build
- Exports: `buildDepositTx`, `buildWithdrawTx`, `buildRebalanceTx`, `buildInjectYieldTx`, `initializeVault`, `fetchVaultUtxo`, `parseVaultState`
- Does its own **minimal CBOR datum decoder** (handwritten `decodeVaultDatum` — reads 6 fields: 2 ints, strategy constr tag, int, 28-byte policy_id, int)
- Uses `applyCborEncoding()` to wrap the script CBOR before passing to `.txInScript()` / `.mintingScript()` — required because Mesh stores single-wrapped bytes in witness set

### Collateral picker (important detail)
Mesh's `wallet.getCollateral()` sometimes returns half-populated entries on Eternl. `pickCollateral()` handles three cases:
1. Explicit collateral UTxO from wallet (pure ADA) — use directly
2. Fallback: find pure-ADA UTxO in wallet ≥5 ADA
3. Fallback: multi-asset UTxO ≥5 ADA + `setTotalCollateral(5_000_000)` → Mesh auto-generates `collateralReturn`

---

## 6. Current On-Chain State (verified via Blockfrost)

**Vault UTxO at `addr_test1wz8gywuctaraf0sd2nl9z3ut764c2k7cx5h2zf4q9fq2y5czjazyv`:**
```json
{
  "tx_hash": "80f85bbb2e821d7aebae2ed6d3cfefc4cafb5979ca02fd530b5c940dbfd4421f",
  "output_index": 0,
  "amount": [{"unit": "lovelace", "quantity": "2000000"}],
  "inline_datum": "d8799f1a001e848000d879801b0000019da44cddce581cb206d33e09e660750c31d08ab540781c8f3f04eced2f14f7ff8e479a00ff",
  "reference_script_hash": null
}
```

Decoded datum: `Constr(0, [2000000, 0, Constr(0, []), 1763...ms, #b206d33e..., 0])`
→ total_ada=2M lovelace, total_ssada=0, strategy=NativeStaking, ssada_policy_id=`b206d33e...`, yield_accrued=0 ✅

---

## 7. Critical Addresses & IDs (post-redeploy, 2026-04-19)

From `.env` (and fallback constants in `vaultService.ts`):

```bash
VITE_VAULT_ADDRESS=addr_test1wz8gywuctaraf0sd2nl9z3ut764c2k7cx5h2zf4q9fq2y5czjazyv
VITE_VAULT_SCRIPT_HASH=3fd462699e2d67d6610312ef3f866cb722c1d03a40cce931ec06e34b
VITE_SSADA_POLICY_ID=b206d33e09e660750c31d08ab540781c8f3f04eced2f14f7ff8e479a
VITE_SSADA_TOKEN_NAME=737341444100   # "ssADA\0" in hex
VITE_BLOCKFROST_PROJECT_ID=preprodTxuh8diD7reKd5WpUFjxGKxWAFpJ2xOY
VITE_ORACLE_CONTRACT_ADDRESS=addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a
VITE_CHARLI3_API_KEY=cta_hMxHVtJFV8EHYOTIvSfxL62b8wUyVQlGUEd4o2MwN9TpXnaQqmajEFMNOUiuazxQ
VITE_NETWORK=preprod
```

**Charli3 OracleFeed asset** (validator filters ref_inputs by this):
- Policy: `1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07`
- Token name (hex): `4f7261636c6546656564` = `OracleFeed`

**Previous (OLD) addresses — do not use, only in outdated README:**
- OLD vault: `addr_test1wzsawswqa693tszntrfypmf9srkmmhdjqf59nccjpz7z8rcffau7u`
- OLD vault hash: `a1d741c0ee8b15c05358d240ed2580edbdddb2026859e31208bc238f`
- OLD ssADA policy: `1605fc3f5cbf65d6b6c2420ca3dcb373c981bec94bebce648d3bb9b1`

---

## 8. Session History — What's Been Done

### Session 1 (earlier, pre-handoff context): initial build
- Contracts written (Aiken)
- Vault deployed at OLD addresses
- Deposit/Withdraw/Rebalance worked on-chain — verified by commits `7a5a8ef` and `ab197b1`
- Frontend wired, Dashboard shows live TVL

### Session 2 (current, just happened): yield simulation redeploy
1. ✅ Added 6th field `yield_accrued_lovelace: Int` to `VaultDatum`
2. ✅ Added `InjectYield { amount_lovelace }` variant to `VaultRedeemer`
3. ✅ Added `InjectYield` branch to `vault_spend.ak`:
   - Checks vault ADA grew by `amount_lovelace`
   - `total_ada_lovelace` += amount, `yield_accrued` += amount
   - ssADA supply, strategy, timestamp UNCHANGED
   - Effect: pricePerShare rises (matches PRD §6 demo step 4)
4. ✅ Updated `ssada_mint.ak` to preserve `yield_accrued` in mint/burn branches
5. ✅ Rebuilt contracts with `aiken build`
6. ✅ Ran `scripts/compute_addresses.mjs` to derive new vault address, new ssADA policy (parameterized by new vault script hash via `applyParamsToScript` with JSON data format `{ bytes: vaultScriptHash }`)
7. ✅ Updated `.env` and `vaultService.ts` fallback constants with new addresses
8. ✅ Updated `vaultService.ts`:
   - New `VAULT_SCRIPT_CBOR` (4844 hex chars) and `SSADA_MINT_SCRIPT_CBOR` (3212 hex chars)
   - `buildVaultDatumData()` now takes 6th param `yieldAccruedLovelace`
   - `decodeVaultDatum()` extended to read 6-field datum (added `skipCborBytes` helper)
   - All tx builders preserve/update `yield_accrued_lovelace` correctly
   - Added `buildInjectYieldTx()` using `conStr3([integer(Number(yieldLovelace))])` redeemer
   - Added `initializeVault()` — simple payment to vault addr with initial datum, no scripts
9. ✅ Updated `Dashboard.tsx`:
   - `vaultState: VaultState | null` — full state object, not just lovelace
   - Added Init Vault button (amber, only when `!vaultState`)
   - Added Simulate Yield button (emerald, injects 0.5 ADA)
   - Live pricePerShare from chain
10. ✅ Init Vault tx submitted successfully — **vault UTxO created on-chain**
11. ❌ **Deposit tx FAILS** — see §9

### Git state
- Branch: `main`
- Modified files: `Dashboard.tsx`, `charli3OracleService.ts`, `vaultService.ts`
- Untracked: `DAY3_PLAN.md`, `PLAN_SUBMISSION.md`, `HANDOFF_CONTEXT.md`
- Recent commits:
  - `ab197b1` feat: complete on-chain withdraw + rebalance + live TVL + submission README
  - `7a5a8ef` feat(vault): add on-chain deposit/withdraw flow with Plutus V3 contract
  - `de1d056` first commit

---

## 9. **🚨 ACTIVE BUG — Deposit fails with `missingRequiredScripts spend:0`**

### Symptom
User clicks "Mint ssADA" with 5 ADA. `buildDepositTx` throws:
```
Evaluate redeemers failed: Tx evaluation failed:
{"type":"jsonwsp/response","version":"1.0","servicename":"ogmios",
 "methodname":"EvaluateTx","result":
 {"EvaluationFailure":{"ScriptFailures":
  {"spend:0":[{"missingRequiredScripts":{"missing":[{"spend:0"}]}}]}}}
```

This fires during `.complete()` on MeshTxBuilder (Blockfrost evaluator → Ogmios evaluate).

### What I verified BEFORE handoff
1. ✅ Vault UTxO exists on-chain at new address (2 ADA, valid 6-field datum — see §6)
2. ✅ Datum is readable by our decoder (frontend shows TVL = $0.52 correctly = 2 ADA × $0.26)
3. ✅ `Init Vault` button not showing → `vaultState` parsed successfully
4. ✅ Script hash computation from stored `VAULT_SCRIPT_CBOR`:
   - `resolveScriptHash(applyCborEncoding(VAULT_SCRIPT_CBOR), 'V3')` = `3fd462699e2d67d6610312ef3f866cb722c1d03a40cce931ec06e34b` ✅ MATCHES vault address credential
5. ✅ Script hash for ssADA mint:
   - `resolveScriptHash(applyCborEncoding(SSADA_MINT_SCRIPT_CBOR), 'V3')` = `b206d33e09e660750c31d08ab540781c8f3f04eced2f14f7ff8e479a` ✅ MATCHES policy ID in datum
6. ✅ Mesh API calls are correctly ordered (`spendingPlutusScriptV3().txIn().txInScript()` etc.)

### Why I don't fully understand the bug
All the hashes align. Script attachment code uses `.txInScript(applyCborEncoding(VAULT_SCRIPT_CBOR))` which is the exact same pattern that worked before the redeploy. The error means Ogmios sees a spend redeemer referencing a script hash, but no matching script in the witness set.

### Hypotheses (in order of likelihood)

**H1: Browser/Vite cache staleness (MOST LIKELY)**
- User may be running a cached Vite bundle where the OLD `VAULT_SCRIPT_CBOR` is still compiled in
- Old CBOR → old hash → doesn't match new vault UTxO's required hash → `missingRequiredScripts`
- **Fix to try first:** `rm -rf node_modules/.vite`, restart `npm run dev`, hard-refresh browser (Ctrl+Shift+R)

**H2: Mesh beta SDK regression**
- We're on `@meshsdk/core@1.9.0-beta.102` — beta may have a script-attachment bug
- Worth checking: does `.txInScript()` actually persist into witness set when combined with `.mintPlutusScriptV3().mintingScript()` in the same tx?
- Could try downgrading to latest stable `@meshsdk/core` 1.8.x

**H3: CBOR wrapping inconsistency (LOW — we verified hashes match)**
- Stored `VAULT_SCRIPT_CBOR` starts with `590973...` (single CBOR bytestring wrap)
- Stored `SSADA_MINT_SCRIPT_CBOR` starts with `5906435906400101...` (double wrap — `applyParamsToScript` output is already once-wrapped)
- Both pass through `applyCborEncoding()` → hashes match expected values per our tests
- BUT: if Mesh's internal serialization handles them differently, one might still end up wrong in witness set

**H4: Plutus V3 / V2 misdeclaration**
- All `.spendingPlutusScriptV3()` and `.mintPlutusScriptV3()` calls look right
- Aiken build output should be V3 (Aiken defaults to V3 since 1.x)
- Double-check: `plutus.json` plutusVersion field?

### Key code paths for debugging

In `src/services/vaultService.ts`, line ~390–408 (the deposit tx build):
```ts
txBuilder
  .spendingPlutusScriptV3()
  .txIn(vaultUtxo.input.txHash, vaultUtxo.input.outputIndex,
        vaultUtxo.output.amount, vaultUtxo.output.address)
  .txInScript(applyCborEncoding(VAULT_SCRIPT_CBOR))
  .txInInlineDatumPresent()
  .txInRedeemerValue(vaultRedeemer, "JSON");

txBuilder
  .mintPlutusScriptV3()
  .mint(ssadaToMint.toString(), SSADA_POLICY_ID, SSADA_TOKEN_NAME)
  .mintingScript(applyCborEncoding(SSADA_MINT_SCRIPT_CBOR))
  .mintRedeemerValue(mintRedeemer, "JSON");
```

### Suggested debugging path for next AI

1. **First: have the user clear Vite cache + hard-refresh browser** (hypothesis H1). If that fixes it, we're done.
2. **Second:** add logging before `.complete()`:
   ```ts
   console.log("vault hash expected:", VAULT_SCRIPT_HASH);
   console.log("script bytes hash (will be in witness set):",
     resolveScriptHash(applyCborEncoding(VAULT_SCRIPT_CBOR), "V3"));
   ```
   Confirm this runs in browser and matches `3fd462...`.
3. **Third:** inspect the serialized tx body. Call `txBuilder.complete({})` and log the CBOR. Decode the witness set to see what scripts are actually included.
4. **Fourth:** try using Mesh's `UTxO`-based reference script instead of inline script attach:
   - Upload vault script as reference UTxO once
   - Use `spendingTxInReference(txHash, idx)` instead of `txInScript(cbor)`
   - This bypasses the inline-script-attachment path entirely
5. **Fifth (nuclear):** rewrite using direct `@emurgo/cardano-serialization-lib` or `lucid-cardano` — skip Mesh's fluent builder if it's buggy.

### What NOT to do
- ❌ Don't redeploy the contract unless necessary — the on-chain state is fine, the bug is in frontend script attachment
- ❌ Don't change the datum structure — it's correct, verified via Blockfrost
- ❌ Don't change the CBOR hex constants — they hash correctly

---

## 10. Secondary issues / tech debt

### README.md is OUTDATED
Still shows OLD contract addresses (`a1d741c0...` vault hash, `1605fc3f...` ssADA policy). **Needs update** before submission (task #9 pending). Addresses in §7 above should be copied in.

### PLAN_SUBMISSION.md exists
4-week plan document at repo root — generated during this session. Gives the week-by-week breakdown for hackathon submission. Keep it, but is scoped for Faiz+teammate split; now Faiz is doing everything himself.

### Aiken contract code quality is fine
`vault_spend.ak` and `ssada_mint.ak` are clean, 6-field datum consistent everywhere. **Do not modify without good reason.**

### Withdraw minUtxo cap
`buildWithdrawTx` caps burn so vault retains 2 ADA (`MIN_VAULT_LOVELACE`). User eats tiny dust position — acceptable for demo.

### Eternl wallet quirks
- `wallet.getCollateral()` sometimes returns malformed entries — `pickCollateral()` guards against this
- `signTxReturnFullTx(tx, true)` (partialSign=true) is required for tx with scripts

---

## 11. User Preferences & Collaboration Style

**From memory (`~/.claude/projects/.../memory/`):**

- **Faiz is a frontend dev, beginner in smart contracts.** Teammate handles contract work, but Faiz is solo-running this right now.
- **Explain in plain language.** Always structure: **Problem → Fix → Result**. Use analogies (banking, keys & vaults, etc.) — he responds well to these.
- **Bilingual OK.** He writes "gas", "bro", "gw", "lu", "pokoknya" — casual Indonesian mixed with English. Don't force either style.
- **"Vibe coding" mode.** He wants to ship fast, not architect perfectly. Prefer pragmatic hacks > perfect abstractions. He said: "gimana kalo kita kerjian semua dulu bro kan kita vibe coding".
- **Confirm deadlines absolutely.** He corrected "19 April" → "19 May" — deadline is **2026-05-19**.

---

## 12. What to do next (ordered priority)

### Priority 1: Fix deposit bug (§9)
Start with H1 (cache clear + hard refresh). If fails, move to H2 (logging + tx body inspect).

### Priority 2: Complete Week 1 validation
After deposit works:
- Test full flow: init → deposit → simulate yield → verify pricePerShare rises → withdraw
- Verify on Cardanoscan Preprod

### Priority 3: Update README with new addresses
Task #9 — simple find/replace to current addresses from §7.

### Priority 4: Week 2 work from PLAN_SUBMISSION.md
Real strategy allocation — recommendation is **Minswap V2 LP routing** (send portion of vault ADA to Minswap ADA/MIN pool, track LP tokens).

### Priority 5: Polish + demo video
- Week 3: error handling, loading states, edge cases
- Week 4: record demo video following PRD §6 scenario

---

## 13. Quick reference — How to run the app

```bash
cd /home/faiz/hackaton/bs/BlueSense
npm install          # if fresh clone
npm run dev          # Vite dev server at localhost:5173

# If deposit fails:
rm -rf node_modules/.vite
# kill any running npm run dev, restart
npm run dev
# in browser: hard-refresh (Ctrl+Shift+R) or open incognito
```

Contracts rebuild:
```bash
cd contracts
aiken build
# output: contracts/plutus.json

# derive addresses:
cp plutus.json /tmp/blueprints.json
# edit /tmp/blueprints.json to extract cborHex for each validator, save as vault_cbor + ssada_unparam_cbor
node ../scripts/compute_addresses.mjs
# copy outputs back into .env + vaultService.ts
```

Query chain state:
```bash
curl -s "https://cardano-preprod.blockfrost.io/api/v0/addresses/addr_test1wz8gywuctaraf0sd2nl9z3ut764c2k7cx5h2zf4q9fq2y5czjazyv/utxos" \
  -H "project_id: preprodTxuh8diD7reKd5WpUFjxGKxWAFpJ2xOY"
```

---

## 14. Open questions for user (ask if needed)

- Has he hard-refreshed the browser since the redeploy? Did he clear Vite's `.vite` cache?
- Can he share the browser console output (F12 → Console) when deposit fails? We need the `[buildDepositTx] submitTx raw error:` line.
- Is he OK with a small allocation helper contract for Week 2 (Minswap routing) or does he want to keep the strategy field as a logical tag only?

---

**End of handoff document.** Everything needed is above — you should be able to pick up without re-reading any other file except the ones this doc points to. Good luck. 🫡
