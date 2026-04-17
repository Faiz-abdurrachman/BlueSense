// BlueSense Vault Service
// Builds and submits Deposit / Withdraw transactions using MeshTxBuilder.
//
// Contract addresses (Cardano Preprod, deployed 2026-04-17):
//   vault_spend  → addr_test1wzsawswqa693tszntrfypmf9srkmmhdjqf59nccjpz7z8rcffau7u
//   ssada_mint   → policy 1605fc3f5cbf65d6b6c2420ca3dcb373c981bec94bebce648d3bb9b1

import {
  BlockfrostProvider,
  MeshTxBuilder,
  conStr0,
  conStr1,
  conStr2,
  integer,
  byteString,
  outputReference,
  type UTxO,
  type Data,
} from "@meshsdk/core";
import type { MeshCardanoBrowserWallet } from "@meshsdk/wallet";

// ── Contract constants ────────────────────────────────────────────────────────

export const VAULT_ADDRESS =
  import.meta.env.VITE_VAULT_ADDRESS ??
  "addr_test1wzsawswqa693tszntrfypmf9srkmmhdjqf59nccjpz7z8rcffau7u";

export const VAULT_SCRIPT_HASH =
  import.meta.env.VITE_VAULT_SCRIPT_HASH ??
  "a1d741c0ee8b15c05358d240ed2580edbdddb2026859e31208bc238f";

export const SSADA_POLICY_ID =
  import.meta.env.VITE_SSADA_POLICY_ID ??
  "1605fc3f5cbf65d6b6c2420ca3dcb373c981bec94bebce648d3bb9b1";

export const SSADA_TOKEN_NAME =
  import.meta.env.VITE_SSADA_TOKEN_NAME ?? "737341444100";

// Compiled scripts from plutus.json (vault_spend) and blueprint apply (ssada_mint)
const VAULT_SCRIPT_CBOR =
  "5907bf01010029800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e3300130093754007370e90004dc3a40093008375400891111991192cc004c0180122b3001301037540170018b20228acc004c0240122b3001301037540170018b20228acc004c0140122b3001301037540170018b20228b201c40388070566002600a601c6ea80062646644b3001300830113754005198009180b180b800c8c058c05cc05cc05cc05c0064446466446600400400244b3001001801c4c8cc896600266e4401c00a2b30013371e00e00510018032032899802802980f8022032375c60300026eb4c064004c06c005019191919800800803112cc00400600713233225980099b910090028acc004cdc78048014400600c80d226600a00a604000880d0dd7180c8009bab301a001301c0014068297adef6c6014800244b3001300a301337540051323232323298009bae301c0019bad301c0059bad301c0049bad301c0024888966002604200b1323259800980a800c566002603e6ea800a019164081159800980c000c566002603e6ea800a019164081159800980a000c566002603e6ea800a01916408116407480e901d180e9baa00130200078b203c180e000980d800980d000980c800980a1baa0028b20249180b180b980b800cc044dd5006cdc424000911111119912cc004c04401226644b30013013301c37540031323259800980a180f1baa001899198058008992cc004c02401a2b300130090018acc004cdc39bad300f3021375400466e00dd6980798109baa0100068acc004cdc39bad30243021375400466e00dd6981218109baa010001899b8f375c601c60426ea8008dd7180718109baa0108a50407d14a080fa294101f4528203e33702600c6eacc038c080dd50019bad30233020375401e6044603e6ea80062c80e8c020c078dd50009810180e9baa0018b203698009bab3008301b3754027375c601060366ea802a91010673734144410000401c660186eb0c014c06cdd5009919baf301f301c3754002007159800980a00244cc8966002602660386ea800626464b30013014301e37540031323300b0011325980098048034566002601200315980099b87375a601e60426ea8008cdc09bad300f3021375402000d15980099b87375a604860426ea8008cdc09bad30243021375402000313371e6eb8c038c084dd50011bae300e3021375402114a080fa294101f4528203e8a50407c66e04dd6981198101baa00f30063756601c60406ea800cc088c07cdd5000c5901d1804180f1baa0013020301d375400316406c66e05200098009bab3008301b3754027375c601060366ea802a91010673734144410000401c660186eb0c014c06cdd5009919baf301f301c3754002007132598009808980d9baa0018acc004c966002602c60386ea8006266e20dd69810180e9baa001375a60406042646644b30013016301f3754003132598009812800c4c8cc896600260340031323259800981500140122c8138c0a0004c090dd5001c566002603a0031323259800981500140122c8138c0a0004c090dd5001c5660026032003132598009814800c4c8cc004004dd59814801112cc00400600b132332233005005302e004375a604e0026050002605400281422c8130c090dd5001c59022204440882646604a6ea0cc01400520003302537506600a0029002198129ba83259800980d18119baa00189bad30273024375400314803102219803000a400c97ae03259800980c000c4dd5981318119baa0028acc004c0640062d1640848108c084dd500098109baa00130240018b2044302037540031640784464b30013017302037540031375a604860426ea80062c80f8cc00c008004c084c078dd5001911919800800801912cc0040062980103d87a80008992cc004cdc39bad3021001004899ba548000cc090c0880052f5c11330030033026002408060480028112294101b180f980e1baa300a301c3754603e604060406040604060406040604060386ea8052264b30013013301c37540031323259800980a180f1baa001899198058008acc004cdc398031bab300e302037540066eb4c08cc080dd5007c5660026466e20dd6980098109baa010375a600260426ea80088c090c094c094c0940062b30013370e6eb4c038c080dd50009bad300e3020375401f15980099b87375a604660406ea8004dd6981198101baa00f899b8f375c601a60406ea8004dd7180698101baa00f8a50407914a080f2294101e4528203c3022301f37540031640746010603c6ea8004c080c074dd5000c5901b198069bac3006301c3754028466ebcc080c074dd500080245901a45901a1802980d9baa3009301b375464b30013012301b37540031301f301c3754003164068660186eb0c024c06cdd50099180acc004dd59805180e1baa300a301c375400348811c1116903479e7320b8e4592207aaebf627898267fcd80e2d9646cbf0700a4410a4f7261636c654665656400402080c9019180e180c9baa300730193754603860326ea8024a6002003488100a4410040188b2020330013758602660206ea80208cdd7980a18089baa00100430133010375400444646600200200644b30010018a60103d87a80008992cc004c010006266e952000330160014bd7044cc00c00cc060009012180b000a0288b201a3010004301030110044590070c020004c00cdd5004452689b2b20021";

