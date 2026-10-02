# Status Proyek — Pharmacy 3D Simulator

_Terakhir diperbarui: 2026-10-03 (fase kualitas kendaraan & konsistensi visual kawasan selesai)_

## Ringkasan

Semua milestone M0–M8 telah diimplementasikan dan diuji. Game dapat dimainkan dari menu utama hingga beberapa hari operasional dalam tiga mode, dengan simpan/muat. Rincian hasil uji: [TESTING.md](TESTING.md).

## Milestone

| Milestone | Status | Catatan |
|---|---|---|
| M0 Audit & fondasi | ✅ Selesai | Repo awalnya kosong. Vite + React 19 + TS, Tailwind 4, ESLint, Vitest, Playwright, struktur berlapis. |
| M1 Dunia 3D & kontrol | ✅ Selesai | Apotek lengkap + jalan & eksterior + 4 ruang perluasan; FPS/TPS; tombol dapat diubah; tabrakan AABB; raycast + sorotan + dinding sebagai penghalang; pintu animasi; pintu otomatis. |
| M2 Pasien & pelayanan | ✅ Selesai | 7 kategori pasien, antrean berkapasitas, kesabaran, dialog kontekstual (+AI opsional), tanggapan akhir pasien, wizard resep 5 langkah, masalah resep, label + cetak. |
| M3 Obat & inventaris | ✅ Selesai | 38 produk (contoh simulasi), batch, lokasi, FEFO + alasan, kedaluwarsa, karantina, musnah, opname, pindah, kapasitas, riwayat, dasbor. |
| M4 Kasir & pengadaan | ✅ Selesai | 3 metode bayar simulasi, promo, batal, anti ganda; 4 pemasok, status pengiriman, refund, rekomendasi; buku besar & laporan. |
| M5 Lab & pegawai | ✅ Selesai | 3 racikan latihan dengan mini-game; 5 peran pegawai berotomatisasi, energi, shift, gaji, level. |
| M6 Progres | ✅ Selesai | 13 peningkatan/perluasan berefek nyata & tampil di 3D, 19 misi, 7 event, reputasi, 18 pencapaian, fitur terbuka per level. |
| M7 Mode & penyimpanan | ✅ Selesai | Karier/Pembelajaran (6 pelajaran)/Tantangan (5); IndexedDB 3 slot + autosave + ekspor/impor; Zod; migrasi; pengaturan lengkap. |
| M8 Integrasi & penyempurnaan | ✅ Selesai | Audio prosedural, animasi NPC/pintu/kas, keseimbangan tempo, dokumentasi, uji lengkap. |

## Fase kualitas kendaraan & konsistensi visual kawasan (2026-10-02) — SELESAI

Tujuan: kendaraan dan bangunan di sekitar apotek berada dalam satu gaya semi-realistis yang konsisten dengan apotek dan avatar. Alur kerja: Audit → Temuan → Prioritas → Implementasi → Pengujian → Dokumentasi. Identitas apotek, gaya karakter, gameplay, dan sistem gerak kendaraan tidak diubah.

### Temuan audit

Sumber: pembacaan `vehicleModels.ts`, `streetModels.ts`, `DistrictVehicles.tsx`, `traffic.ts`, `Exterior.tsx`, `materials.ts`, dan tangkapan layar GPU asli (profil Tinggi). Kendaraan bergerak ditangkap saat melintas lewat registri `__pharmacyDebug.district()`. Temuan K7–K10 baru terlihat saat pengujian (unit test ukuran & tangkapan layar).

| # | Temuan | Dampak | Status |
|---|---|---|---|
| K1 | **Mobil** dibuat dari profil samping yang dihaluskan Catmull-Rom tertutup. Hasilnya bodi "kapsul": tanpa lengkung roda, tanpa kap/bagasi yang jelas, roda hampir tertutup bodi. Kaca berupa satu gumpalan gelap dan pilar B hanya strip putih. | Terbaca sebagai mainan/placeholder | ✅ Model baru |
| K2 | **Angkot** (satu-satunya "bus" di game) berupa kotak ekstrusi dengan jendela & pintu sebagai pelat datar. | Terbaca sebagai kotak beroda | ✅ Model baru |
| K3 | **Mobil boks PBF**: dari depan kabin berupa baji putih rata. Kaca depan & lampu tertutup bevel bodi, jadi tidak terlihat (bug model). | Placeholder, salah bentuk | ✅ Model baru |
| K4 | **Motor** (parkir & karyawan): ban torus tanpa tapak, velg sederhana, bodi satu warna yang menggembung di depan. Tidak ada motor yang bergerak di jalan. | Kualitas di bawah mobil target | ✅ Model baru · motor melaju belum ada |
| K5 | **Roda kendaraan tidak berputar**, tidak ada pengemudi, dan van tidak membelokkan roda depan. | Kendaraan tampak "meluncur" | ✅ Roda berputar & belok · pengemudi tidak ditambahkan (lihat keterbatasan) |
| K6 | **Tanpa bayangan kontak**: di profil Rendah/Sedang (tanpa bayangan matahari) kendaraan tampak melayang. Cat tanpa clearcoat; kaca kendaraan sama dengan kaca jendela gedung. | Tidak menyatu dengan jalan | ✅ |
| K7 | Panjang keseluruhan model (dengan bemper & pelat) 7–17 cm lebih panjang daripada panjang yang dipakai logika lalu lintas; **collider van parkir ±9 cm lebih pendek** di tiap ujung. | Jarak antre & collider tidak sesuai visual; avatar bisa menembus bemper van | ✅ Konstanta disamakan & diuji |
| K8 | Ambang bawah MPV/hatchback setinggi as roda (0,31–0,32 m); mobil nyata ±0,17–0,25 m. | Mobil tampak "berkaki"/melayang | ✅ Diturunkan ke 0,25/0,22 m |
| K9 | Velg mobil 3.672 segitiga: busur lubang palang memakai jumlah titik lingkaran penuh. | Segitiga roda lalu lintas boros | ✅ 792 segitiga |
| K10 | Collider motor parkir ±0,22 m, padahal setang ±0,35 m. Lampu motor parkir memakai bahan emisif sehingga menyala saat malam. | Avatar bisa menembus setang; motor parkir tampak menyala | ✅ |
| B1 | **Semua ruko satu model** (`shopModel`) dengan parameter warna/lantai/atap; struktur fasadnya identik (pilaster, lis, rangka papan, kanopi, jendela kotak gelap). | Terlihat duplikasi ganti warna | ✅ 6 arketipe |
| B2 | **Semua kios satu isi**: rak berisi balok warna polos. Warung makan memakai rak barang yang sama + cakram warna sebagai "lauk". | Mainan, tidak meyakinkan | ✅ Isi per jenis usaha |
| B3 | Fasad datar tanpa ciri ruko Indonesia (pintu harmonika, pintu lipat kayu, jendela nako, roster, batu alam/bata ekspos, keramik pilar, papan nama bercetak). Apotek jauh lebih detail. | Gaya grafis berbeda dari apotek | ✅ |
| B4 | Material fasad hanya plester (satu tekstur, beda tint). Seng atap & kanopi berupa warna rata. Latar di luar gerbang berupa kotak polos. | Datar, kurang kedalaman | ✅ 4 tekstur CC0 baru, ruko latar bergaya |

