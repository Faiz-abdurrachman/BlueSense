use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference}

// ── Strategy ─────────────────────────────────────────────────────────────────

pub type Strategy {
  NativeStaking
  LiqwidLending
  MinswapLP
}

// ── Vault inline datum ────────────────────────────────────────────────────────
// ssada_policy_id stored here so vault_spend needs no parameters,
// giving it a deterministic script hash used to parameterize ssada_mint.

pub type VaultDatum {
  total_ada_lovelace: Int,
  total_ssada: Int,
  strategy: Strategy,
  last_rebalance_ms: Int,
  ssada_policy_id: PolicyId,
}

// ── Vault redeemer ────────────────────────────────────────────────────────────

pub type VaultRedeemer {
  Deposit
  Withdraw
  Rebalance
}

// ── ssADA mint redeemer ───────────────────────────────────────────────────────

pub type MintRedeemer {
  MintSSADA { vault_utxo_ref: OutputReference }
  BurnSSADA { vault_utxo_ref: OutputReference }
}
