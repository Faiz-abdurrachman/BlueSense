use aiken/collection/list
use aiken/interval.{Finite}
use cardano/assets.{PolicyId}
use cardano/transaction.{Input, Transaction}

// ── Charli3 preprod constants ─────────────────────────────────────────────────

pub const oracle_ada_usd_policy_id: PolicyId =
  #"1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07"

pub const oracle_token_name: ByteArray = #"4f7261636c6546656564"

// Reject oracle prices older than 5 minutes
pub const staleness_threshold_ms: Int = 300_000

// ── Charli3 datum types ───────────────────────────────────────────────────────
//
// CDDL (from charli3/oracle-datum-lib spec.cddl):
//   oracle_datum      = #6.121([? shared_data, 1* price_data, ? extended_data])
//   price_data        = #6.123([price_map])
//   price_map         = { 0: price, 1: timestamp_ms, 2: expiry_ms, 3: precision, ... }
//
// Plutus encoding:
//   #6.121 → Constr 0,  #6.122 → Constr 1,  #6.123 → Constr 2
//   price_map is a Plutus Map with Int keys
//
// For the ADA/USD feed we assume: oracle_datum = Constr(0, [price_data])
// i.e. no shared_data or extended_data in the outer fields list.

// Wraps Constr(0, [one_price_data_item])
type C3OracleDatum {
  C3OracleDatum(C3PriceItem)
}

// Constr index must be 2 — pad with two unused constructors to match CDDL #6.123.
// Aiken encodes the nth constructor as Constr(n-1). C3PriceData must be Constr(2).
type C3PriceItem {
  C3SharedData(Data)    // Constr 0 — mirrors shared_data tag
  C3ExtendedData(Data)  // Constr 1 — mirrors extended_data tag
  C3PriceData(Pairs<Int, Data>)  // Constr 2 — the actual price_data
}

// ── Oracle input lookup ───────────────────────────────────────────────────────

pub fn find_oracle_input(tx: Transaction) -> Input {
  expect Some(input) =
    list.find(
      tx.reference_inputs,
      fn(inp) {
        assets.quantity_of(inp.output.value, oracle_ada_usd_policy_id, oracle_token_name) == 1
      },
    )
  input
}

// ── Price extraction ──────────────────────────────────────────────────────────
//
// Returns (raw_price, expiry_ms, precision).
// actual_usd_per_ada = raw_price / 10^precision
// e.g. raw_price=387000, precision=6 → $0.387000

pub fn decode_price(datum: Data) -> (Int, Int, Int) {
  expect C3OracleDatum(price_item) = datum

  // Exhaustive match ensures all three constructors are referenced,
  // and gives a clear failure if the oracle changes its datum shape.
  let price_pairs =
    when price_item is {
      C3PriceData(pairs) -> pairs
      C3SharedData(_) -> fail @"oracle: unexpected shared_data as first field"
      C3ExtendedData(_) -> fail @"oracle: unexpected extended_data as first field"
    }

  let raw_price = get_required_int(price_pairs, 0)
  let expiry_ms = get_required_int(price_pairs, 2)
  let precision =
    when get_optional_int(price_pairs, 3) is {
      Some(p) -> p
      None -> 6
    }

  (raw_price, expiry_ms, precision)
}

// Returns True when the oracle datum is still within its declared expiry,
// using the tx validity range upper bound as the "current time".
pub fn is_price_fresh(expiry_ms: Int, tx: Transaction) -> Bool {
  when tx.validity_range.upper_bound.bound_type is {
    Finite(upper_ms) -> expiry_ms > upper_ms
    _ -> False
  }
}

// ── Price scaling ─────────────────────────────────────────────────────────────
//
// Returns ADA/USD price as a fixed-point integer scaled to 1_000_000.
// e.g. raw=387000, precision=6 → 387000 (= $0.387000 * 1e6)

pub fn to_ada_usd_price(raw_price: Int, precision: Int) -> Int {
  raw_price * pow10(6 - precision)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

fn get_required_int(pairs: Pairs<Int, Data>, key: Int) -> Int {
  expect Some(v) = get_optional_int(pairs, key)
  v
}

fn get_optional_int(pairs: Pairs<Int, Data>, key: Int) -> Option<Int> {
  when pairs is {
    [] -> None
    [Pair(k, v), ..rest] ->
      if k == key {
        expect n: Int = v
        Some(n)
      } else {
        get_optional_int(rest, key)
      }
  }
}

fn pow10(n: Int) -> Int {
  if n <= 0 {
    1
  } else {
    10 * pow10(n - 1)
  }
}