### Rencana (prioritas)

| Prioritas | Pekerjaan | Status |
|---|---|---|
| V1 Kendaraan | Model baru buatan sendiri: MPV & hatchback, angkot, mobil boks, roda realistis, motor matik; cat clearcoat & kaca kendaraan | ✅ Selesai & diuji |
| V2 Animasi kendaraan | Roda berputar sesuai jarak tempuh (instanced), roda depan van berbelok, bayangan kontak di semua profil. Pengemudi/penumpang: **tidak dikerjakan** (kaca film gelap, lihat keterbatasan) | ✅ Selesai (kecuali pengemudi) |
| V3 Bangunan | 6 arketipe fasad, isi kios per jenis usaha dari atlas barang, papan nama dua baris, 4 tekstur CC0 baru, ruko latar bergaya | ✅ Selesai & diuji |
| V4 Integrasi | Proporsi terhadap avatar, lebar lajur, parkir, bayangan, jarak pandang, collider | ✅ Selesai & diuji |
| V5 Pengujian & performa | Unit, E2E, tangkapan layar GPU, benchmark A/B | ✅ Selesai |
| V6 Dokumentasi | PROJECT_STATUS, ART_DIRECTION §9a/§10/§13, ARCHITECTURE, TESTING, ASSET_CREDITS | ✅ Selesai |

### Hasil implementasi

Berkas yang diubah/dibuat:
- `src/game/world/wheelModels.ts` (baru): roda bersama semua kendaraan: ban lathe (dinding samping cembung, bahu, alur tapak), velg alloy berpalang dengan lubang sungguhan, cakram & kaliper, tutup tengah; parameter `detail` (LOD) dan tekstur bayangan kontak.
- `src/game/world/vehicleModels.ts` (ditulis ulang): MPV, hatchback, angkot, mobil boks; tekstur pelat nomor fiktif & papan trayek.
- `src/game/world/DistrictVehicles.tsx`: bodi lalu lintas instanced per jenis (semua material bodi satu jenis berbagi **satu** buffer matriks), 3 `InstancedMesh` roda untuk semua lalu lintas (juga satu buffer matriks; putaran per kendaraan dari jarak tempuh; detail roda 0,55), bayangan kontak instanced, van dengan roda berputar & berbelok, showroom kendaraan khusus mode dev (`localStorage pharmacy3d.debugShowroom = 1`, tanpa tombol di UI).
- `src/game/world/traffic.ts`: odometer & sudut belok roda van (model sepeda); `TRAFFIC_HALF` & `VAN_HALF` sama dengan panjang model.
- `src/game/world/streetModels.ts`: motor matik baru (`scooterModel`, tanda tangan fungsi tetap).
- `src/game/world/shopModels.ts` (baru): arketipe fasad, kanopi, pintu, papan nama, isi kios/warung/bengkel/kafe, atlas barang kanvas, LOD ruko latar. Fungsi ruko lama di `Exterior.tsx` dihapus.
- `src/game/world/district.ts`: gaya & baris layanan per ruko, toko pakaian (F7), 16 ruko latar, collider motor ±0,35 m & van 5,2 m.
- `src/game/world/Exterior.tsx`, `SignAtlas.tsx`: ruko lewat `shopModels`, papan nama dua baris (nama + layanan) dengan kerapatan piksel per papan, material malam (lampu kendaraan menyala, pantulan kaca/cat/velg diredam), urutan gambar `LATE_DRAW` (tanah, jalan, trotoar, lantai gang, dinding fasad digambar setelah detail di depannya).
- `src/game/visual/Built.tsx`: `renderOrder` per material (opsional) untuk `BuiltMeshes`.
- `src/game/world/materials.ts`: `carPaint`/`vanPaint` (MeshPhysicalMaterial clearcoat), `carGlass`, `carTrim`, `carInterior`, `tireRubber`, `rimAlloy`, `carLamp`, `amberLens`, `carPlate`, `plateYellow`, `angkotSign`, `goodsAtlas`, dan bahan foto `brickWall`, `stoneClad`, `zincSheet`, `woodPlank`, `ceramicWall`.
- `scripts/assets/textures.mjs` + manifest + `public/assets/textures/{brick,stone,corrugated,planks}/`; `ASSET_CREDITS.md` dibuat ulang.
- `src/tests/unit/vehicles.test.ts` (baru, 9 tes).

| Area | Hasil |
|---|---|
| Mobil (MPV 4,5 m, hatchback 3,8 m) | Siluet dengan lengkung roda sungguhan, kap & atap melengkung halus, denah membulat, kabin menyempit ke atas. Kabin kaca gelap berpilar A/B/C/D, atap berwarna bodi, lis krom, garis pintu yang mengitari lengkung roda, gagang, garis karakter, ambang hitam. Lampu depan berumah gelap dengan dua proyektor krom & DRL, sein, lampu belakang vertikal, lampu kabut, gril berlis krom, emblem generik, spion, rel atap (MPV), knalpot, antena, spoiler. Ambang 0,25/0,22 m. Cat clearcoat; warna dari palet jalanan Indonesia. |
| Angkot ("bus" kawasan) | Minibus kabin di atas roda depan, kaca depan besar, jendela berbingkai, pintu geser terbuka di sisi trotoar (lubang gelap, anak tangga, pegangan), lis putih, bemper krom, rak atap, papan trayek "05 MELATI – TERMINAL", pelat kuning, pelindung lumpur. Bus besar sengaja tidak ditambahkan: tidak lazim di jalan ruko 2 lajur. |
| Mobil boks PBF | Kabin cab-over dengan kaca depan, gril, lampu persegi, spion bertangkai; bak aluminium bergelombang berbingkai, pintu belakang dua daun dengan palang pengunci, bemper berlampu, sasis, tangki. Roda berputar maju/mundur sesuai odometer; roda depan berbelok (maks. 0,6 rad) saat masuk/keluar gang. |
| Roda & animasi lalu lintas | Ban berprofil + velg palang lima berlubang + cakram/kaliper di semua kendaraan. Putaran roda = jarak tempuh / jari-jari, arahnya mengikuti arah gerak; roda kiri/kanan dicerminkan agar velg menghadap keluar. Sistem gerak (lajur, jaga jarak, zebra, halte, portal) tidak diubah. |
| Motor matik | Cover depan V dengan topeng gelap & lampu, pelindung kaki dalam hitam, batok setang + spidometer, bodi belakang meruncing berstiker garis, cover bawah hitam, jok dua tingkat, begel, spakbor depan & belakang, garpu teleskopik, bak CVT + sokbreker (kiri), knalpot berpelindung panas (kanan), standar tengah, spion oval, sein, pelat hitam. 5.268 segitiga (sebelumnya 5.292). Lampu tidak menyala saat parkir malam. |
| Bangunan | 6 arketipe fasad (`modern`, `klasik`, `bata`, `warung`, `bengkel`, `bangunan`, lihat ART_DIRECTION §9a) dengan bahan, pintu (harmonika, lipat kayu, rolling door), jendela (pita, nako, berbingkai putih), roster, balkon besi, kanopi (beton, seng, kain bergaris, terpal) yang berbeda. 16 ruko kawasan: kelontong, laundry, fotokopi, konter pulsa, toko bangunan, rumah makan Padang, bengkel, toko roti, salon, toko emas, toko sepatu, kedai kopi, percetakan, **toko pakaian** (siluet kemeja bergantung), warung makan, toko mainan & ATK. Isi kios dari atlas barang (kemasan generik tanpa merek nyata, renteng sachet, kain/batik, makanan); piring lauk Padang disusun bertingkat; tumpukan ban berprofil. Papan nama dua baris. 16 ruko latar di luar gerbang memakai gaya yang sama (LOD 1). Apotek tidak diubah. |
| Integrasi | Kendaraan berdiri tepat di jalan (dasar ban y = 0, diuji); lebar bodi 1,66–1,84 m di lajur 3,5 m; tinggi MPV 1,79 m (dengan rel atap), hatchback 1,59 m, angkot 2,2 m (dengan rak & papan trayek), motor 1,25 m (puncak spion) dibanding avatar perempuan ±1,55–1,65 m dan laki-laki ±1,64–1,76 m; motor 1,9 m di petak parkir selebar 0,9 m. Bayangan kontak di semua profil. Collider = visual (motor ±0,35 × ±0,95 m, van 1,9 × 5,2 m). Kendaraan muncul/hilang jauh di balik gerbang. |

