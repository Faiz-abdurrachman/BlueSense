use aiken/collection/list
use bluesense/oracle
use bluesense/types.{Deposit, Rebalance, VaultDatum, VaultRedeemer, Withdraw}
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
        expect InlineDatum(raw_out) = vault_output.datum
        expect new_datum: VaultDatum = raw_out
        let ada_in =
          assets.lovelace_of(vault_output.value) - vault_datum.total_ada_lovelace

        and {
          minted > 0,
          ada_in > 0,
          new_datum.total_ssada == vault_datum.total_ssada + minted,
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace + ada_in,
          new_datum.ssada_policy_id == vault_datum.ssada_policy_id,
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
          vault_datum.total_ada_lovelace - assets.lovelace_of(vault_output.value)

        and {
          burned > 0,
          ada_out > 0,
          new_datum.total_ssada == vault_datum.total_ssada - burned,
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace - ada_out,
          new_datum.ssada_policy_id == vault_datum.ssada_policy_id,
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
        }
      }
    }
  }

  else(_) {
    fail
  }
}
