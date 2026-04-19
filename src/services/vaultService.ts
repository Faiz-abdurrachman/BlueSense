// BlueSense Vault Service
// Builds and submits Deposit / Withdraw / Rebalance / InjectYield transactions using MeshTxBuilder.
//
// Contract addresses (Cardano Preprod, redeployed for yield simulation):
//   vault_spend  → addr_test1wz8gywuctaraf0sd2nl9z3ut764c2k7cx5h2zf4q9fq2y5czjazyv
//   ssada_mint   → policy b206d33e09e660750c31d08ab540781c8f3f04eced2f14f7ff8e479a

import {
  BlockfrostProvider,
  MeshTxBuilder,
  applyCborEncoding,
  conStr0,
  conStr1,
  conStr2,
  conStr3,
  integer,
  byteString,
  outputReference,
  type UTxO,
  type Data,
} from "@meshsdk/core";
import type { MeshCardanoBrowserWallet } from "@meshsdk/wallet";
import { bech32 } from "bech32";
import { ORACLE_CONTRACT_ADDRESS } from "./charli3OracleService";

// CIP-30 wallets return addresses as raw hex bytes; Blockfrost needs bech32.
function normalizeAddress(addr: string): string {
  if (addr.startsWith("addr")) return addr;
  const bytes = Buffer.from(addr, "hex");
  const words = bech32.toWords(bytes);
  // header byte 0x00–0x0f = testnet, 0x10–0x1f = mainnet
  const isMainnet = (bytes[0] & 0x0f) === 1;
  return bech32.encode(isMainnet ? "addr" : "addr_test", words, 1000);
}

// ── Contract constants ────────────────────────────────────────────────────────

export const VAULT_ADDRESS =
  import.meta.env.VITE_VAULT_ADDRESS ??
  "addr_test1wz8gywuctaraf0sd2nl9z3ut764c2k7cx5h2zf4q9fq2y5czjazyv";

export const VAULT_SCRIPT_HASH =
  import.meta.env.VITE_VAULT_SCRIPT_HASH ??
  "3fd462699e2d67d6610312ef3f866cb722c1d03a40cce931ec06e34b";

export const SSADA_POLICY_ID =
  import.meta.env.VITE_SSADA_POLICY_ID ??
  "b206d33e09e660750c31d08ab540781c8f3f04eced2f14f7ff8e479a";

export const SSADA_TOKEN_NAME =
  import.meta.env.VITE_SSADA_TOKEN_NAME ?? "737341444100";

// Charli3 OracleFeed asset on preprod — policy from contracts/lib/bluesense/oracle.ak:9,
// token name "OracleFeed" (hex 4f7261636c6546656564). Validator requires a UTxO carrying
// exactly 1 of this asset in tx.reference_inputs for Rebalance redeemer.
const ORACLE_FEED_POLICY_ID =
  "1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf07";
const ORACLE_FEED_TOKEN_NAME_HEX = "4f7261636c6546656564";
const ORACLE_FEED_ASSET =
  ORACLE_FEED_POLICY_ID + ORACLE_FEED_TOKEN_NAME_HEX;