### Aset

- **Baru (ambientCG, CC0 1.0, lewat pipeline):** `Bricks101` (bata ekspos), `Tiles143` (batu alam tempel), `CorrugatedSteel005` (seng gelombang), `Planks037A` (papan kayu). WebP 512 & 1024 px (albedo/normal/ORM); di game dimuat 512 px (bukan permukaan utama): +365 KB per sesi, +1,7 MB di repositori. Tercatat di `ASSET_CREDITS.md`.
- **Buatan sendiri (kode):** semua kendaraan, roda, motor, fasad & isi ruko, atlas barang (kanvas), pelat nomor fiktif ("B 1729 KRN", dll.), papan trayek.
- **Diganti:** model mobil/angkot/van lama, ban torus, fungsi ruko lama di `Exterior.tsx`, kotak latar di luar gerbang.
- Tidak ada aset berbayar, tidak ada merek atau logo nyata.

### Pengujian

| Pemeriksaan | Hasil |
|---|---|
| Typecheck & lint | ✅ bersih |
| Vitest | ✅ 132/132 (17 berkas). Baru: `vehicles.test.ts` 9 tes: ukuran model = konstanta lalu lintas & collider van; roda menapak y = 0, bodi tidak menyentuh jalan, tanpa verteks bodi di dalam ban; anggaran segitiga velg; motor di dalam collider parkir & roda tidak menembus bodi; ciri bahan per gaya fasad; ruko di dalam kavling & tidak masuk jalan; odometer & belok roda van |
| Build produksi | ✅; chunk `PlayScreen` 338,3 → 376,0 kB (gzip 103,7 → 117,8 kB) |
| E2E Playwright (build produksi) | ✅ 2/2; alur utama 3,2 menit (batas 5 menit), Learning Mode 1,4 menit; total 5,1 menit termasuk build |
| Pemeriksaan visual di GPU asli (Iris Xe, Chromium + ANGLE/D3D11) | ✅ Showroom dev: MPV, hatchback, angkot, mobil boks dari samping, depan ¾, belakang ¾, dan close-up roda (profil Tinggi & Rendah). Lalu lintas ditangkap saat melintas (MPV, hatchback, angkot): roda berputar, bayangan kontak, pelat terbaca. Motor parkir dari 6 sudut. Ruko kawasan & ruko latar. Malam (19.30): lampu kendaraan bergerak menyala, lampu motor parkir tidak. Pandangan jauh setelah perubahan urutan gambar: marka, zebra, ubin pemandu, teras, dan panel bata utuh. 0 error konsol |
| Siklus mobil boks (browser, profil Sedang) | ✅ Kiriman `arrived` → van masuk gang → `vanParked` = true di (−14,6; −3,6) pada t+26 s → kiriman diterima → mundur keluar → pergi ke timur; lalu lintas tetap mengalir; 0 error konsol |
| Gameplay, NPC, interaksi | Domain, panel, dan interaksi tidak diubah. Regresi diperiksa lewat E2E (pelayanan, kasir, stok, pengadaan, misi, simpan/muat) dan unit/integrasi (`world`, `traffic`, `pedestrians` tetap lulus) |

Bug yang ditemukan & diperbaiki selama pengujian:
- **Pelat nomor & papan trayek tampil sebagai blok warna.** `b.box` memakai UV meter sehingga tekstur kanvas ter-clamp; kini memakai `BoxGeometry` dengan UV 0..1.
- **K7–K10** (lihat tabel audit): panjang model vs logika lalu lintas & collider van, ambang mobil terlalu tinggi, velg boros segitiga, collider motor lebih sempit dari setang, lampu motor parkir menyala saat malam.
- **Tes fasad melewati batas waktu 5 detik di suite penuh** (32 ruko dibangun dua kali saat tes berjalan paralel). Geometri ruko kini dibangun sekali di dalam tes.
- **Percobaan `BatchedMesh`** untuk bodi lalu lintas (satu draw call per material untuk semua jenis) justru lebih lambat di ANGLE/D3D11: multi-draw diemulasi dan tekstur matriks/warna diunggah ulang tiap frame. Pada putaran yang berdekatan, selisih terhadap baseline naik dari ±+1,1–1,4 ms menjadi ±+1,8–2,2 ms. Dibatalkan dan diganti buffer matriks bersama.
- 2 dari ±30 putaran benchmark awal gagal karena halaman dev dimuat ulang di tengah pengukuran. Putaran itu dibuang dan diulang; benchmark akhir 14/14 tanpa ulang.

### Performa

Metode: commit sebelum fase (`eb25ed4`) diekspor dan dijalankan di dev server kedua. Kedua versi diukur **berselang-seling dalam satu sesi**, dengan urutan versi bergantian per pasangan: Intel Iris Xe, 1920×1080, frame penuh lewat `__pharmacyDebug.frame()`, median 3 × 30 frame per sudut pandang. "Luar" = rata-rata 5 sudut pandang luar (jalan, trotoar seberang, halaman, gerbang, deret seberang); "interior" = pintu masuk & rak OTC.

| Profil | Luar: sebelum → sesudah | Selisih | Interior: sebelum → sesudah | Draw call tampilan jalan | Segitiga tampilan terberat |
|---|---|---|---|---|---|
| Rendah (2 pasangan) | 6,02 → 6,19 ms | +0,17 ms (+3%) | 5,79 → 5,49 ms | 353–366 → 371–394 | 246 rb → 301 rb |
| Sedang (3 pasangan) | 10,06 → 10,43 ms | +0,37 ms (+4%) | 8,21 → 8,65 ms | 366–399 → 377–403 | 258 rb → 321 rb |
| Tinggi (2 pasangan) | 11,68 → 12,36 ms | +0,67 ms (+6%) | 10,49 → 10,68 ms | 372–391 → 385–407 | 270 rb → 335 rb |

