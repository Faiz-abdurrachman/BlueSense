# BlueSense Smart Contract Specification
> Aiken v1.1.x · stdlib v2.x · Cardano Preprod Testnet

---

## 1. Project Structure

```
contracts/
├── aiken.toml
├── lib/
│   └── bluesense/
│       ├── types.ak        -- shared type definitions
│       ├── oracle.ak       -- Charli3 oracle decoding helpers
│       └── math.ak         -- price/share math helpers
└── validators/
    ├── ssada_mint.ak       -- ssADA minting policy
    └── vault_spend.ak      -- vault UTxO spend validator
```

### aiken.toml

```toml
name = "bluesense"
version = "0.0.1"

[[dependencies]]
name = "aiken-lang/stdlib"
version = "v2"
source = "github"
```

---

## 2. Token Definitions

| Token | Policy | Token Name (hex) | Token Name (ASCII) |
|-------|--------|------------------|--------------------|
| ssADA | `ssada_mint` validator (computed at deploy) | `737341444100` | `ssADA\0` |
| Oracle Feed | `1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07` | `4f7261636c6546656564` | `OracleFeed` |

---

## 3. Charli3 Oracle — Preprod Network

### Feed Addresses

| Feed | Contract Address | Policy ID |
|------|-----------------|-----------|
| ADA/USD | `addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a` | `1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07` |
| ADA/C3  | `addr_test1wr64gtafm8rpkndue4ck2nx95u4flhwf643l2qmg9emjajg2ww0nj` | `5e4a2431a465a00dc5d8181aaff63959bb235d97013e7acb50b55bc4` |

All feeds share token name: `4f7261636c6546656564` (`OracleFeed`)

### Oracle Datum CDDL (from Charli3 oracle-datum-lib)

```cddl
oracle_datum      = #6.121(oracle_datum_list)
oracle_datum_list = [ ? shared_data, 1* generic_data, ? extended_data ]

generic_data = price_data
price_data   = #6.123([price_map])
price_map    = {
  ? 0 : price,       -- raw price integer (divide by 10^precision)
  ? 1 : posixtime,   -- data timestamp (POSIX ms)
  ? 2 : posixtime,   -- expiry time     (POSIX ms)
  ? 3 : precision,   -- decimal places, e.g. 6
  ? 4 : asset_id,    -- base  currency script hash
  ? 5 : asset_id,    -- quote currency script hash
  ? 6 : asset_symbol,
  ? 7 : asset_symbol,
  ? 8 : asset_name,
  ? 9 : asset_name
}

shared_data   = #6.121([shared_map])
shared_map    = { ? 0 : price_map }

extended_data = #6.122([extended_map])
extended_map  = {
  ? 0 : oracle_provider_id,       -- uint
  ? 1 : data_source_count,        -- uint
  ? 2 : data_signatories_count,   -- uint
  ? 3 : oracle_provider_signature -- text string
}

precision  = uint
price      = uint
posixtime  = uint   -- milliseconds since Unix epoch
```

### Plutus Data Encoding

CBOR tags map to Plutus constructors:

| CDDL tag | Plutus Constr | Meaning |
|----------|--------------|---------|
| `#6.121` | `Constr(0, [...])` | oracle_datum outer wrapper / shared_data |
| `#6.122` | `Constr(1, [...])` | extended_data |
| `#6.123` | `Constr(2, [...])` | price_data |

`price_map` is encoded as **Plutus Map data**: `Map(List<Pair<Data, Data>>)` with integer keys.

### Price Decoding Formula

```
actual_price_usd = raw_price / 10^precision
```

Example: `raw_price = 387000`, `precision = 6` → `$0.387000`

### Staleness Check

Reject the oracle datum if:
```
expiry_posix_ms < upper_bound_of_tx_validity_range
```

Use 300-second (5-minute) maximum age as the liveness threshold.

---

## 4. Aiken Type Definitions — `lib/bluesense/types.ak`