// Compiled scripts from plutus.json (vault_spend) and blueprint apply (ssada_mint)
const VAULT_SCRIPT_CBOR =
  "59097301010029800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e3300130093754007370e90004dc3a40093008375400891111991192cc004c0180122b3001301037540170018b20228acc004c0240122b3001301037540170018b20228acc004c0140122b3001301037540170018b20228acc004cdc3a400c0091323259800980b001400e2c8098dd6980a00098081baa00b8b201c4038807100e0acc004c014c038dd5000c4c8cc8966002601060226ea800a330012301630170019180b180b980b980b980b980b800c8c058c05cc05cc05cc05c0064602c602e602e602e003222323322330020020012259800800c00e2646644b30013372200e00515980099b8f0070028800c01901944cc014014c07c0110191bae3018001375a6032002603600280c8c8c8cc004004018896600200300389919912cc004cdc8804801456600266e3c02400a20030064069133005005302000440686eb8c064004dd5980d000980e000a03414bd6f7b6300a40012259800980518099baa00289919191919194c004dd6980e800cdd6980e8034dd6980e802cdd6980e801cdd7180e801244444b30013023006899192cc004c05c0062b30013021375400500e8b20448acc004c0680062b30013021375400500e8b20448acc004c0580062b30013021375400500e8b20448b203e407c80f8c07cdd50009811004c590200c074004c070004c06c004c068004c064004c050dd500145901248c058c05cc05c00660226ea80366e2120009b80375a602a60246ea80052222222222332259800980a002c4cc8966002602c603e6ea800626464b30013017302137540031323300c0011325980098050034566002601400315980099b87375a602460486ea8008cdc01bad30123024375402600d15980099b87375a604e60486ea8008c0240062b30013371e6eb8c040c090dd50011bae30103024375402713370e6eb4c044c090dd50011bad30113024375402714a081122941022452820448a50408914a08110cdc098031bab3011302337540066eb4c098c08cdd5009181298111baa0018b2040300930213754002604660406ea80062c80f260026eacc028c078dd500b4dd71805180f1baa00da441067373414441000040206601e6eb0c018c078dd500b119baf3022301f3754002007159800980b802c4cc8966002602c603e6ea800626464b30013017302137540031323300c0011325980098050034566002601400315980099b87375a602460486ea8008cdc09bad30123024375402600d15980099b87375a604e60486ea8008cdc09bad30273024375402600315980099b8f375c602060486ea8008dd7180818121baa013899b87375a602260486ea8008dd6980898121baa0138a50408914a081122941022452820448a50408866e04dd6981318119baa01230063756602260466ea800cc094c088dd5000c59020180498109baa00130233020375400316407866e05200098009bab300a301e375402d375c6014603c6ea80369101067373414441000040206601e6eb0c018c078dd500b119baf3022301f37540020071598009809802c4c9660026028603c6ea80062b30013259800980c980f9baa001899b88375a604660406ea8004dd6981198121919912cc004c064c088dd5000c4c9660026050003132332259800980e800c4c8c966002605a0050048b2054302b001302737540071598009810000c4c8c966002605a0050048b2054302b00130273754007159800980e000c4c9660026058003132330010013756605800444b3001001802c4c8cc88cc014014c0c4010dd6981500098158009816800a0568b2052302737540071640948129025099198141ba83300500148000cc0a0dd419802800a4008660506ea0c966002603a604c6ea800626eb4c0a8c09cdd5000c5200c40946600c002900325eb80c9660026036003137566052604c6ea800a2b3001301c0018b45902420483024375400260486ea8004c09c0062c8128c08cdd5000c5902111192cc004c068c08cdd5000c4dd6981398121baa0018b20443300300200130243021375400644646600200200644b30010018a6103d87a80008992cc004cdc39bad3024001004899ba548000cc09cc0940052f5c11330030033029002408c604e002812a294101e1811180f9baa300d301f375460446046604660466046604660466046603e6ea805e264b30013016301f37540031323259800980b98109baa001899198060008acc004cdc398031bab3011302337540066eb4c098c08cdd5009456600266e20dd6980718119baa012375a601c60466ea80062b30013370e6eb4c044c08cdd50009bad30113023375402515980099b87375a604c60466ea8004dd6981318119baa0128acc004cdc79bae300f302337540026eb8c03cc08cdd500944cdc39bad3010302337540026eb4c040c08cdd5009452820428a50408514a0810a294102145282042302530223754003164080601260426ea8004c08cc080dd5000c5901e198081bac3007301f375402e466ebcc08cc080dd500080245901d45901d1803180f1baa300c301e375464b30013015301e375400313022301f37540031640746601e6eb0c030c078dd500b1180c4c004dd59806980f9baa300d301f375400348811c1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf0700a4410a4f7261636c65466565640040251332259800980b180f9baa001899192cc004c05cc084dd5000c4c8cc030004566002601200b15980099b8730063756602260466ea800cc0200162b30013370e6eb4c098c08cdd50009804002c56600266e1cdd6980898119baa001375a602260466ea804a2b30013375e601660466ea8004c02cc08cdd5009456600266e1cdd6980718119baa001375a601c60466ea804a2b30013371e6eb8c03cc08cdd50009bae300f3023375402513370e6eb4c040c08cdd500099b80375a602060466ea80480162941021452820428a50408514a0810a2941021452820428a504084604a60446ea80062c8100c024c084dd5000981198101baa0018b203c375a6042603c6ea8064cc03cdd61803180f1baa01623375e6044603e6ea800400d01c20384070603e60386ea8c028c070dd5180f980e1baa00c29800800d22100a44100401c8b2020330013758602660206ea80208cdd7980a18089baa00100430133010375400444646600200200644b30010018a60103d87a80008992cc004c010006266e952000330160014bd7044cc00c00cc060009012180b000a0288b201a3010004301030110044590070c020004c00cdd5004452689b2b20021";