- Variansi antarputaran ±1–1,5 ms, sehingga selisih interior dan selisih profil Rendah berada di dalam derau pengukuran. Pengukuran awal (sebelum optimasi akhir di bawah, di sesi sebelum laptop dimulai ulang) menunjukkan selisih Sedang ±+0,8–1,4 ms; kondisi kedua sesi berbeda, jadi penurunannya tidak seluruhnya dapat diatribusikan ke optimasi.
- **Anggaran:** Tinggi ✅ (≤ 14 ms). Sedang tetap di batas 10 ms dan Rendah sedikit di atas 6 ms, sama seperti sebelum fase (10,06 / 6,02 ms). Segitiga tampilan terberat 335 rb ✅ (≤ 400 rb). Draw call tampilan jalan sudah melewati anggaran 350 sebelum fase ini (353–399) dan kini 371–407 ❌.
- **Segitiga geometri statis kawasan** 98.944 → 151.186 (+52 rb): fasad berdetail, isi kios, motor parkir, dan ruko latar.
- **Draw call +12 s.d. +28 per tampilan:** material baru kawasan (bata, batu alam, seng, papan kayu, keramik, atlas barang, ban & velg) dan bodi kendaraan dengan lebih banyak bahan.
- **Unduhan per sesi** (Sedang, 15 detik pertama): tekstur +365 KB (empat set CC0 baru, 512 px). Total terukur 9,84 → 10,66 MB; sisa selisihnya berasal dari avatar acak yang kebetulan muncul, bukan dari fase ini.
- **Bundle:** `PlayScreen` +37,6 kB (gzip +14 kB).

Optimasi dalam fase ini:
- velg: busur lubang palang mengikuti kerapatan sudut lingkar luar (3.672 → 792 segitiga per velg mobil);
- detail roda: lalu lintas 0,55 (±870 segitiga per roda, ban tanpa alur tapak), motor parkir 0,3, tumpukan ban 0,35;
- semua material bodi satu jenis kendaraan berbagi satu buffer matriks instance (satu unggahan per jenis per frame), begitu juga ketiga mesh roda;
- ruko latar LOD 1;
- urutan gambar `LATE_DRAW`: tanah, jalan, trotoar, lantai gang, dan dinding fasad digambar setelah detail di depannya. A/B dalam satu halaman (10 pengukuran) menunjukkan hemat 0,05–0,69 ms (rata-rata ±0,3 ms) dengan tampilan identik, termasuk marka di kejauhan;
- biaya clearcoat cat mobil diukur ±0,05 ms (dipertahankan);
- `BatchedMesh` dicoba lalu dibatalkan (lihat Pengujian).

### Keterbatasan & catatan (belum selesai)

- **Tidak ada pengemudi/penumpang.** Kaca kendaraan gelap (kaca film, lazim di Indonesia), sehingga isi kabin tidak terlihat. Menampilkan pengemudi butuh kaca semi-transparan (pengurutan transparansi), interior kabin, dan avatar tambahan per kendaraan; ditunda demi performa.
- **Tidak ada motor yang melaju di jalan.** Lalu lintas tetap mobil, hatchback, dan angkot. Motor melaju butuh pengendara beranimasi (pose duduk) dan roda instanced untuk motor.
- **Lalu lintas tidak berbelok** (jalan lurus tanpa persimpangan), sehingga roda depan mobil lalu lintas tidak berbelok; hanya van yang berbelok masuk/keluar gang.
- **Tidak ada LOD bodi kendaraan.** Bodi lalu lintas sudah instanced; LOD baru diperlukan bila jumlah kendaraan ditambah.
- Model kendaraan & motor dibuat dari ekstrusi profil. Dari sangat dekat, panelnya belum semulus model DCC (Blender), dan kabin tidak punya interior.
- Ruko tetap tidak bisa dimasuki; isi kios berupa latar tanpa gameplay.
- Profil Sedang tetap di batas anggaran 10 ms dan Rendah sedikit di atas 6 ms (sama seperti sebelum fase); draw call tampilan jalan 371–407 masih di atas anggaran 350 (lihat Performa).
- Pemeriksaan visual dilakukan lewat tangkapan layar Playwright di GPU asli (Iris Xe), bukan bermain manual; belum diuji di perangkat lain.

### Rekomendasi fase berikutnya

1. Motor yang melaju di lajur dengan pengendara Rocketbox (pose duduk) dan roda instanced.
2. Kaca semi-transparan + siluet pengemudi untuk kendaraan dekat (LOD 0), kaca gelap untuk yang jauh.
3. Persimpangan/gang yang bisa dilalui lalu lintas agar mobil berbelok (roda depan berbelok seperti van).
4. LOD bodi kendaraan bila jumlah kendaraan dinaikkan di profil Tinggi.
5. Bila ingin detail panel lebih tinggi: model kendaraan/motor dari Blender (buatan sendiri atau aset berlisensi jelas) lewat pipeline yang sama.
6. Pangkas draw call: atlas bahan kendaraan (lampu, pelat, dan trim dalam satu material bertekstur) dan gabungkan material ruko yang mirip.
7. Uji performa di GPU lain dan uji bermain manual.

## World building: audit & perbaikan (2026-10-02) — SELESAI

Tujuan: dunia sekitar apotek bisa dijelajahi secara wajar, terhubung, dan setiap area punya fungsi. Alur kerja: Audit → Temuan → Prioritas → Implementasi → Pengujian → Dokumentasi.

### Temuan audit

Sumber: peta top-down dengan overlay collider, serta pembacaan `layout.ts`, `collision.ts`, `PlayerController.tsx`, `Exterior.tsx`, dan `Patients.tsx`.