```aiken
use cardano/assets.{PolicyId, AssetName}
use cardano/transaction.{OutputReference}

// ── Strategy enum ─────────────────────────────────────────────────────────────

pub type Strategy {
  NativeStaking   // ~3-5% APY, lowest risk
  LiqwidLending   // ~8-15% APY, medium risk
  MinswapLP       // ~20-40% APY, highest risk
}

// ── Vault inline datum ────────────────────────────────────────────────────────
// Stored on the vault UTxO (always inline datum).
// total_ssada / total_ada_lovelace defines the price-per-share.

pub type VaultDatum {
  total_ada_lovelace: Int,   // total ADA held by vault (lovelace)
  total_ssada: Int,          // total ssADA tokens in circulation
  strategy: Strategy,
  last_rebalance_ms: Int,    // POSIX ms of last rebalance
}

// ── Vault redeemer ─────────────────────────────────────────────────────────────

pub type VaultRedeemer {
  Deposit
  Withdraw
  Rebalance
}

// ── ssADA mint redeemer ────────────────────────────────────────────────────────

pub type MintRedeemer {
  MintSSADA { vault_utxo_ref: OutputReference }
  BurnSSADA { vault_utxo_ref: OutputReference }
}
```

---

## 5. Oracle Helpers — `lib/bluesense/oracle.ak`

```aiken
use aiken/builtin
use aiken/collection/list
use cardano/assets.{PolicyId}
use cardano/transaction.{Input, Transaction}

pub const oracle_ada_usd_policy_id: PolicyId =
  #"1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07"

pub const oracle_token_name: ByteArray = #"4f7261636c6546656564"

pub const staleness_threshold_ms: Int = 300_000  // 5 minutes in ms

// Find the oracle reference input by policy ID + token name.
pub fn find_oracle_input(tx: Transaction) -> Input {
  expect Some(input) =
    list.find(
      tx.reference_inputs,
      fn(inp) {
        assets.quantity_of(
          inp.output.value,
          oracle_ada_usd_policy_id,
          oracle_token_name,
        ) == 1
      },
    )
  input
}

// Decode the oracle datum and return (raw_price, expiry_ms, precision).
// oracle_datum  = Constr(0, [item1, item2, ...])
// price_data    = Constr(2, [price_map])
// price_map     = Map([(Int(0), price), (Int(2), expiry), (Int(3), precision)])
pub fn decode_price(datum: Data) -> (Int, Int, Int) {
  // Unwrap outer oracle_datum Constr(0, [...])
  let Pair(0, fields) = builtin.un_constr_data(datum)

  // Find first Constr(2, ...) = price_data
  expect Some(price_data) =
    list.find(
      fields,
      fn(item) {
        let Pair(tag, _) = builtin.un_constr_data(item)
        tag == 2
      },
    )

  // Unwrap price_data Constr(2, [price_map])
  let Pair(2, price_fields) = builtin.un_constr_data(price_data)
  expect [price_map_data, ..] = price_fields

  // price_map is Plutus Map data
  let pairs = builtin.un_map_data(price_map_data)

  // Helper: look up integer key in the map
  let find_int =
    fn(key: Int) -> Option<Int> {
      when
        list.find(
          pairs,
          fn(p) { builtin.un_i_data(builtin.fst_pair(p)) == key },
        )
      is {
        Some(pair) -> Some(builtin.un_i_data(builtin.snd_pair(pair)))
        None -> None
      }
    }

  expect Some(raw_price) = find_int(0)
  expect Some(expiry_ms) = find_int(2)
  let precision =
    when find_int(3) is {
      Some(p) -> p
      None -> 6  // Charli3 default
    }

  (raw_price, expiry_ms, precision)
}

// Returns True if the oracle datum is still fresh.
// expiry_ms must be after the upper bound of the tx validity range.
pub fn is_price_fresh(expiry_ms: Int, tx: Transaction) -> Bool {
  when tx.validity_range.upper_bound.bound_type is {
    Finite(upper_ms) -> expiry_ms > upper_ms
    _ -> False
  }
}

// Convert raw_price + precision to lovelace-denominated ADA/USD price
// scaled to 1_000_000 (i.e. returns micro-dollars per lovelace).
// actual_usd_per_ada = raw_price / 10^precision
pub fn to_ada_usd_price(raw_price: Int, precision: Int) -> Int {
  // We keep everything as integer math.
  // Returns: ADA price in USD * 1_000_000 (6 decimal fixed point)
  // e.g. raw_price=387000, precision=6 → 387000 (= $0.387000)
  raw_price * pow10(6 - precision)
}

fn pow10(n: Int) -> Int {
  if n <= 0 {
    1
  } else {
    10 * pow10(n - 1)
  }
}
```