const SSADA_MINT_SCRIPT_CBOR =
  "5906435906400101003229800aba2aba1aba0aab9faab9eaab9dab9a9bae0024888888896600264653001300900198049805000cdc3a400130090024888966002600460126ea800e2653001198009180798081808180818081808000c888c8cc88cc008008004896600200300389919912cc004cdc8803801456600266e3c01c00a20030064049133005005301800440486eb8c044004dd69809000980a000a0243232330010010062259800800c00e2646644b30013372201200515980099b8f0090028800c01901344cc014014c0640110131bae301200137566026002602a002809852f5bded8c02900048c03cc040c040c040c0400066e1d2004918079808000c8c03cc040c04000644646600200200644b30010018a6103d87a80008992cc004c010006266e952000330120014bd7044cc00c00cc05000900e1809000a0204888888a600253001001a44100a44100401d2259800980618099baa00289919191919194c004dd6980e800cdd6980e8034dd6980e802cdd6980e801cdd7180e801244444b30013023006899192cc004c0640062b30013021375400500e8b20448acc004cdc3a400400315980098109baa0028074590224566002602600315980098109baa00280745902245901f203e407c603e6ea8004c0880262c8100603a002603800260360026034002603200260286ea800a2c80924466006004466ebcc060c054dd50008012444b3001300d3014375401f132598009807180a9baa001899192cc004c028c05cdd5000c4c8cc0180044c966002602460326ea800626464b3001300e301b37540031323300a001132325980099b884800000a2b30013370f300137566024603e6ea805a02b4890673734144410000404c00315980099b87375a6044603e6ea800ccdc01bad3022301f375400e00515980099b87375a6020603e6ea800ccdc01bad3010301f375400e00315980099baf300f301f3754006601e603e6ea801e2b30013370e6eb4c050c07cdd50019bad3014301f375400f15980099b8f375c6024603e6ea800c056266e3cdd71809180f9baa0070158a50407514a080ea294101d4528203a8a50407514a080ea294101d19912cc00566002603000314a31301800240791003899b833370400600200480f0dd69810980f1baa006375a601e603c6ea8018cdc098059bab300e301d375400660166eacc038c074dd51807180e9baa007301f301c3754003164068601660366ea8004c074c068dd5000c59018198041bac300930193754020466ebcc074c068dd5180e980d1baa0013374a90011980e1ba90174bd70180d980c1baa0018b202c3007301737546010602e6ea8004c064c058dd5000c59014198009bac3018301537540186030602a6ea803e264b3001300e3015375400313232598009805180b9baa0018991980300089919912cc004c050c06cdd5000c4c8c9660026020603a6ea8006264660180022b3001337109000003456600266e24014cdc098069bab3010301f37546020603e6ea8024c034dd59808180f9baa0038acc004cdc39bad3022301f375400266e04dd69811180f9baa0070058acc004cdc39bad3010301f375400266e04dd69808180f9baa0070068acc004cdc39bad3014301f37540026eb4c050c07cdd5003c56600266e3cdd71809180f9baa007015899b8f375c6024603e6ea8004056294101d4528203a8a50407514a080ea294101d4528203a3021301e3754003164070601a603a6ea8004c07cc070dd5000c5901a19b83337040026eb4c074c068dd50011bad300b301a3754004660126eb0c028c068dd5008919baf301e301b3754603c60366ea8004cdd2a40046603a6ea40612f5c066e05200098009bab300c3019375402100fa44106737341444100004034603660306ea80062c80b0c01cc05cdd51804180b9baa001301930163754003164050660026eb0c060c054dd5006180c180a9baa00f404c4c028dd5002c8966002600a60186ea800a264646644b30013015003802c590121bad3012001375c60240046024002601a6ea800a2c805922259800980300144c966002602600313300230120010048b2020300e375401115980099b874800800a264b30013013001899801180900080245901018071baa0088b20184030375c601a60146ea800e2c8040601200260086ea802629344d95900213011e581c3fd462699e2d67d6610312ef3f866cb722c1d03a40cce931ec06e34b0001";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Strategy = "NativeStaking" | "LiqwidLending" | "MinswapLP";

export interface VaultState {
  totalAdaLovelace: bigint;
  totalSsada: bigint;
  strategy: Strategy;
  lastRebalanceMs: number;
  yieldAccruedLovelace: bigint;
  utxo: UTxO;
}

export interface DepositResult {
  txHash: string;
  ssadaMinted: bigint;
}

// ── Provider factory ──────────────────────────────────────────────────────────

function makeProvider(): BlockfrostProvider | null {
  const key = import.meta.env.VITE_BLOCKFROST_PROJECT_ID as string | undefined;
  if (!key) return null;
  return new BlockfrostProvider(key);
}

// Cardano Plutus txs require a collateral input (≥ ~5 ADA lovelace).
// Ledger rule: collateral must be pure-ADA UNLESS the tx sets `totalCollateral` and
// includes a `collateralReturn` output. Mesh's `setTotalCollateral()` triggers that
// auto-generation. Returns `{ utxo, multiAsset }` so the caller knows whether to
// call setTotalCollateral after txInCollateral.
async function pickCollateral(
  wallet: MeshCardanoBrowserWallet,
  walletUtxos: UTxO[],
): Promise<{ utxo: UTxO; multiAsset: boolean }> {
  const explicit = await wallet.getCollateral();
  // Eternl sometimes returns entries without a fully-hydrated `.output.amount`
  // (observed: `Cannot read properties of undefined (reading 'amount')`). Guard
  // the access; if shape is unexpected, fall through to walletUtxos-based pick.
  const first = explicit[0];
  if (first?.output?.amount) {
    return { utxo: first, multiAsset: first.output.amount.length > 1 };
  }
  const MIN_COLLATERAL = 5_000_000n;
  const lovelaceOf = (u: UTxO) => {
    const lov = u.output.amount.find((a) => a.unit === "lovelace");
    return lov ? BigInt(lov.quantity) : 0n;
  };
  // Prefer pure-ADA UTxOs (no collateralReturn output needed, cheaper tx).
  const pureAda = walletUtxos.find(
    (u) => u.output.amount.length === 1 && lovelaceOf(u) >= MIN_COLLATERAL,
  );
  if (pureAda) return { utxo: pureAda, multiAsset: false };
  // Fall back: multi-asset UTxO with enough lovelace; Mesh will generate collateralReturn.
  const mixed = walletUtxos.find((u) => lovelaceOf(u) >= MIN_COLLATERAL);
  if (!mixed) {
    throw new Error(
      "No UTxO with ≥5 ADA lovelace available for collateral. Fund your wallet with 5+ ADA or configure collateral in Eternl settings.",
    );
  }
  return { utxo: mixed, multiAsset: true };
}

// Standard Plutus collateral amount (5 ADA). Used when setTotalCollateral is required.
const COLLATERAL_AMOUNT_LOVELACE = "5000000";

// ── Datum encoding ────────────────────────────────────────────────────────────

