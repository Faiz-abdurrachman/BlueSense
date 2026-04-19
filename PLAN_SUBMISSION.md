# BlueSense Submission Plan

> **Deadline:** 2026-05-19 (Charli3 Oracles Hackathon 2026)
> **Hari ini:** 2026-04-19
> **Runway:** ~30 hari (4 minggu)

---

## 🎯 Big Picture Goals

Sampai 19 Mei, gw mau BlueSense punya:

1. **PRD §6 compliance** — yield simulation beneran (pricePerShare naik dari 1.000 → 1.025 → dst)
2. **Minimal 1 real strategy allocation** — bukan cuma logical tag, tapi ADA-nya beneran pindah ke Minswap/Liqwid
3. **UX yang polished** — error handling, loading states, edge cases ketangani
4. **Demo video 2-3 menit** — rapih, naratif jelas, fokus ke oracle integration
5. **README final** — submission-ready, arsitektur clear, claims honest

---

## 👥 Work Split

| Role | Faiz (frontend dev) | Teammate (contract dev) |
|---|---|---|
| **Week 1** | Frontend wiring, deploy script, UI untuk yield sim | Tambah `InjectYield` redeemer di `vault_spend.ak`, rebuild CBOR |
| **Week 2** | Minswap SDK integration, TX build | Update validator untuk real allocation (opsional on-chain enforcement) |
| **Week 3** | Error handling, polish, edge case tests | Code review, audit self |
| **Week 4** | Demo video recording, README final | Backup + support |

---

## 📅 Week 1: Yield Simulation + Redeploy (19-26 April)

**Goal:** Match PRD §6 — setelah rebalance, pricePerShare naik dari datum on-chain.

### Contract Changes (Teammate)

- [ ] **`contracts/lib/bluesense/types.ak`** — tambah field di `VaultDatum`:
  ```aiken
  pub type VaultDatum {
    total_ada_lovelace: Int,
    total_ssada: Int,
    strategy: Strategy,
    last_rebalance_ms: Int,
    ssada_policy_id: ByteArray,
    yield_accrued_lovelace: Int,  // NEW
  }
  ```

- [ ] **`contracts/validators/vault_spend.ak`** — tambah branch `InjectYield`:
  - Redeemer: `InjectYield { amount_lovelace: Int }`
  - Rule: `new_datum.total_ada_lovelace == old.total_ada_lovelace + amount`
  - Rule: `new_datum.yield_accrued_lovelace == old.yield_accrued + amount`
  - Rule: `new_datum.total_ssada == old.total_ssada` (ssADA tidak berubah)
  - Effect: `pricePerShare = total_ada / total_ssada` naik otomatis

- [ ] **Rebuild** — `aiken build`, copy CBOR baru ke `src/services/vaultService.ts`

- [ ] **Deploy ulang** — init vault baru dengan seed 5 ADA, catat address baru

### Frontend Changes (Faiz)

- [ ] **`src/services/vaultService.ts`**:
  - Update `VAULT_SCRIPT_CBOR` + `SSADA_MINT_SCRIPT_CBOR`
  - Update `VaultDatum` type + `parseVaultState` untuk field `yieldAccruedLovelace`
  - Tambah `buildInjectYieldTx(amountLovelace: bigint)` function

- [ ] **`src/pages/Dashboard.tsx`**:
  - Ganti hardcoded `pricePerShare = 1.025` jadi:
    ```ts
    const pricePerShare = Number(vaultState.totalAdaLovelace) / Number(vaultState.totalSsada);
    ```
  - Tambah tombol dev/demo: **"🎲 Simulate Yield (+0.5 ADA)"** — cuma muncul kalau env `VITE_DEV_MODE=true`
  - Tampilin APR estimasi: `(yieldAccrued / totalAda) × (365 / days_since_init)`

- [ ] **`.env`**:
  - Update `VITE_VAULT_ADDRESS` + `VITE_VAULT_SCRIPT_HASH` + `VITE_SSADA_POLICY_ID` ke vault baru

### Milestone Week 1

- ✅ Deposit di vault baru → dapet ssADA
- ✅ Pencet "Simulate Yield" → vault ADA naik, ssADA tetap → pricePerShare naik on-chain
- ✅ Withdraw → user dapet balik *lebih banyak* ADA dari yang disetor (ada yield beneran)

