## PRODUCT REQUIREMENTS DOCUMENT

# Smart Stake Router

_Cardano's Intelligent Yield Router_
Powered by Charli3 Pull Oracle
Hackathon
**Charli3 Oracles Hackathon 2026**
Tanggal
**April 16–19, 2026**
Track
**DeFi Applications & Integrations**
Status
**MVP — Hackathon Build**
_"Deposit ADA sekali. Smart Stake Router yang bekerja — otomatis memilih strategi yield terbaik
antara native staking, Liqwid lending, dan Minswap LP, diperkuat Charli3 Pull Oracle."_


**1. Ringkasan Eksekutif**
Smart Stake Router adalah protokol vault DeFi berbasis Cardano yang mengotomasi alokasi
yield untuk ADA holder. Alih-alih hanya staking biasa yang menghasilkan 3–5% APY, vault ini
secara otomatis membandingkan dan memilih strategi terbaik antara native staking, Liqwid
lending, dan Minswap LP farming — semuanya digerakkan oleh Charli3 Pull Oracle sebagai
decision engine.
Pengguna cukup deposit ADA sekali, mendapatkan ssADA (Smart Stake ADA) sebagai share
token, dan membiarkan vault bekerja. Nilai ssADA tumbuh otomatis seiring yield yang
dikumpulkan, tanpa perlu interaksi manual.
    **1.3 juta**
ADA holder staking saat
ini
**3–5%**
APY staking biasa
**10–40%**
Potensi APY via DeFi
**0**
Dedicated yield
aggregator di Cardano
**2. Problem Statement**
Cardano memiliki lebih dari 1.3 juta pengguna yang secara aktif meng-stake ADA mereka. Ini
menunjukkan bahwa base user sudah ada dan secara mental siap untuk passive income.
Namun terdapat kesenjangan besar antara yield yang mereka dapatkan dan yang tersedia di
ekosistem DeFi Cardano.
**2.1 Core Pain Point**
    **Kontradiksi yang tidak terjembatani**
    1.3 juta ADA holder mendapat 3–5% APY dari native staking. Di sisi lain, Liqwid lending menawarkan
    8–15% dan Minswap LP farming menawarkan 20–40%. Gap ini nyata dan besar — tetapi tidak ada
    produk yang menjembatani keduanya secara simpel untuk user biasa.
**2.2 Mengapa User Tidak Pindah ke DeFi?**
    - Kompleksitas teknis: LP farming, impermanent loss, collateral ratio — semua terasa asing
       bagi holder biasa
    - Monitoring manual: APY di protokol DeFi berubah-ubah setiap hari, user harus pantau dan
       pindah sendiri
    - Fragmentasi: dana harus dibagi ke Minswap, SundaeSwap, Liqwid secara terpisah,
       masing-masing punya interface sendiri
    - Tidak ada fallback otomatis: jika satu protokol mengalami masalah, tidak ada mekanisme
       perlindungan otomatis


**2.3 Data Pendukung**
Berdasarkan data on-chain Cardano per April 2026: total DeFi TVL Cardano berkisar $124–
juta, tetapi hanya sekitar 12.000 alamat aktif per hari yang berinteraksi dengan DeFi. Ini
mengindikasikan bahwa sebagian besar ADA holder tahu DeFi ada, tetapi tidak memakainya —
bukan karena tidak mau, melainkan karena barrier masuknya terlalu tinggi.

**3. Solusi: Smart Stake Router**
Smart Stake Router memposisikan diri sebagai lapisan abstraksi antara user dan kompleksitas
DeFi Cardano. Dari sisi user, produk ini terasa seperti staking biasa. Di baliknya, vault contract
yang digerakkan Charli3 oracle yang mengelola semuanya.
**3.1 Proposisi Nilai Utama**
    **Bagi User**
    Deposit ADA → dapat ssADA → yield tumbuh otomatis. Sesimpel staking, seoptimal DeFi.
    **Bagi Ekosistem Cardano**
    Mendorong adopsi DeFi dari basis 1.3 juta staker yang selama ini tidak tersentuh oleh protokol DeFi
    tradisional.
    **Bagi Charli**
    Demonstrasi konkret pull oracle sebagai decision engine, bukan sekadar display harga. Setiap
    rebalancing adalah oracle call yang nyata dan terdokumentasi.
**3.2 Cara Kerja (User Flow)**
    1. **User deposit ADA ke Smart Stake Router vault contract**
    2. Vault mint ssADA (Smart Stake ADA) proporsional sebagai bukti kepemilikan share
    3. Charli3 oracle pull harga ADA, MIN, qADA untuk menghitung APY aktual tiap protokol
    4. Router logic memilih strategi terbaik: native staking (3–5%), Liqwid lending (8–15%), atau
       Minswap LP (20–40%)
    5. Jika delta APY antar protokol melebihi threshold 5%, rebalancing otomatis dipicu oleh
       oracle
    6. Nilai ssADA naik seiring waktu; user bisa withdraw kapan saja dan menerima ADA + yield