function strategyData(s: Strategy): Data {
  switch (s) {
    case "NativeStaking":  return conStr0([]);
    case "LiqwidLending":  return conStr1([]);
    case "MinswapLP":      return conStr2([]);
  }
}

export function buildVaultDatumData(
  totalAdaLovelace: bigint,
  totalSsada: bigint,
  strategy: Strategy,
  lastRebalanceMs: number,
  yieldAccruedLovelace: bigint,
): Data {
  // conStr0 produces { constructor, fields } — compatible with "JSON" format only.
  // "Mesh" format reads .alternative (wrong key) → always use "JSON" for serialization.
  return conStr0([
    integer(Number(totalAdaLovelace)),
    integer(Number(totalSsada)),
    strategyData(strategy),
    integer(lastRebalanceMs),
    byteString(SSADA_POLICY_ID),
    integer(Number(yieldAccruedLovelace)),
  ]);
}

// ── Datum decoding ────────────────────────────────────────────────────────────

function strategyFromIndex(idx: number): Strategy {
  if (idx === 1) return "LiqwidLending";
  if (idx === 2) return "MinswapLP";
  return "NativeStaking";
}

// Minimal CBOR uint reader for info bytes 0..27 (unsigned 0..2^64-1).
function readCborUint(bytes: Uint8Array, offset: number): [bigint, number] {
  const header = bytes[offset];
  if ((header & 0xe0) !== 0x00) throw new Error("not a CBOR uint");
  const info = header & 0x1f;
  if (info < 24) return [BigInt(info), offset + 1];
  const widths: Record<number, number> = { 24: 1, 25: 2, 26: 4, 27: 8 };
  const w = widths[info];
  if (!w) throw new Error(`unsupported uint info ${info}`);
  let v = 0n;
  for (let i = 1; i <= w; i++) v = (v << 8n) | BigInt(bytes[offset + i]);
  return [v, offset + 1 + w];
}

// Skip a CBOR bytestring (major type 2) — returns offset past the last byte.
function skipCborBytes(bytes: Uint8Array, offset: number): number {
  const header = bytes[offset];
  if ((header & 0xe0) !== 0x40) throw new Error("not a CBOR bstr");
  const info = header & 0x1f;
  if (info < 24) return offset + 1 + info;
  const widths: Record<number, number> = { 24: 1, 25: 2, 26: 4, 27: 8 };
  const w = widths[info];
  if (!w) throw new Error(`unsupported bstr info ${info}`);
  let len = 0;
  for (let i = 1; i <= w; i++) len = (len << 8) | bytes[offset + i];
  return offset + 1 + w + len;
}

// Decode the on-chain VaultDatum: Constr(0, [Int, Int, Constr(n, []), Int, ByteString, Int]).
// Matches encoding produced by buildVaultDatumData().
function decodeVaultDatum(hexCbor: string):
  | {
      totalAdaLovelace: bigint;
      totalSsada: bigint;
      strategy: Strategy;
      lastRebalanceMs: number;
      yieldAccruedLovelace: bigint;
    }
  | null {
  try {
    const bytes = Uint8Array.from(Buffer.from(hexCbor, "hex"));
    let i = 0;
    if (bytes[i++] !== 0xd8 || bytes[i++] !== 0x79) return null; // tag 121 = Constr(0)
    const arr = bytes[i++];
    if (arr !== 0x9f && (arr & 0xe0) !== 0x80) return null; // indefinite or definite array
    const [totalAdaLovelace, i1] = readCborUint(bytes, i); i = i1;
    const [totalSsada, i2] = readCborUint(bytes, i); i = i2;
    if (bytes[i++] !== 0xd8) return null;
    const strategyTag = bytes[i++]; // 0x79 Constr(0), 0x7a Constr(1), 0x7b Constr(2)
    if (bytes[i++] !== 0x80) return null;
    const strategy = strategyFromIndex(strategyTag - 0x79);
    const [lastRebalance, i3] = readCborUint(bytes, i); i = i3;
    i = skipCborBytes(bytes, i); // ssada_policy_id (28-byte hash) — not needed at runtime
    const [yieldAccrued] = readCborUint(bytes, i);
    return {
      totalAdaLovelace,
      totalSsada,
      strategy,
      lastRebalanceMs: Number(lastRebalance),
      yieldAccruedLovelace: yieldAccrued,
    };
  } catch {
    return null;
  }
}

export function parseVaultState(utxo: UTxO): VaultState | null {
  const raw = utxo.output.plutusData;
  if (!raw) return null;
  const decoded = decodeVaultDatum(raw);
  if (!decoded) return null;
  return { ...decoded, utxo };
}

// ── Vault UTxO fetching ───────────────────────────────────────────────────────

export async function fetchVaultUtxo(): Promise<UTxO | null> {
  const provider = makeProvider();
  if (!provider) return null;
  try {
    const utxos = await provider.fetchAddressUTxOs(VAULT_ADDRESS);
    return utxos.find((u) => u.output.plutusData !== undefined) ?? null;
  } catch {
    return null;
  }
}

