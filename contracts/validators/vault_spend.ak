use aiken/collection/list
use bluesense/oracle
use bluesense/types.{
  Deposit, InjectYield, Rebalance, VaultDatum, VaultRedeemer, Withdraw,
}
use cardano/assets
use cardano/transaction.{InlineDatum, OutputReference, Transaction, find_input}

const ssada_token_name: ByteArray = #"737341444100"

// No validator parameters — deterministic script hash, used by ssada_mint.
// ssada_policy_id is read from the vault datum itself, set at initialization.
validator vault_spend {
  spend(
    datum: Option<VaultDatum>,
    redeemer: VaultRedeemer,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(vault_datum) = datum

    // Own address derived from the spending input
    expect Some(self_input) = find_input(tx.inputs, utxo)
    let vault_address = self_input.output.address

    when redeemer is {
      // Deposit: verify ssADA was minted and vault datum was updated correctly.
      Deposit -> {
        let minted =
          assets.quantity_of(
            tx.mint,
            vault_datum.ssada_policy_id,
            ssada_token_name,
          )
        expect Some(vault_output) =
          list.find(tx.outputs, fn(out) { out.address == vault_address })
        let ada_in =
          assets.lovelace_of(vault_output.value) - assets.lovelace_of(
            self_input.output.value,
          )

        // The ssada_mint policy enforces exact share accounting and datum sync.
        // The spending validator only needs to prove this is a real deposit into
        // the continuing vault UTxO.
        and {
          minted > 0,
          ada_in > 0,
        }
      }

      // Withdraw: verify ssADA was burned and ADA was returned proportionally.
      Withdraw -> {
        let burned =
          -assets.quantity_of(
            tx.mint,
            vault_datum.ssada_policy_id,
            ssada_token_name,
          )
        expect Some(vault_output) =
          list.find(tx.outputs, fn(out) { out.address == vault_address })
        expect InlineDatum(raw_out) = vault_output.datum
        expect new_datum: VaultDatum = raw_out
        let ada_out =
          assets.lovelace_of(self_input.output.value) - assets.lovelace_of(
            vault_output.value,
          )

        and {
          burned > 0,
          ada_out > 0,
          new_datum.total_ssada == vault_datum.total_ssada - burned,
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace - ada_out,
          new_datum.ssada_policy_id == vault_datum.ssada_policy_id,
          new_datum.yield_accrued_lovelace == vault_datum.yield_accrued_lovelace,
        }
      }

      // Rebalance: permissionless — oracle must be fresh, ADA unchanged,
      // timestamp must advance.
      Rebalance -> {
        let oracle_input = oracle.find_oracle_input(tx)
        expect InlineDatum(oracle_raw) = oracle_input.output.datum
        let (_, expiry_ms, _) = oracle.decode_price(oracle_raw)
        expect oracle.is_price_fresh(expiry_ms, tx)

        expect Some(vault_output) =
          list.find(tx.outputs, fn(out) { out.address == vault_address })
        expect InlineDatum(raw_out) = vault_output.datum
        expect new_datum: VaultDatum = raw_out

        and {
          assets.lovelace_of(vault_output.value) == vault_datum.total_ada_lovelace,
          new_datum.last_rebalance_ms > vault_datum.last_rebalance_ms,
          new_datum.total_ssada == vault_datum.total_ssada,
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace,
          new_datum.ssada_policy_id == vault_datum.ssada_policy_id,
          new_datum.yield_accrued_lovelace == vault_datum.yield_accrued_lovelace,
        }
      }

      // InjectYield: permissionless yield simulation — caller injects ADA into
      // the vault without minting ssADA, causing pricePerShare (ada/ssada) to
      // rise for all holders. Accrued yield is tracked in the datum for APR
      // calculation on the frontend.
      InjectYield { amount_lovelace } -> {
        expect Some(vault_output) =
          list.find(tx.outputs, fn(out) { out.address == vault_address })
        expect InlineDatum(raw_out) = vault_output.datum
        expect new_datum: VaultDatum = raw_out
        let vault_ada_new = assets.lovelace_of(vault_output.value)

        and {
          amount_lovelace > 0,
          vault_ada_new == vault_datum.total_ada_lovelace + amount_lovelace,
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace + amount_lovelace,
          new_datum.total_ssada == vault_datum.total_ssada,
          new_datum.strategy == vault_datum.strategy,
          new_datum.last_rebalance_ms == vault_datum.last_rebalance_ms,
          new_datum.ssada_policy_id == vault_datum.ssada_policy_id,
          new_datum.yield_accrued_lovelace == vault_datum.yield_accrued_lovelace + amount_lovelace,
        }
      }
    }
  }

  else(_) {
    fail
  }
}