const SSADA_MINT_SCRIPT_CBOR =
  "5905ef0101003229800aba2aba1aba0aab9faab9eaab9dab9a9bae0024888888896600264653001300900198049805000cdc3a400130090024888966002600460126ea800e26530011980091119199119801001000912cc00400600713233225980099b910070028acc004cdc78038014400600c809226600a00a60300088090dd718088009bad30120013014001404864646600200200c44b3001001801c4c8cc896600266e4402400a2b30013371e01200510018032026899802802980c8022026375c60240026eacc04c004c0540050130a5eb7bdb18052000918079808180818081808000cdc3a40092300f30100019180798081808000c88c8cc00400400c896600200314c103d87a80008992cc004c010006266e952000330120014bd7044cc00c00cc05000900e1809000a020488888a600253001001a4500a44100401d2259800980598091baa002899191919194c004dd7180d800cdd6980d802cdd6980d8024dd6980d80124444b30013020005899192cc004c0580062b3001301e375400500c8b203e8acc004cdc3a4004003159800980f1baa00280645901f45660026022003159800980f1baa00280645901f45901c2038407060386ea8004c07c01e2c80e8603600260340026032002603000260266ea800a2c808a4466006004466ebcc05cc050dd50008012444b3001300c3013375401d132598009806980a1baa001899192cc004c028c058dd5000c4c8cc0180044c966002602260306ea800626464b3001300e301a37540031323300a001132325980099b884800000a2b30013370f300137566024603c6ea805602948810673734144410000404c00315980099b87375a6042603c6ea800ccdc01bad3021301e375400e00515980099b87375a6020603c6ea800ccdc01bad3010301e375400e00315980099baf300f301e3754006601e603c6ea801e2b30013371e6eb8c048c078dd500180a44cdc79bae3012301e375400e02914a080e2294101c452820388a50407114a080e2294101c19912cc00566002602e00314a31301700240751003899b833370400600200480e8dd69810180e9baa006375a601e603a6ea8018cdc098059bab300e301c375400660166eacc038c070dd51807180e1baa007301e301b3754003164064601660346ea8004c070c064dd5000c59017198041bac30093018375401e466ebcc070c064dd5180e180c9baa0013374a90011980d9ba90164bd70180d180b9baa0018b202a3007301637546010602c6ea8004c060c054dd5000c59013198009bac301730143754016602e60286ea803a264b3001300d3014375400313232598009805180b1baa0018991980300089919912cc004c04cc068dd5000c4c8c966002602060386ea8006264660180022b3001337109000003456600266e24014cdc098069bab3010301e37546020603c6ea8024c034dd59808180f1baa0038acc004cdc39bad3021301e375400266e04dd69810980f1baa0070058acc004cdc39bad3010301e375400266e04dd69808180f1baa0070068acc004cdc79bae3012301e375400e02913371e6eb8c048c078dd500080a452820388a50407114a080e2294101c452820383020301d375400316406c601a60386ea8004c078c06cdd5000c5901919b83337040026eb4c070c064dd50011bad300b30193754004660126eb0c028c064dd5008119baf301d301a3754603a60346ea8004cdd2a4004660386ea405d2f5c066e05200098009bab300c3018375401f00ea441067373414441000040346034602e6ea80062c80a8c01cc058dd51804180b1baa00130183015375400316404c660026eb0c05cc050dd5005980b980a1baa00e40484c028dd5002c8966002600a60186ea800a264646644b30013015003802c590121bad3012001375c60240046024002601a6ea800a2c805922259800980300144c966002602600313300230120010048b2020300e375401115980099b874800800a264b30013013001899801180900080245901018071baa0088b20184030375c601a60146ea800e2c8040601200260086ea802629344d95900213011e581ca1d741c0ee8b15c05358d240ed2580edbdddb2026859e31208bc238f0001";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Strategy = "NativeStaking" | "LiqwidLending" | "MinswapLP";