**4. Peran Charli3 Oracle**
Charli3 bukan sekadar komponen tambahan — Charli3 adalah decision engine inti dari produk
ini. Tanpa oracle, Smart Stake Router tidak dapat beroperasi. Berikut tiga titik kritis penggunaan
oracle:
    **Peran Oracle Data yang dibutuhkan Kenapa kritis
Yield Comparator** Harga ADA/USD, MIN/USD,
qADA/USD real-time
Tanpa harga akurat, perbandingan
APY antar protokol menjadi asumsi
yang bisa dimanipulasi
**Rebalancing Trigger** Delta APY antar protokol setiap
epoch
Pull oracle Charli3 dipanggil
on-demand saat vault perlu
keputusan — efisien, tidak buang
fee
**NAV Calculator** Total value semua underlying
asset dalam vault
Harga ssADA share token harus
akurat untuk deposit dan withdrawal
yang fair
**Kenapa Pull Oracle, bukan Push Oracle?**
Push oracle mengirim harga setiap N detik terlepas ada yang butuh atau tidak — mahal dan boros.
Pull oracle Charli3 hanya dipanggil saat vault memerlukan data, yaitu saat akan rebalancing atau
menghitung NAV. Ini membuat biaya operasional vault jauh lebih efisien, terutama untuk vault yang
tidak rebalancing setiap saat.
**5. Spesifikasi Fungsional
5.1 Vault Contract (Core)**
    - Menerima deposit ADA dari user
    - Mint ssADA share token proporsional dengan total vault assets saat deposit
    - Menyimpan accounting: totalAssets, totalShares, pricePerShare
    - Memungkinkan withdrawal kapan saja: redeem ssADA, terima ADA + yield
    - Emergency pause mechanism jika oracle tidak responsif
**5.2 Router Logic**
    - Pull harga dari Charli3 oracle untuk ADA/USD, MIN/USD
    - Estimasi APY tiap strategi berdasarkan data on-chain dan oracle feed
    - Bandingkan APY ketiga strategi: native staking, Liqwid, Minswap LP
    - Trigger rebalancing jika delta APY antar strategi terbaik vs aktif > 5%
    - Fallback ke native staking jika oracle tidak responsif atau DeFi protokol tidak tersedia


**5.3 Strategi yang Didukung (MVP)**

- **Strategi A — Native Staking: Stake ADA ke pool pilihan. APY 3–5%. Risiko sangat**
    **rendah. Default fallback.**
- **Strategi B — Liqwid Lending: Supply ADA ke Liqwid sebagai lender. APY 8–15%.**
    **Risiko rendah-menengah. Tidak ada impermanent loss.**
- **Strategi C — Minswap LP (Roadmap): Provide liquidity di pair ADA/MIN. APY**
    **20–40%. Risiko lebih tinggi karena impermanent loss.
5.4 Share Token: ssADA**
ssADA (Smart Stake ADA) adalah token Cardano native yang merepresentasikan kepemilikan
proporsi dalam vault. Nilainya dihitung sebagai:
pricePerShare = totalAssets (dalam ADA) ÷ totalSupply ssADA
Nilai pricePerShare naik seiring waktu ketika vault mengumpulkan yield. User yang memegang
ssADA lebih lama mendapat lebih banyak yield.
**6. Skenario Demo Hackathon**
Skenario berikut dirancang untuk mendemonstrasikan seluruh alur kerja Smart Stake Router
kepada juri dalam waktu 5 menit:
7. **Deposit:** User deposit 100 ADA ke vault. Vault mint 100 ssADA (pricePerShare = 1.
ADA/ssADA).
8. **Oracle Pull:** Charli3 oracle dipanggil — harga ADA/USD dan MIN/USD masuk on-chain.
9. **Strategi Aktif:** Router memilih Liqwid lending (APY 12%) sebagai strategi terbaik saat ini.
10. **Simulasi Waktu:** Yield accumulate. totalAssets vault naik menjadi 102.5 ADA.
pricePerShare = 1.025.
11. **Rebalancing:** APY Minswap tiba-tiba naik ke 20%. Delta > 5% threshold. Oracle
trigger rebalancing otomatis ke Minswap.
12. **Withdraw:** User redeem 100 ssADA → menerima 102.5 ADA. Gain 2.5 ADA tanpa
kerja manual.
**Pesan kunci untuk juri**
Tunjukkan bahwa setiap keputusan rebalancing dimulai dari oracle pull — bukan hardcoded. Charli
adalah jantung produk ini, bukan dekorasi.
**7. Perbandingan dengan Solusi yang Ada**


**Fitur Manual DeFi Spectrum Finance Smart Stake Router
Auto-compound** Tidak Sebagian **Ya
Multi-protokol** Tidak Terbatas **Ya (2 MVP)
Oracle-powered** Tidak Tidak **Ya (Charli3)
Auto-rebalancing** Tidak Tidak **Ya
UX simpel** Tidak Tidak **Ya
Cardano-native** N/A Ya **Ya**
Smart Stake Router adalah satu-satunya solusi di Cardano yang menggabungkan
auto-compounding, multi-protokol yield routing, dan oracle-powered rebalancing dalam satu
produk dengan UX yang sesimpel staking biasa.