---

## 6. Math Helpers — `lib/bluesense/math.ak`

```aiken
// ssADA minting: how many ssADA tokens does a deposit of `ada_in` lovelace buy?
// First deposit (total_ssada == 0): 1 ssADA per lovelace (1:1 initial ratio).
// Subsequent: ssada_out = ada_in * total_ssada / total_ada
pub fn calc_mint_amount(
  ada_in: Int,
  total_ada: Int,
  total_ssada: Int,
) -> Int {
  if total_ssada == 0 || total_ada == 0 {
    ada_in  // 1:1 bootstrap ratio
  } else {
    ada_in * total_ssada / total_ada
  }
}

// ssADA redemption: how much ADA (lovelace) does burning `ssada_in` tokens return?
// ada_out = ssada_in * total_ada / total_ssada
pub fn calc_redeem_amount(
  ssada_in: Int,
  total_ada: Int,
  total_ssada: Int,
) -> Int {
  ssada_in * total_ada / total_ssada
}

// Price-per-share in lovelace per ssADA token.
pub fn price_per_share(total_ada: Int, total_ssada: Int) -> Int {
  if total_ssada == 0 {
    1
  } else {
    total_ada / total_ssada
  }
}
```

---

## 7. ssADA Minting Policy — `validators/ssada_mint.ak`

```aiken
use aiken/collection/list
use bluesense/math
use bluesense/oracle
use bluesense/types.{MintRedeemer, MintSSADA, BurnSSADA, VaultDatum}
use cardano/assets
use cardano/transaction.{Transaction, InlineDatum}

// Parameters baked into the script at deploy time.
// vault_script_hash: the payment credential hash of the vault address.
validator ssada_mint(vault_script_hash: ByteArray) {
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    let ssada_token_name: ByteArray = #"737341444100"

    when redeemer is {
      MintSSADA { vault_utxo_ref } -> {
        // 1. Resolve the vault UTxO being updated in this tx.
        expect Some(vault_input) =
          list.find(
            tx.inputs,
            fn(inp) { inp.output_reference == vault_utxo_ref },
          )
        expect InlineDatum(raw_datum) = vault_input.output.datum
        expect vault_datum: VaultDatum = raw_datum

        // 2. Resolve the vault output (must go back to vault address).
        expect Some(vault_output) =
          list.find(
            tx.outputs,
            fn(out) {
              out.address.payment_credential == ScriptCredential(vault_script_hash)
            },
          )
        expect InlineDatum(raw_out_datum) = vault_output.datum
        expect new_datum: VaultDatum = raw_out_datum

        // 3. How much ADA was deposited?
        let ada_in =
          assets.lovelace_of(vault_output.value) - assets.lovelace_of(
            vault_input.output.value,
          )
        expect ada_in > 0

        // 4. How many ssADA must be minted?
        let expected_mint =
          math.calc_mint_amount(
            ada_in,
            vault_datum.total_ada_lovelace,
            vault_datum.total_ssada,
          )

        let actual_mint =
          assets.quantity_of(assets.from_minted_value(tx.mint), policy_id, ssada_token_name)

        // 5. Vault datum must be updated correctly.
        let datum_ok =
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace + ada_in && new_datum.total_ssada == vault_datum.total_ssada + expected_mint && new_datum.strategy == vault_datum.strategy

        actual_mint == expected_mint && datum_ok
      }

      BurnSSADA { vault_utxo_ref } -> {
        // 1. Resolve vault input.
        expect Some(vault_input) =
          list.find(
            tx.inputs,
            fn(inp) { inp.output_reference == vault_utxo_ref },
          )
        expect InlineDatum(raw_datum) = vault_input.output.datum
        expect vault_datum: VaultDatum = raw_datum

        // 2. How many ssADA are being burned?
        let burn_amount =
          -assets.quantity_of(
            assets.from_minted_value(tx.mint),
            policy_id,
            ssada_token_name,
          )
        expect burn_amount > 0

        // 3. How much ADA must be returned to user?
        let expected_ada_out =
          math.calc_redeem_amount(
            burn_amount,
            vault_datum.total_ada_lovelace,
            vault_datum.total_ssada,
          )

        // 4. Verify vault output has reduced ADA by exactly expected_ada_out.
        expect Some(vault_output) =
          list.find(
            tx.outputs,
            fn(out) {
              out.address.payment_credential == ScriptCredential(vault_script_hash)
            },
          )
        let ada_out =
          assets.lovelace_of(vault_input.output.value) - assets.lovelace_of(
            vault_output.value,
          )

        // 5. Vault datum must be updated correctly.
        expect InlineDatum(raw_out_datum) = vault_output.datum
        expect new_datum: VaultDatum = raw_out_datum

        let datum_ok =
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace - expected_ada_out && new_datum.total_ssada == vault_datum.total_ssada - burn_amount

        ada_out >= expected_ada_out && datum_ok
      }
    }
  }

  else(_) {
    fail
  }
}
```