// Locates the live Charli3 OracleFeed UTxO — the specific one holding the OracleFeed
// token. validator's oracle.find_oracle_input filters reference_inputs by this exact asset.
async function fetchOracleFeedUtxo(provider: BlockfrostProvider): Promise<UTxO> {
  const utxos = await provider.fetchAddressUTxOs(ORACLE_CONTRACT_ADDRESS);
  const found = utxos.find((u) =>
    u.output.amount.some(
      (a) => a.unit === ORACLE_FEED_ASSET && BigInt(a.quantity) >= 1n,
    ),
  );
  if (!found) {
    throw new Error(
      `Charli3 OracleFeed UTxO not found at ${ORACLE_CONTRACT_ADDRESS}. ` +
        `Oracle feed may be offline — Rebalance requires a fresh on-chain price.`,
    );
  }
  return found;
}

// ── ssADA amount math ─────────────────────────────────────────────────────────

function calcMintAmount(
  adaInLovelace: bigint,
  totalAda: bigint,
  totalSsada: bigint,
): bigint {
  if (totalSsada === 0n || totalAda === 0n) return adaInLovelace;
  return (adaInLovelace * totalSsada) / totalAda;
}

function calcRedeemAmount(
  ssadaBurn: bigint,
  totalAda: bigint,
  totalSsada: bigint,
): bigint {
  return (ssadaBurn * totalAda) / totalSsada;
}

// ── Vault Initialization ──────────────────────────────────────────────────────

export async function initializeVault(wallet: MeshCardanoBrowserWallet): Promise<string> {
  const provider = makeProvider();
  if (!provider) throw new Error("VITE_BLOCKFROST_PROJECT_ID not set — cannot build on-chain tx");

  // getChangeAddressBech32 returns bech32 directly (no normalizeAddress needed)
  const userAddress = await wallet.getChangeAddressBech32();
  if (!userAddress) throw new Error("Wallet not connected or no address found");

  const walletUtxos = await provider.fetchAddressUTxOs(userAddress);
  if (!walletUtxos.length) throw new Error("No UTxOs at wallet address — fund your preprod wallet first.");

  const initLovelace = 2_000_000n;
  const initDatum = buildVaultDatumData(initLovelace, 0n, "NativeStaking", Date.now(), 0n);

  // Simple payment — no scripts, no minting, no redeemers.
  // Do NOT call setNetwork() here: it can cause the SDK to write a script_data_hash
  // into the tx body even when there are no redeemers, which makes Blockfrost reject
  // with "missingRequiredScripts spend:0 mint:0".
  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider });

  const unsignedTx = await txBuilder
    .txOut(VAULT_ADDRESS, [{ unit: "lovelace", quantity: initLovelace.toString() }])
    .txOutInlineDatumValue(initDatum, "JSON")
    .changeAddress(userAddress)
    .selectUtxosFrom(walletUtxos)
    .complete();

  // signTxReturnFullTx returns the FULL signed tx CBOR (not just witness set)
  const signedTx = await wallet.signTxReturnFullTx(unsignedTx, false);

  // Submit via Blockfrost for accurate error messages (wallet throws opaque CIP-30 objects)
  try {
    const txHash = await provider.submitTx(signedTx);
    return txHash;
  } catch (err) {
    console.error("[initializeVault] submitTx raw error:", err);
    // Extract message from Blockfrost error or CIP-30 TxSendError
    const msg =
      (err as { info?: string })?.info ??
      (err as { message?: string })?.message ??
      JSON.stringify(err);
    throw new Error(`Submit failed: ${msg}`);
  }
}

// ── Deposit ───────────────────────────────────────────────────────────────────