| # | Temuan | Dampak |
|---|---|---|
| A1 | `WORLD_BOUNDS` hanya x ±16, z −17,8…16: halaman ruko tetangga (paving sampai x ±40), sebagian besar jalan, trotoar seberang, dan toko seberang terlihat tetapi tidak terjangkau | Dinding tak terlihat di x = ±16 (di tengah paving) dan z = 16 (1 m masuk ke jalan) |
| A2 | Gang samping (x ±12,2…16,6) bisa dimasuki tetapi kosong, buntu di pagar z = −17,9, dan 0,6 m terakhir di sisi tembok tetangga terpotong batas | Area tanpa fungsi, buntu |
| A3 | Ruko tetangga dan seberang berupa balok tanpa interior dan tanpa collider (selama ini aman karena berada di luar batas). Toko "buka" hanya bidang gelap sehingga tampak bisa dimasuki | Bila batas diperluas, pemain akan menembus bangunan |
| A4 | Deretan ruko berulang: struktur, kedalaman, atap datar, dan jendela seragam; hanya warna dan tinggi yang berbeda | Terasa seperti salinan |
| A5 | Jalan berhenti mendadak di x ±40, dikelilingi tanah kosong sampai ±90 m; belakang apotek (z < −18) kosong | "Ujung dunia" terlihat |
| A6 | Gudang tidak punya akses luar; penerimaan kiriman hanya lewat panel. Tidak ada kendaraan pengantar maupun area bongkar muat | Pengadaan terputus dari dunia 3D |
| A7 | Pasien muncul tiba-tiba di (−8, 14) dan hilang di (9, 14); pejalan kaki hanya bolak-balik di trotoar seberang yang tidak terjangkau; tidak ada kendaraan bergerak; motor parkir tidak terkait apa pun | Lingkungan statis |
| A8 | Pohon dan lampu jalan berdiri tepat di mulut gang (x ±13,4…14,9) | Akses gang untuk kendaraan tertutup |
| A9 | Kamera orang ketiga hanya menganggap dinding interior dan pintu sebagai penghalang | Kamera bisa masuk ke bangunan luar bila batas diperluas |
| A10 | Pasien dapat dipanggil ±2 detik setelah tiba (status `entering` = 1 menit permainan), sedangkan jalan visual ±9 detik | Rute masuk yang lebih panjang akan memperbesar selisih ini, jadi jarak muncul harus tetap ±15 m |

### Rencana (prioritas)

| Prioritas | Pekerjaan | Status |
|---|---|---|
| P1 Navigasi & batas | Kawasan terbatas yang terbaca jelas: halaman depan seluruh deret ruko, jalan + zebra cross, trotoar seberang, gang samping, dan gang belakang yang menyambung (loop). Gerbang kawasan + pos satpam di kedua ujung jalan sebagai batas yang terlihat. Collider untuk semua bangunan dan properti. Kamera orang ketiga ikut terhalang bangunan | ✅ Selesai & diuji |
| P2 Kawasan apotek fungsional | Pintu bongkar muat gudang ke gang kiri + area bongkar muat; mobil boks PBF datang saat ada kiriman tiba dan pergi setelah diterima; titik "Penerimaan Barang" (fungsi nyata: tab terima kiriman); parkir motor tertata; parkir karyawan sesuai jumlah pegawai | ✅ Selesai & diuji |
| P3 Kualitas lingkungan | Variasi bangunan (lantai, atap, balkon, teralis, toren air, papan nama); toko buka berupa kios dengan meja di garis depan (jelas tidak bisa dimasuki); penempatan pohon, lampu, dan properti yang wajar; halte; latar di luar gerbang | ✅ Selesai (cek visual di browser) |
| P4 Lingkungan hidup | Pejalan kaki dengan graf rute dan tujuan (toko, kafe, halte, menyeberang); kendaraan di lajur kiri yang berhenti untuk pejalan kaki/pemain di zebra cross; pasien datang dari gang atau dari seberang jalan | ✅ Selesai & diuji (unit + browser) |
| P5 Pengujian | Uji keterjangkauan (flood fill pada collider), tidak ada tumpang tindih collider, rute NPC & kendaraan bebas collider; unit + E2E; benchmark GPU | ✅ Selesai (hasil di bawah) |
| P6 Dokumentasi | PROJECT_STATUS, ART_DIRECTION, ARCHITECTURE, TESTING | ✅ Selesai |

### Hasil implementasi

Berkas utama:
- `src/game/world/district.ts`: data kawasan sebagai satu sumber kebenaran. Isinya ruko, gerbang, properti, collider, rute pasien, rute van, dan graf pejalan kaki.
- `src/game/world/Exterior.tsx`: render kawasan.
- `src/game/world/SignAtlas.tsx`: semua papan nama kawasan dalam satu atlas (1 draw call).
- `src/game/world/traffic.ts`: logika murni lalu lintas & mobil boks.
- `src/game/world/vehicleModels.ts`: model mobil boks, mobil, dan angkot buatan sendiri.
- `src/game/world/DistrictVehicles.tsx`: van + kurir, lalu lintas instanced, motor karyawan.
- `src/game/npc/pedestrianPlan.ts` + `Pedestrians.tsx`: pejalan kaki, penjaga kios, dan satpam. Menggantikan `StreetLife.tsx`.
- `src/game/visual/InteriorCull.tsx`: culling interior, ruang belakang, dan "portal" etalase.

| Area | Hasil |
|---|---|
| Batas & navigasi | `WORLD_BOUNDS` mencakup kawasan x ±38,3 dan z −21,6…25,2. Setiap tepinya bertemu struktur yang terlihat: gerbang di x ±38,6 (gapura, pagar trotoar, portal), deret ruko di utara/selatan, dan tembok rumah warga di gang belakang. Ruko pengapit gang (S3, S4) memanjang sampai gang belakang, sehingga gang samping + gang belakang membentuk loop mengelilingi apotek. Tidak ada dinding tak terlihat di area terbuka (diuji). |
| Bangunan | 16 ruko dengan variasi 2/3 lantai, atap datar atau pelana genteng, balkon, teralis, toren air, kanopi kain/seng, dan AC. Toko buka berupa kios berceruk 2,6 m dengan meja/etalase/tumpukan ban tepat di garis muka, berisi barang khas: renteng sachet & tabung gas 3 kg, mesin fotokopi, etalase ponsel, kaleng cat & pipa, roti, printer besar, papan menu, piring lauk. Toko tutup memakai rolling door. Penjaga berdiri di balik meja. Semuanya punya collider dan menghalangi kamera orang ketiga. |
| Kawasan apotek | Pintu bongkar muat berengsel di dinding gudang (x = −12) dengan kanopi & lampu dinding. Papan "Penerimaan Barang" berisi langkah penerimaan (faktur vs surat pesanan, nama/jumlah/sediaan, nomor batch & kedaluwarsa, kemasan & suhu rantai dingin) dan membuka tab terima kiriman (fungsi nyata). Area bongkar muat bermarka kuning dengan palet. Rak gudang dipendekkan ke 5,2 m. Parkir motor bergaris di halaman; motor karyawan di gang kanan sesuai jumlah pegawai dalam shift (visual = collider). |
| Mobil boks PBF | Datang saat ada kiriman tiba atau akan tiba ≤ 8 menit permainan, belok maju ke gang kiri, lalu parkir dengan collider yang aktif hanya saat parkir penuh. Kurir + troli kardus muncul; kurir menoleh dan berbicara saat pemain mendekat. Setelah semua kiriman diterima (minimal 8 detik), van mundur keluar. Van menunggu lajur timur kosong sebelum buritan masuk jalan, lalu pergi ke timur. Rancangan awal (berhenti di lajur lalu mundur masuk gang) diganti karena berisiko buntu: mobil yang antre di belakang menghalangi jalur mundur. |
| Lalu lintas | Mobil & angkot di lajur kiri: 2/3/5 kendaraan untuk profil Rendah/Sedang/Tinggi+, dirender instanced dengan warna per kendaraan. Kendaraan menjaga jarak, berhenti untuk orang di lajurnya, berhenti di garis henti bila ada orang di zebra cross, dan melambat di portal gerbang yang terangkat otomatis. Angkot arah barat berhenti di halte (penumpang naik/turun). |
| Pejalan kaki & NPC | Pejalan kaki (2/3/5) keluar dari pintu rumah warga atau turun dari angkot, lalu mampir ke kios, etalase, atau kafe, atau menunggu angkot di bangku halte, kemudian pulang. Mereka menyeberang lewat zebra cross setelah tidak ada kendaraan yang masih melaju, menepi ke kiri saat berpapasan, berhenti dan menoleh bila pemain menghalangi, lalu menepi bila terhalang lama. Penjaga kios & satpam menoleh dan berbicara saat pemain mendekat. Pasien datang dari gang atau menyeberang dari halte, dan menunggu kendaraan di zebra cross. |
| Kualitas visual | Lantai gang memakai plester bertint abu-abu, karena tekstur Concrete033 terlalu gelap (rata-rata RGB ±80) dan tampak seperti tanah becek. Lantai atas apotek diberi jendela di sisi samping & belakang. AO kontak kawasan dipanggang sekali dari collider (10 px/m). Latar di luar gerbang: jalan berlanjut dengan deretan bangunan & pohon. |

