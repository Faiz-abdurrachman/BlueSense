# BlueSense Project Explainer

> Dokumen ini menjelaskan BlueSense dari nol sampai end-to-end: apa produknya, masalah yang diselesaikan, cara kerja user flow, cara kerja smart contract, peran Charli3 oracle, analogi sederhana, dan perbandingan dengan Yearn Finance vaults.

---

## 1. Ringkasan Singkat

BlueSense adalah vault DeFi di Cardano untuk ADA holder.

Ide utamanya sederhana:

```text
User deposit ADA sekali
    -> vault mint ssADA sebagai bukti kepemilikan share
    -> vault memilih strategi yield terbaik
    -> Charli3 oracle dipakai sebagai sumber data keputusan
    -> nilai ssADA naik ketika vault menghasilkan yield
    -> user withdraw dan menerima ADA + yield
```

Kalau disederhanakan, BlueSense adalah "Yearn Finance style vault" untuk ekosistem Cardano, dengan fokus khusus pada ADA dan oracle-based strategy routing.

Target narasi produk:

```text
Staking terasa mudah, tapi yield-nya kecil.
DeFi yield lebih tinggi, tapi ribet.
BlueSense membuat DeFi yield terasa sesimpel staking.
```

---

## 2. Problem Yang BlueSense Selesaikan

Banyak ADA holder sudah terbiasa staking. Mereka tahu konsep passive income dan mereka nyaman menyimpan ADA untuk jangka panjang.

Masalahnya, native staking biasanya hanya memberi APY sekitar 3-5%. Di sisi lain, peluang DeFi seperti lending atau LP farming bisa lebih tinggi, misalnya:

| Opsi | Contoh Yield | Masalah Untuk User Biasa |
|---|---:|---|
| Native staking | 3-5% | Mudah, tapi yield relatif kecil |
| Liqwid lending | 8-15% | Perlu paham lending DeFi |
| Minswap LP | 20-40% | Perlu paham LP, pool, price risk, impermanent loss |

Masalah utamanya bukan user tidak mau yield lebih tinggi.

Masalahnya:

- User harus buka banyak app.
- User harus memahami banyak istilah DeFi.
- User harus monitor APY sendiri.
- User harus pindah dana manual ketika strategi lain lebih bagus.
- User harus percaya data yield dan harga yang sering berubah.

BlueSense mencoba menjembatani gap ini dengan satu UX:

```text
Deposit ADA -> dapat ssADA -> vault/router yang bekerja.
```

---

## 3. Analogi Sederhana

Bayangkan BlueSense seperti manajer investasi otomatis untuk ADA.

### Tanpa BlueSense

User seperti orang yang punya uang dan harus memilih sendiri:

- Taruh di deposito biasa.
- Pinjamkan ke orang lain.
- Masuk ke bisnis likuiditas.
- Pantau bunga setiap hari.
- Pindah uang sendiri kalau peluang lain lebih bagus.

Ini melelahkan.

### Dengan BlueSense

User masuk ke satu "rekening pintar".

```text
User setor ADA ke rekening pintar.
Rekening pintar memberi bukti kepemilikan bernama ssADA.
Rekening pintar mengecek data pasar.
Rekening pintar memilih strategi yield.
Kalau kondisi berubah, rekening pintar rebalancing.
Saat user keluar, ssADA ditukar lagi menjadi ADA sesuai nilai terbaru.
```

Analogi bank:

```text
ADA = uang yang disetor
Vault = rekening bersama
ssADA = tanda bukti kepemilikan saldo di rekening bersama
Strategy = tempat rekening bekerja mencari bunga
Charli3 oracle = petugas data harga yang dipercaya
Rebalance = manajer memindahkan dana ke pilihan yang lebih bagus
Withdraw = user menukar bukti kepemilikan kembali menjadi ADA
```

---

## 4. Apa Itu Vault?

Vault adalah smart contract yang menampung dana banyak user dan mengelolanya dengan aturan tertentu.

Dalam BlueSense:

- Vault menerima ADA.
- Vault mencatat total ADA dalam sistem.
- Vault mencatat total ssADA yang beredar.
- Vault menyimpan strategi aktif.
- Vault menyimpan policy ID ssADA yang valid.
- Vault menyimpan yield simulasi yang sudah diakumulasi.