---

## 8. Vault Spend Validator — `validators/vault_spend.ak`

```aiken
use bluesense/math
use bluesense/oracle
use bluesense/types.{VaultDatum, VaultRedeemer, Deposit, Withdraw, Rebalance, Strategy}
use cardano/assets
use cardano/transaction.{Transaction, InlineDatum}

// Parameters baked in at deploy time.
// ssada_policy_id: the policy ID of the ssADA minting script.
// oracle_policy_id: Charli3 ADA/USD feed policy ID on preprod.
validator vault_spend(
  ssada_policy_id: PolicyId,
  oracle_policy_id: PolicyId,
) {
  spend(
    datum: Option<VaultDatum>,
    redeemer: VaultRedeemer,
    _utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(vault_datum) = datum

    when redeemer is {
      // Deposit and Withdraw logic is enforced by ssada_mint validator.
      // The vault spend validator only needs to ensure ssADA is actually
      // being minted/burned in the same transaction.
      Deposit -> {
        let ssada_token_name: ByteArray = #"737341444100"
        let minted =
          assets.quantity_of(
            assets.from_minted_value(tx.mint),
            ssada_policy_id,
            ssada_token_name,
          )
        minted > 0
      }

      Withdraw -> {
        let ssada_token_name: ByteArray = #"737341444100"
        let burned =
          assets.quantity_of(
            assets.from_minted_value(tx.mint),
            ssada_policy_id,
            ssada_token_name,
          )
        burned < 0
      }

      // Rebalance: permissionless — anyone can call it, but the oracle
      // must be fresh and the new strategy must be the highest-APY one.
      Rebalance -> {
        // 1. Fetch and validate oracle reference input.
        let oracle_input = oracle.find_oracle_input(tx)
        expect InlineDatum(oracle_raw) = oracle_input.output.datum

        let (raw_price, expiry_ms, precision) = oracle.decode_price(oracle_raw)
        expect oracle.is_price_fresh(expiry_ms, tx)

        // 2. Resolve new vault output.
        let vault_address = // TODO: derive from own script hash via tx context
          oracle_input.output.address  // placeholder — replace with own address lookup

        // 3. Verify vault datum is updated with new strategy and timestamp.
        // (Strategy selection logic lives off-chain; on-chain only validates
        //  that the rebalance timestamp moved forward.)
        expect Some(vault_output) =
          list.find(
            tx.outputs,
            fn(out) { out.address == vault_address },
          )
        expect InlineDatum(raw_out_datum) = vault_output.datum
        expect new_datum: VaultDatum = raw_out_datum

        // Vault ADA must be unchanged during rebalance.
        let ada_unchanged =
          assets.lovelace_of(vault_output.value) == vault_datum.total_ada_lovelace

        // Rebalance timestamp must advance.
        let timestamp_advanced =
          new_datum.last_rebalance_ms > vault_datum.last_rebalance_ms

        ada_unchanged && timestamp_advanced
      }
    }
  }

  else(_) {
    fail
  }
}
```