### Pengujian

| Pemeriksaan | Hasil |
|---|---|
| Typecheck & lint | ✅ bersih |
| Vitest | ✅ 123/123 (16 berkas). Baru: `world.test.ts` 9, `traffic.test.ts` 8, `pedestrians.test.ts` 4 |
| `world.test.ts` | Flood fill keterjangkauan (grid 0,2 m, radius pemain 0,3) dari titik muncul ke 17 target (halaman, ujung kawasan, zebra, trotoar seberang, halte, gang, gudang lewat pintu bongkar muat, gang belakang, ruang dalam). Area tertutup (dalam ruko, luar gerbang, balik tembok) tidak terjangkau. Van parkir & motor karyawan tidak menutup jalur. Rute pasien, graf pejalan kaki (terhubung), rute van, dan lajur bebas collider. Properti tidak tumpang tindih. Batas dunia tertutup struktur. |
| `traffic.test.ts` | Berhenti di garis henti saat ada orang di zebra lalu jalan lagi; berhenti untuk orang di lajur; jaga jarak; angkot berhenti di halte; 240 detik tanpa tumpang tindih; van datang→parkir (posisi & arah)→pergi; van menunggu lajur kosong (tanpa kebuntuan); van berhenti untuk orang di gang. |
| `pedestrians.test.ts` | Semua tujuan terjangkau dari setiap rumah; penyeberangan hanya lewat zebra; rencana berakhir di rumah/halte; titik kegiatan tidak di dalam collider. |
| Build produksi | ✅ |
| E2E Playwright (build produksi) | ✅ 2/2; alur utama 3,3–3,9 menit (batas 5 menit) |
| Cek dinamis di browser (dev, GPU asli) | ✅ Van datang → `vanParked` = true di (−14,6; −3,6) → kiriman diterima → mundur & pergi ke timur. Lalu lintas mengalir di kedua lajur dan melambat di portal. Pejalan kaki terdaftar ke registri. 0 error konsol. Tangkapan layar halaman, gang, area bongkar muat, gang belakang, gerbang, trotoar seberang, kios, penjaga, dan kurir diperiksa. Peta audit sebelum/sesudah dibuat dengan overlay collider, rute, dan batas. |

Bug yang ditemukan dan diperbaiki selama pengujian:
- **LOD animasi membekukan avatar (T-pose).** Penghitung frame memakai `seed` pecahan, sehingga mixer tidak pernah diperbarui. Ditemukan lewat pemeriksaan tulang avatar di browser. Akibatnya, benchmark yang diambil sebelum perbaikan diulang.
- **Uji portal terlalu longgar.** Garis pandang kamera→objek kini harus menembus bentang kaca etalase.
- **Registri `crowd` pasien ikut hilang saat avatar di-cull dari render.** Akibatnya kendaraan tidak berhenti untuk pasien. Registri kini dipisah dari visibilitas render.

### Performa

Diukur di Intel Iris Xe, 1920×1080, frame penuh lewat `__pharmacyDebug.frame()`, rata-rata 5 sudut pandang standar. Variansi GPU di sesi ini besar: render yang identik bisa 6,5–9,0 ms. Angka sesi sebelumnya (Rendah 5,9 ms) juga tidak bisa dibandingkan langsung, karena baseline lama yang diukur ulang hari ini pun ±7,7 ms. Karena itu perbandingan dilakukan **di sesi yang sama dan berselang-seling**: kode eksterior & kehidupan jalan sebelum world building dipasang ulang sementara di balik flag dev, culling & LOD baru dimatikan, lalu kode sementara itu dihapus.

| Profil | Sebelum (rekonstruksi) | Sesudah | Selisih |
|---|---|---|---|
| Rendah | ±7,7 ms (satu putaran lain 11,3 ms karena lonjakan 26 ms) | 8,2–8,6 ms | ±+0,7 ms |
| Sedang | 10,6–11,0 ms | 9,8–10,5 ms | ±−0,5 ms |
| Tinggi | 12,5–12,7 ms | 13,3–14,0 ms | ±+1,0 ms |

- **Tampilan interior (inti gameplay)** setara atau lebih cepat. Penyebabnya: `InteriorCull` (isi apotek tidak dirender dari gang), `BackRoomCull` (ruang belakang hanya bila terlihat lewat pintu terbuka; draw call pelayanan 213→177), uji portal untuk NPC/kendaraan luar, dan LOD animasi avatar.
- **Tampilan jalan** lebih berat: +1,5–2,5 ms (Rendah) dan +4–5 ms (Tinggi). Isinya memang bertambah: kawasan lebih lengkap, lalu lintas, pejalan kaki, penjaga. Draw call tampilan jalan tetap 355–417, setara sebelumnya (380–409).
- **Optimasi yang dilakukan:**
  - papan nama dalam satu atlas;
  - kotak kawasan tanpa tepi bulat (segitiga kawasan 200 rb → 89 rb);
  - AC ruko latar sebagai model sederhana gabungan (AC GLB hanya 3 unit dekat pemain);
  - lalu lintas instanced;
  - jumlah NPC per profil;
  - penjaga tidak dirender > 30 m;
  - lapisan AO lantai interior dibatasi ke dalam gedung dan AO kawasan berlubang di area gedung (satu lapisan transparan di mana pun).
- **Logika CPU per frame** (simulasi lalu lintas, pejalan kaki, animasi) ±0,2–0,5 ms.

### Keterbatasan & catatan