---

## 📅 Week 2: Real Strategy Allocation (27 April - 3 Mei)

**Goal:** ADA di vault beneran dipindahin ke protokol external (Minswap LP atau Liqwid).

### Rekomendasi: **Minswap LP** (lebih simple + SDK publik)

### Research & Decision (Hari 1-2)

- [ ] Baca Minswap SDK docs: [https://github.com/minswap/sdk](https://github.com/minswap/sdk)
- [ ] Baca Liqwid protocol docs untuk perbandingan
- [ ] Decide: Minswap (ADA/MIN LP) atau Liqwid (qADA lending)

### Implementation (Hari 3-5)

- [ ] Install: `npm i @minswap/sdk`
- [ ] **`src/services/minswapService.ts`** (file baru):
  - `getPoolState(pair): Promise<PoolState>`
  - `buildLpDepositTx(amountAda): Promise<Transaction>`
  - `buildLpWithdrawTx(lpTokens): Promise<Transaction>`

- [ ] **Integrasi ke vault flow**:
  - Opsi A (simple): Vault owner manual trigger "Allocate to Minswap"
  - Opsi B (complex): Validator enforce alokasi sesuai `Strategy` tag

- [ ] **Frontend**:
  - Tombol "🚀 Allocate 50% to Minswap LP" di Dashboard
  - Display LP tokens di vault portfolio
  - Track LP value via Minswap pool price

### Milestone Week 2

- ✅ Vault punya LP tokens Minswap di UTxO-nya
- ✅ Dashboard tampilin: "X ADA di staking, Y ADA di Minswap LP"
- ✅ Transaction bisa diverifikasi di Cardanoscan

---

## 📅 Week 3: Polish + Edge Cases (4-11 Mei)

**Goal:** Siap dipamerin ke investor/judge tanpa malu.

### Error Handling

- [ ] **Wallet belum connect** → disable tombol, tampilin "Connect wallet first"
- [ ] **Insufficient ADA** → tampilin balance saat ini + minimum required
- [ ] **User reject di Eternl** → toast notification "Transaction cancelled", bukan raw error
- [ ] **Blockfrost rate limit (429)** → exponential backoff, cached fallback
- [ ] **Oracle stale** → warning banner "Oracle price is stale, rebalance disabled"
- [ ] **Network disconnect** → retry button, last-known state

### Loading States

- [ ] Skeleton loader untuk TVL saat fetching
- [ ] Spinner di tombol Deposit/Withdraw/Rebalance saat signing
- [ ] Progress indicator: "Building TX → Signing → Submitting → Confirming"
- [ ] Confirmation modal dengan tx hash + Cardanoscan link

### Edge Cases

- [ ] **First deposit** (vault empty) — 1:1 minting, test this
- [ ] **Full withdraw** — kepotong di MIN_VAULT_LOVELACE, kasih warning
- [ ] **Multiple concurrent users** — race condition handling (rare, but document)
- [ ] **Partial withdraw** — test 1 ADA, 0.5 ADA, 100 ADA

### UI Polish

- [ ] Tooltips di setiap term teknis ("ssADA", "APR", "TVL", "Rebalance")
- [ ] Copy-to-clipboard untuk tx hash
- [ ] Dark mode toggle (opsional)
- [ ] Better empty states ("No positions yet — try depositing to see your portfolio")

### Charts (Opsional tapi mantap)

- [ ] TVL history (simpan snapshot di localStorage atau pakai Blockfrost metrics)
- [ ] APR chart (moving average)
- [ ] Strategy allocation pie chart

### Milestone Week 3

- ✅ Semua user flow ada error handling
- ✅ UI rapih, tooltip jelas, gak bikin bingung
- ✅ Edge cases documented + tested

---

## 📅 Week 4: Demo + Submission (12-19 Mei)

### Hari 1-3 (12-14 Mei): Demo Video

- [ ] **Script demo** (1 halaman):
  1. Intro — "BlueSense is a Cardano yield aggregator..."
  2. Connect Eternl wallet
  3. Deposit 10 ADA → show ssADA minted
  4. Force Rebalance → **ZOOM IN ke Cardanoscan Reference Inputs tab** (Charli3 oracle)
  5. Simulate Yield → show pricePerShare naik
  6. Withdraw → show ADA balik *lebih banyak*
  7. Outro — "On-chain oracle verification, Charli3 Pull Oracle, etc."

- [ ] **Record** dengan OBS / Loom / screen recorder
- [ ] **Edit** — potong bagian loading, add captions untuk istilah teknis
- [ ] **Upload** — YouTube unlisted / Loom / Google Drive

### Hari 4-5 (15-16 Mei): README Final

- [ ] Update transaction hashes ke tx terbaru (vault baru)
- [ ] Update deployed addresses
- [ ] Add demo video link di top
- [ ] Add architecture diagram (update kalau ada perubahan Week 2)
- [ ] Hapus "Known Deviations" yang udah diperbaiki
- [ ] Add "Future Work" section

### Hari 6-7 (17-18 Mei): Submission

- [ ] Submit ke form hackathon (cari tau URL-nya)
- [ ] Attach: repo link, demo video, README, deck (kalau ada)
- [ ] Double-check semua link berfungsi
- [ ] Test deploy frontend (Vercel/Netlify) kalau perlu live demo

### Hari 8 (19 Mei): Buffer

- [ ] Last-minute fixes
- [ ] Social media posts (opsional)
- [ ] Kasih tau teammate, celebrate

---

## ⚠️ Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Contract changes break existing flows | High | Test semua 3 flows (deposit/withdraw/rebalance) habis redeploy |
| Minswap SDK incompatibility dengan Mesh | Medium | Fallback ke manual TX build pake Mesh primitives |
| Blockfrost project id limit habis | Low | Pake akun kedua / tier berbayar |
| Teammate gak available | Medium | Redundansi — Faiz baca Aiken basic biar bisa debug |
| Preprod node down | Low | Gunakan Demeter.run sebagai backup provider |
| Demo video audio jelek | Medium | Record pake mic laptop + noise cancellation |

---

## 🎯 Success Criteria (What "Done" Looks Like)

- ✅ PRD §6 demo scenario bisa dijalanin end-to-end tanpa deviation
- ✅ Minimal 1 strategy (Minswap atau Liqwid) real allocation, bukan logical
- ✅ Minimal 5 verified tx hashes di preprod (deposit/rebalance/withdraw/yield inject/lp deposit)
- ✅ Demo video ≤3 menit, audio jelas, screen clear
- ✅ README punya: live deployment addresses, tx hashes, arch diagram, known deviations (kalau ada), future work
- ✅ Repo punya: CI green (optional), README, LICENSE, .env.example, setup instructions

---

## 📊 Weekly Check-in Questions

Setiap akhir minggu, tanya diri sendiri:

1. **Did I finish the milestone?** Kalau gak, kenapa?
2. **Did I learn anything new?** Catat di notes
3. **Did teammate unblock me?** Kalau ada dependency, raise early
4. **Do I need to cut scope?** Week 2/3 bisa di-skip kalau kejar deadline

---

## 🔄 Scope Cut Plan (Kalau Keteteran)

Kalau di Week 3 keliatan bakal telat, urutan cut:

1. **Cut first:** Charts (Week 3 optional)
2. **Cut second:** Dark mode, tooltips extensive
3. **Cut third:** Real strategy allocation — balikin ke "logical only" dengan lebih banyak dokumentasi
4. **Never cut:** Yield simulation (Week 1), demo video (Week 4), README (Week 4)

---

## 📝 Daily Workflow Suggestion

- **Pagi (1 jam):** Code review + planning hari ini (pakai TODO list)
- **Siang (2-3 jam):** Deep work — implement feature utama hari itu
- **Sore (1 jam):** Test + commit + push
- **Malam (opsional):** Baca docs Minswap/Charli3, nonton Cardano dev tutorials

Total: **4-5 jam/hari** — realistis buat 30 hari.

---

## 🚀 Let's Gooo

Prioritas sekarang: **Week 1 — Yield Simulation**.

Kalau lu setuju plan ini, kita mulai dari:
1. Ngobrol ke teammate soal `InjectYield` redeemer (estimate 2-3 hari untuk dia)
2. Sambil nunggu, lu bisa prep frontend — update `VaultDatum` type, siapin tombol "Simulate Yield", siapin env baru

Kick-off: Week 1, Day 1 = **Senin 20 April 2026**.