export async function buildDepositTx(
  wallet: MeshCardanoBrowserWallet,
  depositAda: number,
): Promise<DepositResult> {
  const provider = makeProvider();
  if (!provider) throw new Error("VITE_BLOCKFROST_PROJECT_ID not set — cannot build on-chain tx");

  const userAddress = await wallet.getChangeAddressBech32();
  if (!userAddress) throw new Error("Wallet not connected or no address found");
  const userUtxos = await provider.fetchAddressUTxOs(userAddress);
  if (!userUtxos.length) throw new Error("No UTxOs at wallet address — fund your preprod wallet first.");
  const { utxo: collateral, multiAsset: collateralMultiAsset } = await pickCollateral(wallet, userUtxos);
  const depositLovelace = BigInt(Math.floor(depositAda * 1_000_000));

  const vaultUtxo = await fetchVaultUtxo();
  if (!vaultUtxo) throw new Error("Vault not initialized. Use the Initialize Vault button first.");

  const vaultState = parseVaultState(vaultUtxo);
  if (!vaultState) throw new Error("Cannot decode vault datum — on-chain state unreadable.");

  const prevTotalAda    = vaultState.totalAdaLovelace;
  const prevTotalSsada  = vaultState.totalSsada;
  const newTotalAda     = prevTotalAda + depositLovelace;
  const ssadaToMint     = calcMintAmount(depositLovelace, prevTotalAda, prevTotalSsada);
  const newTotalSsada   = prevTotalSsada + ssadaToMint;
  const nowMs           = Date.now();

  const newDatum = buildVaultDatumData(
    newTotalAda,
    newTotalSsada,
    vaultState.strategy,
    nowMs,
    vaultState.yieldAccruedLovelace,
  );

  const vaultRedeemer: Data = conStr0([]); // Deposit
  const mintRedeemer: Data = conStr0([
    outputReference(vaultUtxo.input.txHash, vaultUtxo.input.outputIndex),
  ]);

  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider, evaluator: provider });
  txBuilder.setNetwork("preprod");

  // applyCborEncoding double-wraps the CBOR so the Mesh SDK stores the original
  // single-CBOR bytes in the witness set — the Cardano protocol hashes scripts
  // as blake2b224(0x03 || cbor_bytes), so the CBOR wrapper must be preserved.
  txBuilder
    .spendingPlutusScriptV3()
    .txIn(
      vaultUtxo.input.txHash,
      vaultUtxo.input.outputIndex,
      vaultUtxo.output.amount,
      vaultUtxo.output.address,
    )
    .txInScript(applyCborEncoding(VAULT_SCRIPT_CBOR))
    .txInInlineDatumPresent()
    .txInRedeemerValue(vaultRedeemer, "JSON");

  // Mint ssADA
  txBuilder
    .mintPlutusScriptV3()
    .mint(ssadaToMint.toString(), SSADA_POLICY_ID, SSADA_TOKEN_NAME)
    .mintingScript(applyCborEncoding(SSADA_MINT_SCRIPT_CBOR))
    .mintRedeemerValue(mintRedeemer, "JSON");

  // Vault output with new datum + all ADA
  const vaultAdaOut = (vaultUtxo
    ? vaultUtxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0"
    : "0");
  const vaultLovelaceOut = (BigInt(vaultAdaOut) + depositLovelace).toString();

  txBuilder
    .txOut(VAULT_ADDRESS, [{ unit: "lovelace", quantity: vaultLovelaceOut }])
    .txOutInlineDatumValue(newDatum, "JSON");

  // ssADA to user
  txBuilder.txOut(userAddress, [
    { unit: `${SSADA_POLICY_ID}${SSADA_TOKEN_NAME}`, quantity: ssadaToMint.toString() },
  ]);

  txBuilder
    .txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address,
    )
    .changeAddress(userAddress)
    .selectUtxosFrom(userUtxos);

  if (collateralMultiAsset) {
    txBuilder.setTotalCollateral(COLLATERAL_AMOUNT_LOVELACE);
  }

  const unsignedTx = await txBuilder.complete();
  const signedTx   = await wallet.signTxReturnFullTx(unsignedTx, true);

  try {
    const txHash = await provider.submitTx(signedTx);
    return { txHash, ssadaMinted: ssadaToMint };
  } catch (err) {
    console.error("[buildDepositTx] submitTx raw error:", err);
    const msg = (err as { info?: string })?.info ?? (err as { message?: string })?.message ?? JSON.stringify(err);
    throw new Error(`Submit failed: ${msg}`);
  }
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

export async function buildWithdrawTx(
  wallet: MeshCardanoBrowserWallet,
  ssadaBurnAmount: bigint,
): Promise<{ txHash: string; adaReturned: bigint }> {
  const provider = makeProvider();
  if (!provider) throw new Error("VITE_BLOCKFROST_PROJECT_ID not set — cannot build on-chain tx");

  const userAddress = await wallet.getChangeAddressBech32();
  if (!userAddress) throw new Error("Wallet not connected or no address found");
  const userUtxos = await provider.fetchAddressUTxOs(userAddress);
  if (!userUtxos.length) throw new Error("No UTxOs at wallet address.");
  const { utxo: collateral, multiAsset: collateralMultiAsset } = await pickCollateral(wallet, userUtxos);

  const vaultUtxo = await fetchVaultUtxo();
  if (!vaultUtxo) throw new Error("No vault UTxO found");
  const vaultState = parseVaultState(vaultUtxo);
  if (!vaultState) throw new Error("Cannot parse vault datum");

  // Vault output must retain ≥MIN_VAULT_LOVELACE (Cardano minUtxo for script addr +
  // inline datum ≈1.2 ADA; 2 ADA gives headroom). If the requested burn would drain
  // the vault, cap the burn so the vault keeps MIN_VAULT_LOVELACE. User eats a
  // small ssADA dust position — acceptable for demo; solves minUtxo violation.
  const MIN_VAULT_LOVELACE = 2_000_000n;
  const maxReturn = vaultState.totalAdaLovelace - MIN_VAULT_LOVELACE;
  const uncappedReturn = calcRedeemAmount(ssadaBurnAmount, vaultState.totalAdaLovelace, vaultState.totalSsada);
  let adaToReturn: bigint;
  if (uncappedReturn <= maxReturn) {
    adaToReturn = uncappedReturn;
  } else {
    // Cap burn so vault retains MIN_VAULT_LOVELACE. Recompute adaToReturn from the
    // capped burn (not from maxReturn directly) so integer-division round-trips and
    // the on-chain `expected_ada_out` check matches our output exactly.
    ssadaBurnAmount = (maxReturn * vaultState.totalSsada) / vaultState.totalAdaLovelace;
    adaToReturn = calcRedeemAmount(ssadaBurnAmount, vaultState.totalAdaLovelace, vaultState.totalSsada);
  }

  const newTotalAda  = vaultState.totalAdaLovelace - adaToReturn;
  const newTotalSsada = vaultState.totalSsada - ssadaBurnAmount;
  const newDatum = buildVaultDatumData(
    newTotalAda,
    newTotalSsada,
    vaultState.strategy,
    Date.now(),
    vaultState.yieldAccruedLovelace,
  );

  const vaultRedeemer: Data = conStr1([]); // Withdraw
  const burnRedeemer: Data = conStr1([
    outputReference(vaultUtxo.input.txHash, vaultUtxo.input.outputIndex),
  ]);

  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider, evaluator: provider });
  txBuilder.setNetwork("preprod");

  txBuilder
    .spendingPlutusScriptV3()
    .txIn(
      vaultUtxo.input.txHash,
      vaultUtxo.input.outputIndex,
      vaultUtxo.output.amount,
      vaultUtxo.output.address,
    )
    .txInScript(applyCborEncoding(VAULT_SCRIPT_CBOR))
    .txInInlineDatumPresent()
    .txInRedeemerValue(vaultRedeemer, "JSON");

  // Burn ssADA
  txBuilder
    .mintPlutusScriptV3()
    .mint((-ssadaBurnAmount).toString(), SSADA_POLICY_ID, SSADA_TOKEN_NAME)
    .mintingScript(applyCborEncoding(SSADA_MINT_SCRIPT_CBOR))
    .mintRedeemerValue(burnRedeemer, "JSON");

  // Vault output (reduced ADA)
  const vaultAdaOut = vaultUtxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0";
  const vaultLovelaceOut = (BigInt(vaultAdaOut) - adaToReturn).toString();
  txBuilder
    .txOut(VAULT_ADDRESS, [{ unit: "lovelace", quantity: vaultLovelaceOut }])
    .txOutInlineDatumValue(newDatum, "JSON");

  // ADA to user
  txBuilder.txOut(userAddress, [{ unit: "lovelace", quantity: adaToReturn.toString() }]);

  txBuilder
    .txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address,
    )
    .changeAddress(userAddress)
    .selectUtxosFrom(userUtxos);

  if (collateralMultiAsset) {
    txBuilder.setTotalCollateral(COLLATERAL_AMOUNT_LOVELACE);
  }

  const unsignedTx = await txBuilder.complete();
  const signedTx   = await wallet.signTxReturnFullTx(unsignedTx, true);

  try {
    const txHash = await provider.submitTx(signedTx);
    return { txHash, adaReturned: adaToReturn };
  } catch (err) {
    console.error("[buildWithdrawTx] submitTx raw error:", err);
    const msg = (err as { info?: string })?.info ?? (err as { message?: string })?.message ?? JSON.stringify(err);
    throw new Error(`Submit failed: ${msg}`);
  }
}

