use aiken/collection/list
use aiken/crypto.{ScriptHash}
use bluesense/math
use bluesense/types.{BurnSSADA, MintRedeemer, MintSSADA, VaultDatum}
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, Transaction, find_input}

const ssada_token_name: ByteArray = #"737341444100"

// vault_script_hash: payment credential hash of the vault (no-param vault_spend).
// This is the only parameter — vault_spend has none, so its hash is stable.
validator ssada_mint(vault_script_hash: ScriptHash) {
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    when redeemer is {
      MintSSADA { vault_utxo_ref } -> {
        expect Some(vault_input) = find_input(tx.inputs, vault_utxo_ref)
        expect InlineDatum(raw_datum) = vault_input.output.datum
        expect vault_datum: VaultDatum = raw_datum

        expect Some(vault_output) =
          list.find(
            tx.outputs,
            fn(out) {
              out.address.payment_credential == Script(vault_script_hash)
            },
          )
        expect InlineDatum(raw_out_datum) = vault_output.datum
        expect new_datum: VaultDatum = raw_out_datum

        let ada_in =
          assets.lovelace_of(vault_output.value) - assets.lovelace_of(
            vault_input.output.value,
          )
        let actual_mint =
          assets.quantity_of(tx.mint, policy_id, ssada_token_name)
        let expected_mint =
          math.calc_mint_amount(
            ada_in,
            vault_datum.total_ada_lovelace,
            vault_datum.total_ssada,
          )

        and {
          ada_in > 0,
          actual_mint == expected_mint,
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace + ada_in,
          new_datum.total_ssada == vault_datum.total_ssada + expected_mint,
          new_datum.strategy == vault_datum.strategy,
          new_datum.yield_accrued_lovelace == vault_datum.yield_accrued_lovelace,
          // Policy ID in datum must match this minting policy
          new_datum.ssada_policy_id == policy_id,
          vault_datum.ssada_policy_id == policy_id,
        }
      }

      BurnSSADA { vault_utxo_ref } -> {
        expect Some(vault_input) = find_input(tx.inputs, vault_utxo_ref)
        expect InlineDatum(raw_datum) = vault_input.output.datum
        expect vault_datum: VaultDatum = raw_datum

        let burn_amount =
          -assets.quantity_of(tx.mint, policy_id, ssada_token_name)
        let expected_ada_out =
          math.calc_redeem_amount(
            burn_amount,
            vault_datum.total_ada_lovelace,
            vault_datum.total_ssada,
          )

        expect Some(vault_output) =
          list.find(
            tx.outputs,
            fn(out) {
              out.address.payment_credential == Script(vault_script_hash)
            },
          )
        expect InlineDatum(raw_out_datum) = vault_output.datum
        expect new_datum: VaultDatum = raw_out_datum

        let ada_returned =
          assets.lovelace_of(vault_input.output.value) - assets.lovelace_of(
            vault_output.value,
          )

        and {
          burn_amount > 0,
          ada_returned >= expected_ada_out,
          new_datum.total_ada_lovelace == vault_datum.total_ada_lovelace - expected_ada_out,
          new_datum.total_ssada == vault_datum.total_ssada - burn_amount,
          new_datum.yield_accrued_lovelace == vault_datum.yield_accrued_lovelace,
          vault_datum.ssada_policy_id == policy_id,
          new_datum.ssada_policy_id == policy_id,
        }
      }
    }
  }

  else(_) {
    fail
  }
}