**8. Rencana Build Hackathon (3 Hari)
Hari 1 — Kickoff: Fondasi Vault + Oracle**
    - Setup project Aiken dan integrasi Charli3 Dendrite SDK
    - Implementasi vault contract dasar: deposit ADA, mint ssADA
    - Proof-of-concept oracle pull: fetch harga ADA/USD dan MIN/USD dari Charli3 on-chain
    - Mock strategy selector dengan APY simulasi untuk validasi logika pemilihan
**Hari 2 — Core Logic: Router + Rebalancing**
    - Router logic: pull harga real dari Charli3, hitung APY aktual tiap protokol
    - Implementasi rebalancing trigger dengan threshold delta APY 5%
    - NAV calculation: totalAssets menggunakan harga oracle, update pricePerShare
    - Withdrawal contract: redeem ssADA, hitung jumlah ADA yang diterima
**Hari 3 — Demo: Frontend + Polish**
    - Frontend minimal: halaman deposit, dashboard APY, strategi aktif, nilai ssADA
    - Demo scenario end-to-end sesuai Section 6
    - Rekam video demo untuk submission
    - README dan dokumentasi teknis Charli3 integration
**Scope MVP yang realistis**


```
Vault fungsional + oracle price feed nyata + satu siklus demo rebalancing yang dapat
didemonstrasikan. Strategi Minswap LP dapat dijadikan roadmap item jika waktu tidak cukup. Dua
strategi (native staking + Liqwid) sudah cukup untuk memenangkan hackathon.
```
**9. Tech Stack**
    **Layer Teknologi**
    **Smart Contract** Aiken (Cardano native language, lebih ergonomis dari Plutus)
    **Oracle Integration** Charli3 Dendrite SDK (pull-based price feeds)
    **Frontend** React + TypeScript
    **Wallet Integration** Mesh SDK / Lucid
    **Testing Network** Cardano Preprod Testnet
    **Version Control** GitHub (adianvel)
**10. Risiko dan Mitigasi**
    **Risiko Level Mitigasi**
    Waktu 3 hari terlalu singkat
    untuk full stack
       **Tinggi** Batasi scope MVP: vault + 2
          strategi + oracle demo. Minswap
          LP jadi roadmap.
    Oracle tidak responsif saat
    demo
       **Menengah** Fallback ke native staking
          otomatis. Siapkan mock oracle
          untuk backup demo.
    Kompleksitas Aiken untuk fitur
    baru
       **Menengah** Mulai dari starter repo Charli3.
          Fokus pada vault logic, bukan
          optimasi.
    Impermanent loss di Minswap
    LP
       **Rendah (MVP)** Tidak dimasukkan ke MVP. Hanya
          native staking + Liqwid lending
          untuk hackathon.
**11. Roadmap Pasca Hackathon
Fase 1 — Hackathon MVP (April 16–19, 2026)**
    - 1 vault ADA dengan 2 strategi aktif (native staking + Liqwid lending)
    - Charli3 oracle integration untuk yield comparison dan rebalancing trigger
    - Frontend minimal: deposit, dashboard, withdraw
    - Demo video dan dokumentasi submission


**Fase 2 — Product Polish (Mei 2026)**

- Tambah strategi Minswap LP farming
- Stablecoin vault (DJED/SHEN) untuk profil risiko konservatif
- UI analytics dashboard: APY history, total yield earned, strategi performance
- Deploy ke Cardano Preprod testnet, community beta
**Fase 3 — Mainnet (Juni 2026)**
- Deploy ke Cardano mainnet setelah full security audit
- Emergency pause mechanism dan timelock pada perubahan strategi
- Aplikasi Catalyst funding (budget 70 juta ADA tersedia)
- Partnership dengan Minswap dan Liqwid untuk co-marketing
**Fase 4 — Scale (Q3–Q4 2026)**
- Dynamic allocation: auto-switch antara 5+ strategi per vault
- B2B: embed Smart Stake Router vaults ke UI Minswap dan Liqwid
- Governance token $SSR launch
- Target: 2.000+ depositor, $50M TVL
**12. Kriteria Sukses Hackathon
Must-have (wajib ada untuk submission)**
1. Vault contract yang bisa menerima deposit dan mengeluarkan ssADA.2. Charli3 oracle pull yang
berfungsi dan terverifikasi on-chain.3. Demo rebalancing yang dapat didemonstrasikan secara live.4.
Video demo yang menjelaskan pain point dan solusi.
**Nice-to-have (menambah nilai)**
1. Frontend yang bisa dipakai secara langsung oleh juri.2. Dua strategi aktif yang benar-benar
mengalokasikan ke protokol.3. Dokumentasi teknis yang menjelaskan arsitektur Charli3 integration.
**Out of scope (tidak dibangun untuk hackathon)**
Security audit, Minswap LP farming (impermanent loss kompleks), governance token, mobile app,
mainnet deployment.


- Smart Stake Router — PRD v1.0 | Charli3 Oracles Hackathon 2026 | April 11,