// ── Rebalance ─────────────────────────────────────────────────────────────────
//
// Invariants enforced by vault_spend.ak:
//   - ADA total UNCHANGED
//   - ssADA total UNCHANGED
//   - ssada_policy_id UNCHANGED
//   - last_rebalance_ms MUST strictly increase
//   - Charli3 OracleFeed UTxO MUST be in tx.reference_inputs (via find_oracle_input)
//   - Oracle expiry_ms > tx.validity_range.upper_bound (freshness check)

export async function buildRebalanceTx(
  wallet: MeshCardanoBrowserWallet,
  newStrategy: Strategy,
): Promise<{ txHash: string; newStrategy: Strategy }> {
  const provider = makeProvider();
  if (!provider) throw new Error("VITE_BLOCKFROST_PROJECT_ID not set — cannot build on-chain tx");

  const userAddress = await wallet.getChangeAddressBech32();
  if (!userAddress) throw new Error("Wallet not connected or no address found");
  const userUtxos = await provider.fetchAddressUTxOs(userAddress);
  if (!userUtxos.length) throw new Error("No UTxOs at wallet address.");
  const { utxo: collateral, multiAsset: collateralMultiAsset } = await pickCollateral(wallet, userUtxos);

  const vaultUtxo = await fetchVaultUtxo();
  if (!vaultUtxo) throw new Error("No vault UTxO found");
  const vaultState = parseVaultState(vaultUtxo);
  if (!vaultState) throw new Error("Cannot parse vault datum");

  if (vaultState.strategy === newStrategy) {
    throw new Error(`Vault is already on ${newStrategy} — no rebalance needed`);
  }

  // MANDATORY: Charli3 oracle as reference input
  const oracleUtxo = await fetchOracleFeedUtxo(provider);

  // Oracle freshness requires tx TTL to precede oracle expiry. Charli3 preprod feeds
  // typically live 10–20 min; set TTL ~5 min ahead (300 slots on preprod, 1 slot = 1s).
  const latestBlock = await provider.fetchLatestBlock();
  const ttlSlot = parseInt(latestBlock.slot, 10) + 300;

  // last_rebalance_ms must strictly increase
  const nowMs = Date.now();
  const newLastRebalanceMs = Math.max(nowMs, vaultState.lastRebalanceMs + 1);

  // Invariants: ADA + ssADA + policy_id + yield unchanged; only strategy + timestamp move
  const newDatum = buildVaultDatumData(
    vaultState.totalAdaLovelace,
    vaultState.totalSsada,
    newStrategy,
    newLastRebalanceMs,
    vaultState.yieldAccruedLovelace,
  );

  const vaultRedeemer: Data = conStr2([]); // Rebalance

  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider, evaluator: provider });
  txBuilder.setNetwork("preprod");

  txBuilder
    .spendingPlutusScriptV3()
    .txIn(
      vaultUtxo.input.txHash,
      vaultUtxo.input.outputIndex,
      vaultUtxo.output.amount,
      vaultUtxo.output.address,
    )
    .txInScript(applyCborEncoding(VAULT_SCRIPT_CBOR))
    .txInInlineDatumPresent()
    .txInRedeemerValue(vaultRedeemer, "JSON");

  // Vault output — lovelace EXACTLY unchanged (validator checks equality)
  const vaultLovelace =
    vaultUtxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0";
  txBuilder
    .txOut(VAULT_ADDRESS, [{ unit: "lovelace", quantity: vaultLovelace }])
    .txOutInlineDatumValue(newDatum, "JSON");

  // Reference inputs — oracle UTxO carries the OracleFeed asset the validator filters for
  txBuilder.readOnlyTxInReference(
    oracleUtxo.input.txHash,
    oracleUtxo.input.outputIndex,
  );

  // Freshness window
  txBuilder.invalidHereafter(ttlSlot);

  txBuilder
    .txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address,
    )
    .changeAddress(userAddress)
    .selectUtxosFrom(userUtxos);

  if (collateralMultiAsset) {
    txBuilder.setTotalCollateral(COLLATERAL_AMOUNT_LOVELACE);
  }

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTxReturnFullTx(unsignedTx, true);

  try {
    const txHash = await provider.submitTx(signedTx);
    return { txHash, newStrategy };
  } catch (err) {
    console.error("[buildRebalanceTx] submitTx raw error:", err);
    const msg =
      (err as { info?: string })?.info ??
      (err as { message?: string })?.message ??
      JSON.stringify(err);
    throw new Error(`Submit failed: ${msg}`);
  }
}