Konsep penting:

```text
pricePerShare = total ADA di vault / total ssADA beredar
```

Kalau vault punya 100 ADA dan 100 ssADA beredar:

```text
pricePerShare = 100 / 100 = 1.0 ADA per ssADA
```

Kalau vault menghasilkan yield sehingga total ADA naik ke 105 ADA, tapi ssADA tetap 100:

```text
pricePerShare = 105 / 100 = 1.05 ADA per ssADA
```

Artinya, user yang punya 100 ssADA bisa withdraw sekitar 105 ADA.

Ini inti share-based vault accounting.

---

## 5. Apa Itu ssADA?

ssADA adalah share token.

ssADA bukan sekadar "reward token". ssADA adalah bukti kepemilikan proporsional atas vault.

Kalau vault adalah kolam uang, ssADA adalah tiket klaim atas sebagian kolam itu.

Contoh:

```text
Vault punya 100 ADA
Total ssADA beredar 100 ssADA
User A punya 10 ssADA
User A memiliki 10% klaim atas vault
```

Kalau vault naik menjadi 120 ADA:

```text
User A tetap punya 10 ssADA
Tapi 10 ssADA sekarang mewakili 12 ADA
```

Jadi yield tidak harus dibayarkan sebagai token reward terpisah. Yield masuk ke vault, lalu harga ssADA naik.

---

## 6. Core User Flow

### 6.1 Flow Paling Sederhana Untuk User

```text
1. User buka BlueSense dashboard.
2. User connect wallet Eternl di Cardano Preprod.
3. User melihat vault ssADA.
4. User memasukkan jumlah ADA.
5. User klik Mint ssADA.
6. Wallet meminta tanda tangan transaksi.
7. User approve.
8. Transaksi masuk ke Cardano.
9. User menerima ssADA.
10. Nilai posisi user mengikuti pricePerShare.
11. User bisa withdraw kapan saja.
```

### 6.2 Flow Demo Hackathon

Flow ideal untuk demo 2-5 menit:

```text
1. Connect wallet.
2. Init Vault jika vault belum ada.
3. Deposit 10 ADA.
4. Vault mint 10 ssADA.
5. Dashboard menampilkan TVL dan strategy aktif.
6. Force Rebalance.
7. Transaksi rebalance membawa Charli3 oracle UTxO sebagai reference_input.
8. Strategy aktif berubah sesuai rekomendasi APY.
9. Simulate Yield.
10. Vault ADA naik tanpa mint ssADA baru.
11. pricePerShare naik.
12. Withdraw ssADA.
13. User menerima ADA sesuai share value terbaru.
```

### 6.3 Flow Dari Kacamata User Non-Teknis

User hanya perlu memahami tiga hal:

```text
Deposit ADA
Pegang ssADA
Withdraw saat mau keluar
```

Semua yang rumit disembunyikan:

- Strategy selection.
- Oracle data.
- Rebalancing.
- Share accounting.
- Mint/burn token.
- Datum update.
- Script validation.

---

## 7. End-to-End Teknis

Bagian ini menjelaskan apa yang terjadi dari klik user sampai validasi on-chain.

### 7.1 End-to-End Deposit

User action:

```text
User input 10 ADA -> klik Mint ssADA -> approve wallet
```

Frontend melakukan:

```text
1. Ambil wallet address.
2. Ambil UTxO user dari Blockfrost.
3. Ambil vault UTxO dari vault address.
4. Decode inline datum vault.
5. Hitung jumlah ADA deposit dalam lovelace.
6. Hitung ssADA yang harus dimint.
7. Build output baru untuk vault dengan ADA bertambah.
8. Build datum baru untuk vault.
9. Attach vault spending script.
10. Attach ssADA minting script.
11. Attach collateral.
12. Build transaction.
13. Wallet sign.
14. Submit ke Blockfrost.
```

Contract validation:

```text
vault_spend validator:
    - memastikan vault input benar-benar dibelanjakan
    - memastikan ada vault output baru
    - memastikan ADA vault naik
    - memastikan ssADA minted > 0
    - memastikan total ADA dan total ssADA di datum naik sesuai aturan
    - memastikan ssADA policy ID tidak berubah

ssada_mint validator:
    - memastikan vault input yang direferensikan ikut ada di tx
    - memastikan vault output kembali ke vault script
    - memastikan jumlah ssADA minted sesuai rumus
    - memastikan policy ID di datum sama dengan policy minting ini
```