export interface VaultState {
  totalAdaLovelace: bigint;
  totalSsada: bigint;
  strategy: Strategy;
  lastRebalanceMs: number;
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
): Data {
  return conStr0([
    integer(Number(totalAdaLovelace)),
    integer(Number(totalSsada)),
    strategyData(strategy),
    integer(lastRebalanceMs),
    byteString(SSADA_POLICY_ID),
  ]);
}

// ── Datum decoding ────────────────────────────────────────────────────────────

function strategyFromIndex(idx: number): Strategy {
  if (idx === 1) return "LiqwidLending";
  if (idx === 2) return "MinswapLP";
  return "NativeStaking";
}

export function parseVaultState(utxo: UTxO): VaultState | null {
  try {
    const raw = utxo.output.plutusData;
    if (!raw) return null;
    // Minimal CBOR decode: d87982 = Constr(0, [5 fields])
    // For demo, if datum is not yet on-chain, return empty vault
    const state: VaultState = {
      totalAdaLovelace: 0n,
      totalSsada: 0n,
      strategy: "NativeStaking",
      lastRebalanceMs: Date.now(),
      utxo,
    };
    return state;
  } catch {
    return null;
  }
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

// ── Deposit ───────────────────────────────────────────────────────────────────

export async function buildDepositTx(
  wallet: MeshCardanoBrowserWallet,
  depositAda: number,
): Promise<DepositResult> {
  const provider = makeProvider();
  if (!provider) throw new Error("VITE_BLOCKFROST_PROJECT_ID not set — cannot build on-chain tx");

  const [userAddress] = await wallet.getUsedAddresses();
  const userUtxos = await wallet.getUtxos();
  const depositLovelace = BigInt(Math.floor(depositAda * 1_000_000));

  // Fetch current vault state
  const vaultUtxo = await fetchVaultUtxo();
  const vaultState = vaultUtxo ? parseVaultState(vaultUtxo) : null;

  const prevTotalAda    = vaultState?.totalAdaLovelace ?? 0n;
  const prevTotalSsada  = vaultState?.totalSsada       ?? 0n;
  const newTotalAda     = prevTotalAda + depositLovelace;
  const ssadaToMint     = calcMintAmount(depositLovelace, prevTotalAda, prevTotalSsada);
  const newTotalSsada   = prevTotalSsada + ssadaToMint;
  const nowMs           = Date.now();

  const newDatum = buildVaultDatumData(newTotalAda, newTotalSsada, vaultState?.strategy ?? "NativeStaking", nowMs);

  // Redeemers
  const vaultRedeemer: Data = conStr0([]); // Deposit
  const mintRedeemer: Data = conStr0([
    outputReference(
      vaultUtxo?.input.txHash ?? "0".repeat(64),
      vaultUtxo?.input.outputIndex ?? 0,
    ),
  ]);

  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider, evaluator: provider });

  // Spend vault UTxO (if exists)
  if (vaultUtxo) {
    txBuilder
      .spendingPlutusScriptV3()
      .txIn(
        vaultUtxo.input.txHash,
        vaultUtxo.input.outputIndex,
        vaultUtxo.output.amount,
        vaultUtxo.output.address,
      )
      .txInScript(VAULT_SCRIPT_CBOR)
      .txInInlineDatumPresent()
      .txInRedeemerValue(vaultRedeemer, "Mesh");
  }

  // Mint ssADA
  txBuilder
    .mintPlutusScriptV3()
    .mint(ssadaToMint.toString(), SSADA_POLICY_ID, SSADA_TOKEN_NAME)
    .mintingScript(SSADA_MINT_SCRIPT_CBOR)
    .mintRedeemerValue(mintRedeemer, "Mesh");

  // Vault output with new datum + all ADA
  const vaultAdaOut = (vaultUtxo
    ? vaultUtxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0"
    : "0");
  const vaultLovelaceOut = (BigInt(vaultAdaOut) + depositLovelace).toString();

  txBuilder
    .txOut(VAULT_ADDRESS, [{ unit: "lovelace", quantity: vaultLovelaceOut }])
    .txOutInlineDatumValue(newDatum, "Mesh");

  // ssADA to user
  txBuilder.txOut(userAddress, [
    { unit: `${SSADA_POLICY_ID}${SSADA_TOKEN_NAME}`, quantity: ssadaToMint.toString() },
  ]);

  // Change + user UTxOs
  txBuilder.changeAddress(userAddress);
  for (const utxo of userUtxos) {
    txBuilder.txIn(
      utxo.input.txHash,
      utxo.input.outputIndex,
      utxo.output.amount,
      utxo.output.address,
    );
  }

  const unsignedTx = await txBuilder.complete();
  const signedTx   = await wallet.signTx(unsignedTx, true);
  const txHash     = await wallet.submitTx(signedTx);

  return { txHash, ssadaMinted: ssadaToMint };
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