// ── InjectYield ───────────────────────────────────────────────────────────────
//
// Simulates yield accrual by pushing ADA into the vault without minting new ssADA.
// pricePerShare = totalAda / totalSsada rises for all holders. The on-chain
// `yield_accrued_lovelace` field grows by the injected amount for APR display.
//
// Validator invariants (vault_spend.ak InjectYield branch):
//   - amount_lovelace > 0
//   - new vault lovelace == old + amount_lovelace
//   - new total_ada_lovelace == old + amount_lovelace
//   - new yield_accrued_lovelace == old + amount_lovelace
//   - ssADA total / strategy / timestamp / policy_id UNCHANGED

export async function buildInjectYieldTx(
  wallet: MeshCardanoBrowserWallet,
  yieldAda: number,
): Promise<{ txHash: string; yieldLovelace: bigint }> {
  const provider = makeProvider();
  if (!provider) throw new Error("VITE_BLOCKFROST_PROJECT_ID not set — cannot build on-chain tx");

  const userAddress = await wallet.getChangeAddressBech32();
  if (!userAddress) throw new Error("Wallet not connected or no address found");
  const userUtxos = await provider.fetchAddressUTxOs(userAddress);
  if (!userUtxos.length) throw new Error("No UTxOs at wallet address.");
  const { utxo: collateral, multiAsset: collateralMultiAsset } = await pickCollateral(wallet, userUtxos);

  const vaultUtxo = await fetchVaultUtxo();
  if (!vaultUtxo) throw new Error("No vault UTxO found");
  const vaultState = parseVaultState(vaultUtxo);
  if (!vaultState) throw new Error("Cannot parse vault datum");

  const yieldLovelace = BigInt(Math.floor(yieldAda * 1_000_000));
  if (yieldLovelace <= 0n) throw new Error("Yield amount must be positive");

  const newTotalAda = vaultState.totalAdaLovelace + yieldLovelace;
  const newYieldAccrued = vaultState.yieldAccruedLovelace + yieldLovelace;

  const newDatum = buildVaultDatumData(
    newTotalAda,
    vaultState.totalSsada,
    vaultState.strategy,
    vaultState.lastRebalanceMs,
    newYieldAccrued,
  );

  // InjectYield { amount_lovelace: Int } = Constr(3, [Int])
  const vaultRedeemer: Data = conStr3([integer(Number(yieldLovelace))]);

  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider, evaluator: provider });
  txBuilder.setNetwork("preprod");

  txBuilder
    .spendingPlutusScriptV3()
    .txIn(
      vaultUtxo.input.txHash,
      vaultUtxo.input.outputIndex,
      vaultUtxo.output.amount,
      vaultUtxo.output.address,
    )
    .txInScript(applyCborEncoding(VAULT_SCRIPT_CBOR))
    .txInInlineDatumPresent()
    .txInRedeemerValue(vaultRedeemer, "JSON");

  // Vault output with injected ADA + updated datum
  const vaultAdaOut =
    vaultUtxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0";
  const vaultLovelaceOut = (BigInt(vaultAdaOut) + yieldLovelace).toString();

  txBuilder
    .txOut(VAULT_ADDRESS, [{ unit: "lovelace", quantity: vaultLovelaceOut }])
    .txOutInlineDatumValue(newDatum, "JSON");

  txBuilder
    .txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address,
    )
    .changeAddress(userAddress)
    .selectUtxosFrom(userUtxos);

  if (collateralMultiAsset) {
    txBuilder.setTotalCollateral(COLLATERAL_AMOUNT_LOVELACE);
  }

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTxReturnFullTx(unsignedTx, true);

  try {
    const txHash = await provider.submitTx(signedTx);
    return { txHash, yieldLovelace };
  } catch (err) {
    console.error("[buildInjectYieldTx] submitTx raw error:", err);
    const msg =
      (err as { info?: string })?.info ??
      (err as { message?: string })?.message ??
      JSON.stringify(err);
    throw new Error(`Submit failed: ${msg}`);
  }
}