---

## 9. Deployment Sequence

```
1. aiken build
   → generates plutus.json with both validators

2. Compute ssada_mint script hash (payment credential of the vault address
   is needed BEFORE we can parameterize ssada_mint, so bootstrap order matters)

   Bootstrap order:
   a. Deploy vault_spend(ssada_policy_id=PLACEHOLDER, oracle_policy_id=CHARLI3_POLICY)
      → get vault_script_hash
   b. Parameterize ssada_mint(vault_script_hash)
      → get ssada_policy_id
   c. Re-deploy vault_spend(ssada_policy_id=REAL, oracle_policy_id=CHARLI3_POLICY)
      → get final vault address

   Note: mutual dependency — use a 2-phase deploy or fix ssada_policy_id
   by computing it off-chain before deploying vault_spend.

3. Initialize vault UTxO:
   Send min ADA to vault address with inline VaultDatum {
     total_ada_lovelace: 0,
     total_ssada: 0,
     strategy: NativeStaking,
     last_rebalance_ms: <current POSIX ms>
   }

4. Set environment variables in frontend .env:
   VITE_VAULT_ADDRESS=addr_test1...
   VITE_SSADA_POLICY_ID=<hex>
   VITE_ORACLE_CONTRACT_ADDRESS=addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a
```

---

## 10. Transaction Flows

### Deposit

```
Inputs:   [vault_UTxO, user_wallet_UTxO]
Outputs:  [vault_UTxO (more ADA, updated datum), user_address (ssADA tokens)]
Mint:     +N ssADA (ssada_mint policy)
RefInputs: (none required for deposit)
```

### Withdraw

```
Inputs:   [vault_UTxO, user_ssADA_UTxO]
Outputs:  [vault_UTxO (less ADA, updated datum), user_address (ADA returned)]
Mint:     -N ssADA (burn)
RefInputs: (none required for withdraw)
```

### Rebalance

```
Inputs:   [vault_UTxO]
Outputs:  [vault_UTxO (same ADA, updated strategy + timestamp in datum)]
Mint:     (none)
RefInputs: [Charli3 ADA/USD oracle UTxO (read-only)]
```

---

## 11. Key Constants (copy into Aiken and frontend)

```
SSADA_TOKEN_NAME_HEX     = "737341444100"
ORACLE_POLICY_ID         = "1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07"
ORACLE_TOKEN_NAME_HEX    = "4f7261636c6546656564"
ORACLE_ADDRESS_PREPROD   = "addr_test1wzn5ee2qaqvly3hx7e0nk3vhm240n5muq3plhjcnvx9ppjgf62u6a"
ORACLE_STALENESS_MS      = 300_000
PRICE_PRECISION          = 6
REBALANCE_APY_DELTA_BPS  = 500   // 5% = 500 basis points
```

---

## 12. Known Limitations / TODOs

- **Rebalance vault address lookup**: The `Rebalance` handler has a placeholder for deriving own address. In Aiken v2, use `tx.inputs` to find the spending input's address via the `OutputReference` passed to `spend`.
- **Strategy selection off-chain**: The on-chain validator only checks timestamp advancement. The actual strategy chosen (NativeStaking / LiqwidLending / MinswapLP) is determined off-chain by the rebalancer and written into the new datum. Add on-chain APY bounds if time allows.
- **Integer division rounding**: `calc_mint_amount` uses integer division. Consider whether to round in favor of the user or the vault (currently rounds down).
- **Min-ADA on vault UTxO**: The vault UTxO must always hold at least 2 ADA for Cardano ledger minimum. Deposit logic should account for this when computing `ada_in`.