export async function buildWithdrawTx(
  wallet: MeshCardanoBrowserWallet,
  ssadaBurnAmount: bigint,
): Promise<{ txHash: string; adaReturned: bigint }> {
  const provider = makeProvider();
  if (!provider) throw new Error("VITE_BLOCKFROST_PROJECT_ID not set — cannot build on-chain tx");

  const [userAddress] = await wallet.getUsedAddresses();
  const userUtxos = await wallet.getUtxos();

  const vaultUtxo = await fetchVaultUtxo();
  if (!vaultUtxo) throw new Error("No vault UTxO found");
  const vaultState = parseVaultState(vaultUtxo);
  if (!vaultState) throw new Error("Cannot parse vault datum");

  const adaToReturn  = calcRedeemAmount(ssadaBurnAmount, vaultState.totalAdaLovelace, vaultState.totalSsada);
  const newTotalAda  = vaultState.totalAdaLovelace - adaToReturn;
  const newTotalSsada = vaultState.totalSsada - ssadaBurnAmount;
  const newDatum = buildVaultDatumData(newTotalAda, newTotalSsada, vaultState.strategy, Date.now());

  const vaultRedeemer: Data = conStr1([]); // Withdraw
  const burnRedeemer: Data = conStr1([
    outputReference(vaultUtxo.input.txHash, vaultUtxo.input.outputIndex),
  ]);

  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider, evaluator: provider });

  txBuilder
    .spendingPlutusScriptV3()
    .txIn(
      vaultUtxo.input.txHash,
      vaultUtxo.input.outputIndex,
      vaultUtxo.output.amount,
      vaultUtxo.output.address,
    )
    .txInScript(VAULT_SCRIPT_CBOR)
    .txInInlineDatumPresent()
    .txInRedeemerValue(vaultRedeemer, "Mesh");

  // Burn ssADA
  txBuilder
    .mintPlutusScriptV3()
    .mint((-ssadaBurnAmount).toString(), SSADA_POLICY_ID, SSADA_TOKEN_NAME)
    .mintingScript(SSADA_MINT_SCRIPT_CBOR)
    .mintRedeemerValue(burnRedeemer, "Mesh");

  // Vault output (reduced ADA)
  const vaultAdaOut = vaultUtxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0";
  const vaultLovelaceOut = (BigInt(vaultAdaOut) - adaToReturn).toString();
  txBuilder
    .txOut(VAULT_ADDRESS, [{ unit: "lovelace", quantity: vaultLovelaceOut }])
    .txOutInlineDatumValue(newDatum, "Mesh");

  // ADA to user
  txBuilder.txOut(userAddress, [{ unit: "lovelace", quantity: adaToReturn.toString() }]);

  txBuilder.changeAddress(userAddress);
  for (const utxo of userUtxos) {
    txBuilder.txIn(
      utxo.input.txHash,
      utxo.input.outputIndex,
      utxo.output.amount,
      utxo.output.address,
    );
  }

  const unsignedTx = await txBuilder.complete();
  const signedTx   = await wallet.signTx(unsignedTx, true);
  const txHash     = await wallet.submitTx(signedTx);

  return { txHash, adaReturned: adaToReturn };
}