Rumus deposit:

```text
Jika vault kosong:
    ssADA minted = ADA deposit

Jika vault sudah ada:
    ssADA minted = ADA deposit * total ssADA / total ADA
```

Kenapa proporsional?

Karena user baru tidak boleh mengambil yield lama milik depositor lama. Kalau pricePerShare sudah naik, user baru harus menerima ssADA lebih sedikit untuk ADA yang sama.

### 7.2 End-to-End Withdraw

User action:

```text
User klik Withdraw -> approve wallet
```

Frontend melakukan:

```text
1. Cek ssADA balance user.
2. Ambil vault UTxO.
3. Decode vault datum.
4. Hitung ADA yang harus dikembalikan.
5. Build vault output baru dengan ADA berkurang.
6. Burn ssADA user.
7. Kirim ADA ke user.
8. Update datum vault.
9. Sign dan submit transaction.
```

Contract validation:

```text
vault_spend validator:
    - memastikan ssADA burned > 0
    - memastikan ADA keluar dari vault
    - memastikan total ADA dan total ssADA di datum turun
    - memastikan policy ID tetap sama

ssada_mint validator:
    - memastikan burn amount valid
    - memastikan ADA returned sesuai proporsi share
```

Rumus withdraw:

```text
ADA returned = ssADA burned * total ADA / total ssADA
```

### 7.3 End-to-End Rebalance

User action:

```text
User klik Force Rebalance
```

Frontend melakukan:

```text
1. Ambil rekomendasi strategy dari oracle/rest/router.
2. Ambil vault UTxO.
3. Ambil Charli3 oracle UTxO yang membawa OracleFeed asset.
4. Build transaksi spending vault.
5. Attach Charli3 oracle UTxO sebagai reference_input.
6. Set validity upper bound supaya oracle freshness bisa dicek.
7. Update strategy field di vault datum.
8. Sign dan submit transaction.
```

Contract validation:

```text
vault_spend validator:
    - mencari oracle reference_input
    - decode oracle datum
    - memastikan oracle belum expired
    - memastikan ADA tidak berubah
    - memastikan ssADA tidak berubah
    - memastikan yield accrued tidak berubah
    - memastikan last_rebalance_ms naik
    - update strategy
```

Kenapa `reference_input` penting?

Karena oracle data bisa dibaca oleh script tanpa harus menghabiskan UTxO oracle tersebut. Ini cocok untuk price feed. Banyak transaksi bisa membaca feed yang sama tanpa "memakan" feed.

### 7.4 End-to-End Simulate Yield

Ini fitur demo untuk menunjukkan pricePerShare naik.

User action:

```text
User klik Simulate Yield
```

Frontend melakukan:

```text
1. Ambil vault UTxO.
2. Tambahkan ADA ke vault.
3. Tidak mint ssADA baru.
4. Update total_ada_lovelace.
5. Update yield_accrued_lovelace.
6. Sign dan submit transaction.
```

Contract validation:

```text
vault_spend InjectYield:
    - amount_lovelace > 0
    - ADA vault naik sebesar amount
    - total ADA datum naik sebesar amount
    - yield_accrued_lovelace naik sebesar amount
    - total ssADA tetap
    - strategy tetap
```

Efeknya:

```text
total ADA naik
total ssADA tetap
pricePerShare naik
```

---

## 8. Arsitektur Sistem

### 8.1 High-Level Architecture

```text
User Wallet
    |
    v
React Dashboard
    |
    v
vaultService.ts
    |
    +-- Blockfrost: fetch UTxO, submit tx
    +-- Mesh SDK: build tx, attach scripts, mint/burn
    +-- Charli3 REST: display price/recommendation
    |
    v
Cardano Preprod
    |
    +-- vault_spend.ak
    +-- ssada_mint.ak
    +-- Charli3 oracle UTxO as reference_input
```

### 8.2 Smart Contract Components