- Ruko tetangga sengaja tidak bisa dimasuki: kios dilayani dari depan meja, toko lain ber-rolling door. Pembelian di kios tidak punya gameplay (latar).
- Kendaraan tidak bisa ditabrak pemain secara fisik saat bergerak (hanya van parkir & motor yang ber-collider). Sebagai gantinya kendaraan berhenti bila pemain ada di lajurnya.
- Pejalan kaki & pasien tidak saling menghindar secara fisik (hanya menepi saat berpapasan dan berhenti untuk pemain). Sesekali avatar bisa bersinggungan sebentar.
- Kurir tidak mengangkut kardus secara animasi; ia berdiri di samping troli. Kiriman diterima lewat panel seperti sebelumnya, dan pegawai gudang tetap dapat menerimanya otomatis.
- Tampilan jalan pada profil Tinggi (17–21 ms) melewati anggaran 14 ms per sudut pandang; rata-rata 5 sudut pandang ±13,3–14 ms. Bila perlu: kurangi kendaraan/NPC di Tinggi atau pakai LOD geometri kawasan.
- Angka benchmark hanya dari satu laptop (Iris Xe) dengan variansi tinggi, belum diuji di perangkat lain.

## Revisi visual 2: aset berlisensi terbuka (2026-10-01)

Hasil evaluasi: revisi 1 masih terbaca sebagai game low-poly/Roblox. Penyebab utamanya karakter manekin prosedural, perabot berupa kotak, tekstur noise, cahaya datar, dan ruang kosong. Revisi 2 beralih ke strategi **hibrida**. Audit, rencana, keputusan, dan pengukurannya ada di [ART_DIRECTION.md](ART_DIRECTION.md); lisensinya di [ASSET_CREDITS.md](ASSET_CREDITS.md). Gameplay, kontrol, ID interaksi, posisi stasiun, dan jalur NPC tidak berubah.

| Area | Hasil |
|---|---|
| Pipeline aset | `scripts/assets/` mengunduh dari sumber resmi dan mengoptimasi (WebP, meshopt, simplify) ke `public/assets/`. Manifest dan `ASSET_CREDITS.md` dibuat otomatis, ada tes kelengkapan berkas, dan versi prosedural menjadi cadangan bila aset gagal dimuat. |
| Karakter | 25 avatar realistis Microsoft Rocketbox (MIT) + 6 varian busana berjilbab, dengan animasi motion capture: berjalan, diam, menunggu gelisah, marah, berbicara, duduk. Postur diskalakan ke rata-rata Indonesia. Apoteker berjas putih tanpa stetoskop; ada pasien berbaju koko & kopiah. |
| Material | 12 set tekstur foto PBR ambientCG (CC0): granit 60×60, plester, plafon akustik, kayu HPL, stainless, kain, paving block, ubin pemandu, aspal, beton, fasad. |
| Apotek | APAR, CCTV, jam dinding (jam permainan), Surat Izin Apotek/SIPA/Jadwal Praktik (fiktif, nama pemain), stiker antre, keset, hand sanitizer, brosur DAGUSIBU, panel merek meja, lambris kayu, stiker kaca buram, detektor asap/speaker, rak resep penuh pada stok normal. Ruang belakang diberi properti Poly Haven. |
| Eksterior | Pohon ketapang kencana, motor matik baru, unit AC luar, papan kapur jam buka, panel listrik, kursi kedai kopi, pejalan kaki & pengunjung kafe. |
| Render | AO sudut terpanggang di semua profil. Profil **Ultra** baru (AO layar N8AO + bloom + SMAA) dimuat malas, untuk GPU diskrit. |
| Performa (Iris Xe 1080p) | Rendah 5,9 ms · Sedang 9,5–11,5 ms (di batas anggaran 10 ms) · Tinggi 10–13,4 ms · Ultra 38 ms. Unduhan aset per sesi 5,1–8,3 MB. |
| Pengujian | Typecheck & lint bersih · Vitest 102/102 (13 berkas) · build OK · E2E Playwright 2/2 terhadap build produksi. |

## Peningkatan visual "stylized realistic" — revisi 1 (2026-10-01)

Tahap V1–V7 diimplementasikan tanpa mengubah sistem gameplay (ID interaksi, posisi stasiun, dan tabrakan perabot tetap sama). Sebagian besar hasilnya tetap menjadi fondasi revisi 2.

| Area | Hasil |
|---|---|
| Render | Tone mapping Neutral, IBL dari Lightformer (render sekali), langit & matahari mengikuti jam permainan, profil kualitas Rendah/Sedang/Tinggi. |
| Material | Tekstur PBR prosedural (keramik, cat, plafon grid, vinyl, epoksi, kayu HPL, logam sikat, paving, aspal, plester, pegboard, rolling door) dengan UV berskala meter. |
| Grounding | AO lantai & genangan cahaya terpanggang dari tata letak, bayangan blob karakter, sinar matahari lewat etalase, bayangan matahari real-time (Tinggi, di-cache). |
| Arsitektur | Fasad ruko 2 lantai (kanopi, rolling door, papan nama, jendela atas, AC, tanda plus), plint, kusen, panel LED, dinding merek, signage. |
| Perabot & produk | Model baru semua stasiun; **kemasan produk dari katalog yang jumlahnya mengikuti stok** di rak, etalase, kulkas, gudang, dan rak bahan racik. |
| Karakter | Rig skinned prosedural (1 draw call/karakter), variasi nusantara (jilbab, peci, kacamata), seragam pegawai, animasi berbasis status (tidak sabar, duduk, dilayani, kesal). |
| Eksterior | Deretan ruko fiktif, parkir, kanstin hitam-putih, jalan bermarka, lampu jalan, tiang listrik, pohon, motor parkir; malam hari dengan jendela & lampu menyala. |
| Performa | GPU Intel Iris Xe 1080p: Rendah 4,35 ms, Sedang 6,22 ms, Tinggi 8,12 ms per frame (sebelumnya 4,18 / 4,41 / 6,68 ms). |

## Kriteria penerimaan (bagian 26)

| # | Kriteria | Status |
|---|---|---|
| 1 | Berjalan tanpa error penghalang | ✅ (E2E tanpa `pageerror`) |
| 2 | Jelajah 3D | ✅ |
| 3 | Interaksi objek | ✅ |
| 4 | Pasien datang & antre | ✅ |
| 5 | Pelayanan pasien selesai | ✅ |
| 6 | Resep dengan alur jelas | ✅ |
| 7 | Stok berubah sesuai transaksi | ✅ |
| 8 | Batch & kedaluwarsa | ✅ |
| 9 | FEFO | ✅ |
| 10 | Transaksi | ✅ |
| 11 | Pengadaan | ✅ |
| 12 | Laporan dari data transaksi | ✅ |
| 13 | Peracikan | ✅ |
| 14 | Pegawai berfungsi | ✅ |
| 15 | Peningkatan fasilitas | ✅ |
| 16 | Misi & progres | ✅ |
| 17 | Simpan/muat | ✅ |
| 18 | Mode berbeda nyata | ✅ |
| 19 | AI tidak wajib | ✅ |
| 20 | Fitur belum selesai ditandai jujur | ✅ (lihat bawah) |
| 21 | Pengujian inti dijalankan & didokumentasikan | ✅ |

## Belum selesai / keterbatasan yang diketahui

