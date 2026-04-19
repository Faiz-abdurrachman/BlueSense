// One-shot script to compute all derived addresses/policies from new CBOR.
// Run with: node scripts/compute_addresses.mjs
import {
  applyParamsToScript,
  applyCborEncoding,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import fs from "node:fs";

const bp = JSON.parse(fs.readFileSync("/tmp/blueprints.json", "utf8"));

const vaultCbor = bp.vault_cbor;
const vaultCborEncoded = applyCborEncoding(vaultCbor);
const vaultScriptHash = resolveScriptHash(vaultCborEncoded, "V3");
const vaultAddress = serializePlutusScript(
  { code: vaultCbor, version: "V3" },
  undefined,
  0,
).address;

const ssadaUnparamCbor = bp.ssada_unparam_cbor;
// JSON format expects each param as a Data JSON object, not a raw string.
// A ByteArray parameter is { "bytes": "<hex>" }.
const ssadaAppliedCbor = applyParamsToScript(
  ssadaUnparamCbor,
  [JSON.stringify({ bytes: vaultScriptHash })],
  "JSON",
);
const ssadaAppliedCborEncoded = applyCborEncoding(ssadaAppliedCbor);
const ssadaPolicyId = resolveScriptHash(ssadaAppliedCborEncoded, "V3");

console.log(JSON.stringify({
  VAULT_SCRIPT_CBOR: vaultCbor,
  VAULT_SCRIPT_HASH: vaultScriptHash,
  VAULT_ADDRESS: vaultAddress,
  SSADA_MINT_SCRIPT_CBOR: ssadaAppliedCbor,
  SSADA_POLICY_ID: ssadaPolicyId,
}, null, 2));