| File | Peran |
|---|---|
| `vault_spend.ak` | Validator utama vault. Mengatur deposit, withdraw, rebalance, inject yield |
| `ssada_mint.ak` | Minting policy ssADA. Mengatur mint/burn share token |
| `types.ak` | Definisi `VaultDatum`, `VaultRedeemer`, `Strategy`, `MintRedeemer` |
| `math.ak` | Rumus mint/redeem proporsional |
| `oracle.ak` | Helper untuk cari dan validasi Charli3 oracle reference input |

### 8.3 Frontend Components

| File | Peran |
|---|---|
| `Dashboard.tsx` | UI utama vault, deposit, withdraw, rebalance, simulate yield |
| `Portfolio.tsx` | Menampilkan ssADA holding user |
| `vaultService.ts` | Core transaction builder |
| `charli3OracleService.ts` | Fetch harga dari Charli3 REST |
| `strategyRouter.ts` | Logika rekomendasi strategy |
| `useOraclePrice.ts` | Polling harga oracle |
| `useStrategyRecommendation.ts` | Menghasilkan strategy aktif dan rekomendasi rebalance |

---

## 9. Peran Charli3 Oracle

Charli3 adalah bagian penting dari narasi BlueSense.

Tanpa oracle, BlueSense hanya menjadi vault biasa dengan strategy hardcoded.

Dengan oracle, BlueSense bisa bilang:

```text
Keputusan strategy bukan asumsi frontend.
Keputusan strategy didukung data oracle.
Rebalance on-chain wajib membawa oracle reference input.
```

Ada dua jalur penggunaan oracle:

### 9.1 Off-Chain REST

Dipakai untuk UI:

- Menampilkan ADA/USD.
- Menampilkan MIN/USD.
- Menghitung estimasi TVL.
- Menghitung rekomendasi APY.
- Menampilkan reason kenapa rebalance perlu dilakukan.

### 9.2 On-Chain Reference Input

Dipakai untuk validator:

- Rebalance transaction harus attach Charli3 oracle UTxO.
- Validator mencari UTxO yang membawa asset `OracleFeed`.
- Validator decode datum oracle.
- Validator memastikan oracle masih fresh.
- Jika oracle hilang atau expired, transaction gagal.

Ini penting untuk hackathon karena membuktikan Charli3 bukan dekorasi UI, tapi bagian dari security condition on-chain.

---

## 10. Current MVP Status

BlueSense saat ini adalah MVP hackathon di Cardano Preprod.

Yang sudah ada secara konsep/kode:

- Aiken contracts untuk vault.
- ssADA minting policy.
- Inline datum untuk state vault.
- Deposit/withdraw/rebalance transaction builder.
- Charli3 oracle reference input untuk rebalance.
- Dashboard React.
- Wallet integration via Mesh/Eternl.
- Yield simulation flow.

Yang masih perlu dibereskan sebelum demo final:

- Deposit flow sedang dalam debug setelah beberapa redeploy.
- README masih perlu update address terbaru.
- Real allocation ke Liqwid/Minswap belum fully implemented.
- Strategy saat ini masih logical tag di datum, belum benar-benar memindahkan dana ke protokol eksternal.
- Error handling perlu dipoles supaya user tidak melihat raw Ogmios JSON.

Jadi klaim yang aman:

```text
BlueSense MVP demonstrates Cardano vault accounting, ssADA share token mechanics,
and on-chain Charli3 oracle verification for strategy rebalancing.
```

Klaim yang belum aman:

```text
BlueSense already allocates real ADA into Liqwid/Minswap production strategies.
```

---

## 11. Perbandingan Dengan Yearn Finance

### 11.1 Apa Itu Yearn Vault?

Yearn Finance adalah salah satu yield aggregator paling terkenal di Ethereum ecosystem.

Berdasarkan dokumentasi Yearn, vault mereka melakukan hal inti berikut:

- User deposit token ke vault.
- Vault mint share/LP token sebagai receipt.
- Vault mengelola dana dan mengirim surplus ke strategy.
- Strategy berinteraksi dengan protokol eksternal untuk menghasilkan yield.
- User withdraw dengan membakar share dan menerima underlying token.
- Keeper/harvest mechanism membantu claim rewards dan reinvest profit.

Sumber:

- Yearn homepage menyebut Yearn sebagai yield aggregator yang battle-tested dan vaults memanfaatkan peluang DeFi untuk risk-adjusted yields: <https://yearn.fi/?lang=en>
- Yearn Vaults Overview menjelaskan vault memproses deposit/withdraw, mint/burn receipt token, dan deposit dana ke strategy: <https://andrecronje.gitbook.io/yearn-finance/developers/yvaults-documentation/vaults-overview>
- Yearn deposit/withdraw docs menjelaskan share-based accounting dan pricePerShare: <https://deepwiki.com/yearn/yearn-vaults/3.1-deposit-and-withdrawal>

### 11.2 Apakah BlueSense Sama Dengan Yearn?

Jawaban singkat:

```text
Secara konsep vault accounting: mirip.
Secara maturity dan production scope: belum sama.
Secara chain dan oracle narrative: berbeda.
```

### 11.3 Persamaan BlueSense Dengan Yearn

| Area | Yearn | BlueSense |
|---|---|---|
| Vault model | User deposit token ke vault | User deposit ADA ke vault |
| Share token | User menerima yVault share token | User menerima ssADA |
| Share accounting | pricePerShare naik saat profit naik | pricePerShare naik saat total ADA naik |
| Withdraw | Burn share, receive underlying token | Burn ssADA, receive ADA |
| Strategy abstraction | Vault memakai strategy untuk yield | Vault punya strategy enum: NativeStaking, Liqwid, Minswap |
| Goal UX | User tidak perlu manage yield manual | User tidak perlu manage Cardano DeFi manual |

### 11.4 Perbedaan BlueSense Dengan Yearn

| Area | Yearn | BlueSense |
|---|---|---|
| Ecosystem | Ethereum/EVM dan beberapa ecosystem terkait | Cardano/UTxO |
| Main asset | Banyak token/vault | Fokus ADA vault |
| Contract model | Account-based smart contracts | Extended UTxO model |
| Strategy maturity | Production-grade strategies | MVP strategy logic |
| Harvesting | Keeper/strategist harvest profit | MVP simulate yield dan planned allocation |
| Oracle role | Tidak selalu menjadi pusat setiap vault decision | Charli3 adalah inti narasi rebalance |
| Governance | Yearn DAO/YFI/governance process | Hackathon MVP, belum DAO |
| Risk controls | Mature vault controls, withdrawal queue, strategy management | Minimal validator invariants |
| Fees | Yearn punya model fee/performance fee bergantung vault | MVP belum implement fee |

### 11.5 Analogi Perbandingan

Yearn:

```text
Seperti bank investasi DeFi yang sudah besar,
punya banyak produk,
punya banyak manajer strategi,
punya keeper,
punya governance,
dan sudah lama battle-tested.
```

BlueSense:

```text
Seperti prototype bank investasi otomatis khusus ADA,
dibangun untuk membuktikan bahwa vault + share token + oracle-based rebalancing
bisa dilakukan secara native di Cardano.
```

### 11.6 Positioning Yang Aman

Kalimat yang bagus:

```text
BlueSense brings a Yearn-style vault experience to Cardano,
with ssADA as the vault share token and Charli3 oracle reference inputs
as the on-chain decision layer for rebalancing.
```

Kalimat yang harus dihindari:

```text
BlueSense is already as mature as Yearn.
```

Lebih akurat:

```text
BlueSense is inspired by Yearn's vault model, but adapted to Cardano's UTxO architecture
and focused on oracle-verified strategy routing for ADA yield.
```

---

## 12. User End-to-End Journey

Bagian ini menjelaskan perjalanan user dari sebelum mengenal produk sampai selesai withdraw.

### 12.1 Before BlueSense

User punya ADA.

User berpikir:

```text
Saya mau yield, tapi tidak mau ribet masuk DeFi.
```

User mungkin cuma staking karena:

- Familiar.
- Aman.
- Tidak perlu monitor.
- Tidak perlu paham LP/lending.

Tapi user kehilangan potensi yield DeFi.

### 12.2 Discovery

User membuka BlueSense.

User melihat:

- ssADA vault.
- Est. APY.
- TVL.
- Active strategy.
- Charli3 oracle price.
- Wallet connect.

Pesan yang harus ditangkap user:

```text
Ini bukan DEX biasa.
Ini vault otomatis untuk ADA yield.
```