- **Terjemahan bahasa Inggris hanya sebagian** (menu utama, HUD, menu jeda, pengaturan). Panel simulasi berbahasa Indonesia. Ditandai "English (sebagian)" di pengaturan.
- **Audio masih placeholder** (Web Audio prosedural). Logo golongan obat pada kemasan belum digambar karena data golongan belum ada.
- **Visual revisi 2** (rincian di ART_DIRECTION.md §13):
  - Wajah Rocketbox didominasi ras Eropa. Avatar Asia, sawo matang, dan berjilbab sudah dipilih, tetapi variasinya tetap terbatas.
  - Varian abaya punya artefak kecil di pergelangan.
  - Wajah tidak beranimasi saat berbicara.
  - Kendaraan & motor buatan sendiri (dimodel ulang 2026-10-02): kaca gelap tanpa pengemudi/interior, belum ada motor yang melaju, dan dari sangat dekat panel ekstrusi belum semulus model DCC (rincian di "Fase kualitas kendaraan").
- **Profil Sedang di batas anggaran** (9,5–11,5 ms vs 10 ms), dan **draw call tampilan jalan 380–407** melebihi anggaran 350. Biaya terbesar berasal dari permukaan bertekstur foto dan ±100 label kanvas. Atlas label adalah langkah lanjutan.
- **Post-processing** (AO layar, bloom) hanya tersedia di profil Ultra. Di GPU terintegrasi biayanya ±30 ms per frame.
- **Unduhan aset 3D** 5,1–8,3 MB per sesi, tergantung profil (repositori ±24 MB untuk semua varian).
- **AI nyata belum diuji end-to-end** karena memerlukan kredensial; jalur tanpa kredensial (503 → fallback lokal) sudah diuji. Tanpa proxy (mis. di hosting statis), toggle AI di Pengaturan dinonaktifkan dan ditandai "Tidak tersedia".
- **Pegawai tidak memakai pathfinding**: berpindah ruangan dengan teleport bila jarak jauh; pasien berjalan lurus antar titik di area pelanggan.
- **Kamera orang ketiga** hanya bertabrakan dengan dinding/pintu (bukan perabot rendah).
- **Kasir tidak bisa membuat transaksi tanpa pasien** (keputusan desain untuk mencegah uang tanpa batas); transaksi dibuat dari Meja Pelayanan.
- Timbangan & mortir membuka laboratorium yang sama (bukan langsung ke langkah tertentu).
- Ukuran bundle 3D ±1,27 MB (gzip ±350 KB: `r3f` + `PlayScreen`), dimuat terpisah dari menu. Chunk post-processing 332 KB hanya untuk profil Ultra.
- Performa di perangkat kelas bawah belum diukur; tersedia kualitas grafis "Rendah" dan mode tanpa WebGL (tablet + akses cepat).

## Bug yang diketahui

Tidak ada bug penghalang yang diketahui saat ini. Bug yang ditemukan & diperbaiki selama pengujian visual/E2E:
- NPC tertahan di pintu masuk (rute dihitung ulang tiap tick) — diperbaiki (rute dikunci per tujuan).
- Kotak stok etalase tergambar di lorong staf — diperbaiki.
- Interaksi menembus dinding — dinding kini menjadi penghalang raycast.
- Kamera orang ketiga masuk ke dinding — kamera ditarik mendekat.
- Hasil penyerahan resep langsung hilang dari panel — hasil & tanggapan pasien kini tetap tampil.
- Tutorial dapat tertahan bagi pemain yang tidak berjalan — ada tombol "Lewati langkah ini".
- **Pasien tidak pernah datang** bila pemain sudah berjalan sebelum menekan "Mengerti" (sinyal gerak hanya dikirim sekali sehingga tutorial macet di langkah "Bergerak" dan pasien acak terus ditahan) — diperbaiki: sinyal gerak dikirim saat langkahnya aktif, membuka apotek melompati langkah pengantar, dan pasien acak hanya ditahan selama pasien tutorial masih dilayani.
- Tempo terlalu cepat (antrean langsung penuh) — waktu diperlambat & kedatangan disesuaikan.
- Game pertama yang dimulai di `npm run dev` langsung kembali ke menu (Vite me-reload halaman karena mengoptimasi dependensi baru) — diperbaiki dengan pra-bundel `optimizeDeps.include`.
- Scene 3D terus dirender penuh di balik panel/modal — kini dirender sesuai permintaan selama panel terbuka (hemat GPU/baterai, E2E jauh lebih cepat).
- Revisi visual 2 (ditemukan & diperbaiki selama pengerjaan):
  - Tekstur avatar terbalik karena citra TGA dibalik dua kali.
  - Mixer animasi rusak di StrictMode (`_cacheIndex`).
  - Strip AO sudut "tembus" dinding karena `polygonOffset` berbasis kemiringan.
  - Garis AO di lab.
  - Chunk post-processing ikut menarik three.js core dan selalu terunduh (aturan `manualChunks` Rolldown).
  - Biaya post-processing 45–59 ms per frame di GPU terintegrasi, sehingga dipindah ke profil Ultra.

## Keputusan teknis penting

Lihat [ARCHITECTURE.md](ARCHITECTURE.md#keputusan-teknis-penting). Ringkas: domain murni + immer, `GameState` JSON tunggal dengan RNG deterministik, uang hanya lewat buku besar, guard status anti-ganda, AI hanya via proxy server dengan fallback lokal, aset dibuat di kode.

## Asumsi

- Bahasa utama UI: Indonesia (sesuai dokumen kebutuhan).
- Satuan stok = satuan kemasan (strip/botol/gram); jumlah resep ditulis dalam satuan yang sama.
- Harga & data obat adalah contoh; tidak dimaksudkan akurat secara klinis maupun komersial.
- Hari permainan dimulai Senin, 5 Januari 2026 (kalender simulasi).

## Langkah berikutnya yang disarankan

1. Uji bermain manual dengan mouse/keyboard di GPU nyata untuk menyetel sensitivitas, kecepatan gerak, dan tempo kedatangan pasien. Sekalian nilai visual revisi 2 dari sudut pandang farmasi: kesesuaian seragam, dokumen izin, dan brosur.
2. Lengkapi terjemahan bahasa Inggris untuk panel simulasi.
3. Ganti audio placeholder dengan aset berlisensi jelas (catat di ASSET_CREDITS.md lewat pipeline).
4. Tambahkan pathfinding sederhana (grid) untuk pegawai & pasien.
5. Uji AI end-to-end dengan kredensial server dan tambahkan evaluasi kualitas teks.
6. Tambah E2E untuk Challenge Mode dan peracikan.
7. Verifikasi data golongan obat (bebas/bebas terbatas/keras) agar logonya bisa digambar di kemasan.
8. Visual lanjutan:
   - atlas label kanvas untuk menurunkan draw call;
   - mesh jilbab untuk avatar lain;
   - LOD avatar jauh;
   - kompresi tekstur KTX2 bila encoder tersedia.
9. Kendaraan lanjutan (rincian di "Fase kualitas kendaraan → Rekomendasi"): motor melaju dengan pengendara, siluet pengemudi di balik kaca semi-transparan untuk kendaraan dekat, lalu lintas yang berbelok, LOD bodi kendaraan.