### 12.3 Connect Wallet

User connect Eternl.

System:

- Mendeteksi wallet.
- Membaca ADA balance.
- Membaca ssADA balance.
- Menyiapkan address untuk transaksi.

User expectation:

```text
Saya melihat saldo ADA saya dan bisa deposit.
```

### 12.4 Init Vault

Jika vault belum punya UTxO valid, user/admin perlu init vault.

Kenapa perlu init?

Cardano eUTxO model berbeda dari Ethereum. State contract hidup di UTxO. Vault butuh satu UTxO awal dengan inline datum untuk menjadi "state awal".

Analogi:

```text
Sebelum bank bisa menerima setoran, rekening cabang harus dibuka dulu.
Init Vault = membuka rekening cabang vault di chain.
```

Init membuat:

- UTxO di vault address.
- Inline datum awal.
- Total ADA awal.
- Total ssADA awal = 0.
- Strategy awal.
- ssADA policy ID valid.

### 12.5 Deposit

User deposit ADA.

System:

- Spend vault UTxO lama.
- Create vault UTxO baru.
- Mint ssADA.
- Update datum.

User result:

- ADA wallet berkurang.
- ssADA wallet bertambah.
- Vault TVL naik.

Analogi:

```text
User setor uang ke koperasi.
Koperasi memberi sertifikat kepemilikan.
Sertifikat itu bisa ditebus nanti sesuai nilai koperasi saat itu.
```

### 12.6 Holding Period

User memegang ssADA.

User tidak perlu melakukan apa-apa.

Yang terjadi:

- Vault bisa rebalance.
- Vault bisa menghasilkan yield.
- pricePerShare bisa naik.

User result:

```text
ssADA tetap jumlahnya,
tapi nilai klaimnya terhadap ADA vault naik.
```

### 12.7 Rebalance

Rebalance bisa dipicu permissionlessly.

System:

- Membaca oracle.
- Mengecek freshness.
- Mengubah strategy aktif.

User benefit:

```text
User tidak perlu memilih sendiri antara Native Staking, Liqwid, dan Minswap.
```

### 12.8 Withdraw

User burn ssADA.

System:

- Hitung nilai ssADA berdasarkan total ADA/total ssADA.
- Burn ssADA.
- Kirim ADA ke user.
- Update vault datum.

User result:

```text
User mendapat ADA kembali.
Jika vault profit, ADA yang diterima bisa lebih besar dari deposit awal.
```

---

## 13. Demo Story Untuk Juri

Script narasi:

```text
Cardano punya banyak ADA staker, tapi mayoritas hanya menerima native staking yield.
DeFi yield lebih tinggi, tetapi UX-nya rumit.

BlueSense adalah Yearn-style ADA vault.
User deposit ADA sekali dan menerima ssADA sebagai share token.

Di belakang layar, vault memilih strategi yield berdasarkan oracle data.
Charli3 bukan hanya price display. Pada rebalance transaction, oracle UTxO harus hadir sebagai reference_input.
Jika oracle tidak fresh atau tidak ada, validator menolak transaksi.

Kami juga menunjukkan pricePerShare naik melalui yield simulation:
total ADA vault naik, total ssADA tetap, sehingga nilai ssADA naik.

Saat withdraw, user burn ssADA dan menerima ADA sesuai share value terbaru.
```

Demo sequence:

```text
1. Connect wallet.
2. Show Charli3 oracle price panel.
3. Init vault jika perlu.
4. Deposit ADA.
5. Show ssADA minted.
6. Force rebalance.
7. Open Cardanoscan and show reference input.
8. Simulate yield.
9. Show pricePerShare naik.
10. Withdraw.
```

---

## 14. Risiko Produk

BlueSense punya beberapa risiko yang perlu jujur disebut.

### 14.1 Smart Contract Risk

Kalau validator salah, deposit/withdraw bisa gagal atau accounting bisa salah.

Mitigasi:

- Audit.
- Unit test Aiken.
- End-to-end test di Preprod.
- Limit MVP scope.

### 14.2 Oracle Risk

Kalau oracle stale atau tidak tersedia, rebalance bisa gagal.

Mitigasi:

- Freshness check.
- Fallback strategy.
- Clear UI warning.

### 14.3 Strategy Risk

Minswap LP membawa risiko impermanent loss.

Liqwid lending membawa risiko protocol/smart-contract.

Mitigasi:

- Risk label per strategy.
- Conservative default.
- Threshold rebalance.
- Limit allocation.

### 14.4 UTxO Complexity

Cardano UTxO model membuat state management lebih eksplisit. Vault state harus hidup di UTxO, dan setiap update harus consume old UTxO lalu create new UTxO.

Mitigasi:

- Good UTxO selection.
- Clear init flow.
- Better indexing/polling UX.
- Avoid multiple conflicting vault UTxOs.

---

## 15. Kenapa BlueSense Menarik Untuk Charli3 Hackathon

Karena BlueSense memberi use case oracle yang konkret.

Banyak project memakai oracle hanya untuk menampilkan harga.

BlueSense memakai oracle sebagai syarat validasi:

```text
No fresh oracle reference input -> no rebalance.
```

Ini membuat Charli3 menjadi:

- Data provider.
- Decision engine.
- On-chain security dependency.
- Bagian yang bisa diverifikasi di explorer.

Narasi yang kuat:

```text
Every rebalancing decision starts from an oracle pull.
Charli3 is the heart of BlueSense, not decoration.
```

---

## 16. Roadmap

### Phase 1: Hackathon MVP

- Vault deposit/withdraw.
- ssADA mint/burn.
- Charli3 reference input verification.
- Rebalance demo.
- Simulate yield.
- Dashboard.

### Phase 2: Real Strategy Allocation

- Integrasi Minswap LP.
- Integrasi Liqwid lending.
- Track LP token/value.
- Strategy allocation UI.

### Phase 3: Production Hardening

- Audit.
- Emergency pause.
- Fee model.
- Better withdrawal queue.
- Multi-strategy risk controls.
- Better oracle fallback.

### Phase 4: Mainnet/Product

- Mainnet deployment.
- More vaults.
- Stablecoin vault.
- Risk-adjusted strategy optimizer.
- DAO/governance.

---

## 17. One-Liner Pitch

```text
BlueSense is a Yearn-style ADA vault on Cardano that turns complex DeFi yield strategies into a single ssADA position, using Charli3 oracle reference inputs to verify rebalancing decisions on-chain.
```

Versi Indonesia:

```text
BlueSense adalah vault ADA bergaya Yearn di Cardano: user cukup deposit ADA, menerima ssADA, lalu vault mengoptimalkan yield secara otomatis dengan keputusan rebalancing yang diverifikasi oleh Charli3 oracle on-chain.
```

---

## 18. Super Simple Explanation

Kalau harus jelasin ke orang non-crypto:

```text
BlueSense itu seperti rekening tabungan pintar untuk ADA.
Kamu setor ADA, dapat bukti kepemilikan bernama ssADA.
Sistem otomatis mencari tempat terbaik untuk menghasilkan yield.
Data keputusan diambil dari oracle Charli3.
Kalau vault untung, nilai ssADA naik.
Saat kamu keluar, ssADA ditukar kembali menjadi ADA sesuai nilai terbaru.
```

Kalau harus jelasin ke crypto user:

```text
BlueSense is a Cardano-native yield aggregator vault.
It uses share-based accounting like Yearn vaults, mints ssADA as the vault share token,
and uses Charli3 oracle reference inputs to validate strategy rebalancing on-chain.
```

Kalau harus jelasin ke juri hackathon:

```text
BlueSense demonstrates a Cardano eUTxO vault with ssADA share accounting and on-chain oracle-verified rebalancing.
The key innovation is making Charli3 a required reference input for rebalance transactions, turning oracle data into a validator-enforced decision layer.
```

---

## 19. Sources

- BlueSense PRD: `prd.md`
- BlueSense README: `README.md`
- BlueSense handoff context: `HANDOFF_CONTEXT.md`
- Yearn homepage: <https://yearn.fi/?lang=en>
- Yearn Vaults Overview: <https://andrecronje.gitbook.io/yearn-finance/developers/yvaults-documentation/vaults-overview>
- Yearn deposit/withdraw explanation: <https://deepwiki.com/yearn/yearn-vaults/3.1-deposit-and-withdrawal>

