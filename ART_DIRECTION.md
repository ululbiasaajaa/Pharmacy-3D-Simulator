# Art Direction — Pharmacy 3D Simulator

_Versi 2.1 · 2026-10-01 · Status: revisi 2 (R1–R7) diimplementasikan dan diverifikasi; hasil pengukuran di [§12](#12-hasil-pengukuran)_

Arah visual: **stylized realistic**, yaitu apotek modern di sebuah ruko kota kecil di Indonesia. Dokumen ini menjadi acuan tunggal untuk keputusan visual, aset, dan performa. Gameplay, kontrol, dan sistem domain **tidak diubah**. Perubahan hanya menyentuh lapisan visual: `src/game/**`, `public/assets/**`, dan `scripts/assets/**`.

---

## 0. Ringkasan revisi 2

Revisi 1 (V1–V7) memperbaiki fondasi render: tone mapping, IBL, siklus siang–malam, bevel, tekstur prosedural, dan profil kualitas. Namun seluruh aset masih dibangun dari primitif dan noise di kode. Hasilnya bersih dan ringan, tetapi tetap terbaca sebagai game low-poly: karakter seperti manekin, perabot berbentuk kotak, material terlalu seragam, cahaya datar, dan ruang terasa kosong.

Revisi 2 mengganti strategi "semua prosedural" menjadi **hibrida**:

1. **Aset berlisensi terbuka** dipakai untuk objek yang memang butuh model detail, yaitu manusia (Microsoft Rocketbox, MIT) dan properti (Poly Haven, CC0).
2. **Tekstur foto PBR** dipakai untuk permukaan utama (ambientCG, CC0).
3. **Perabot khas apotek tetap dibuat sendiri** karena tidak ada padanan gratis yang sesuai. Detail dan materialnya ditingkatkan.
4. **Post-processing** (AO layar, bloom selektif, antialias) dan penyetelan ulang rig cahaya.
5. **Set dressing** khas apotek Indonesia, ditempatkan tanpa mengganggu jalur NPC maupun stasiun.

Model prosedural lama **dipertahankan sebagai fallback**: dipakai saat aset sedang dimuat atau gagal dimuat, sehingga game tetap bisa dimainkan tanpa koneksi ke sumber aset.

---

## 1. Audit kondisi saat ini (setelah revisi 1)

Diukur di build pengembangan, kualitas **Tinggi**, 1280×720, GPU Intel Iris Xe (Chromium + ANGLE/D3D11), 14 sudut pandang tetap.

| Metrik | Nilai |
|---|---|
| Mesh di scene | 332 (24 instanced) |
| Material unik | 154 |
| Lampu | 6 (1 dengan bayangan) |
| Draw call per frame | 72–243 |
| Segitiga per frame | 79 rb–147 rb |
| Tekstur di GPU | 93–103 |
| Program shader | 18–19 |
| Aset eksternal | 0 (semua dibuat dari kode) |

**Sistem rendering**
- WebGL2 melalui React Three Fiber, dengan tone mapping Neutral.
- IBL dari Lightformer yang dirender sekali.
- Sumber cahaya: matahari, hemisfer, dan 0–4 lampu titik. Bayangan real-time hanya dari matahari, dan hanya di kualitas Tinggi.
- **Tanpa post-processing**: tidak ada AO layar, bloom, atau color grading.
- Antialias memakai MSAA bawaan kanvas.

**Aset**
- Semua geometri dibangun dari primitif (kotak bersudut bulat, silinder, lathe) yang digabung per material.
- Produk memakai atlas kemasan yang digambar dari katalog.
- Karakter berupa SkinnedMesh prosedural 12 tulang dengan warna per verteks, dan animasinya dihitung dari rumus.

**Material**
- Semua memakai `MeshStandardMaterial` dengan tekstur noise prosedural.
- Hasilnya rapi, tetapi tanpa detail dunia nyata seperti serat, noda, aus, atau variasi warna, sehingga semua permukaan tampak baru keluar dari pabrik.

**Pencahayaan**
- Terang merata.
- AO hanya ada di lantai, berupa overlay terpanggang. Tidak ada AO di sudut dinding, di bawah meja, maupun di antara perabot.
- Tidak ada pantulan cahaya antarpermukaan (GI).

**Struktur scene**
- Urutannya: `PharmacyScene` → `Atmosphere` (langit, IBL, lampu) → `Building` (arsitektur, fasad, eksterior) → `FloorAO`/`SunPatches` → `Furniture` (stasiun interaktif dan model) → `AutoDoor` → `Patients`/`Employees` → `PlayerController`.
- Tata letak, tabrakan, dan titik navigasi NPC bersumber tunggal dari `layout.ts`.

### Mengapa masih terlihat seperti game low-poly / Roblox

| # | Temuan dari tangkapan layar | Akar masalah | Solusi revisi 2 |
|---|---|---|---|
| 1 | Karakter seperti manekin: tungkai berbentuk tabung, badan menggumpal, wajah seperti stiker, gerak kaku | Model dan animasi prosedural dari primitif | Avatar realistis ber-rig (Rocketbox) dengan animasi motion capture |
| 2 | Ruang pelanggan 24 × 7,6 m nyaris kosong | Hanya objek gameplay yang ada, tanpa set dressing | Dekorasi khas apotek Indonesia di sepanjang dinding |
| 3 | Permukaan terlalu seragam dan bersih | Noise prosedural tanpa detail foto | Tekstur foto PBR CC0 dengan skala fisik yang benar |
| 4 | Cahaya datar, objek tampak "menempel" | Tidak ada AO di sudut dan titik kontak, ambient terlalu tinggi | AO layar (N8AO), ambient diturunkan, kontras cahaya bermotivasi |
| 5 | Perabot berupa kotak polos | Tanpa detail sekunder (engsel, gagang, tepi) maupun tersier (label, aus) | Model properti Poly Haven, ditambah perabot buatan sendiri yang lebih rinci |
| 6 | Tanaman dan pohon tersusun dari bola | Primitif | Model tanaman CC0; pohon dari kartu daun (tahap eksterior) |
| 7 | Glow lampu dan papan tidak meyakinkan | Halo memakai sprite palsu | Bloom selektif, hanya pada emisif yang terang |
| 8 | Eksterior seperti maket | Fasad datar, motor berbentuk kotak | Tahap R6, setelah interior memadai |

---

## 2. Arah visual

**Konsep:** apotek lingkungan modern di ruko dua lantai, di kota kecil Indonesia. Suasananya bersih, hangat, ramah, sedikit padat, dan hidup. Semua merek fiktif dan tidak meniru jaringan apotek nyata.

**Pilar**

1. **Skala dan proporsi nyata**: ukuran metrik (meja 1,05 m, rak 2 m, pintu 2,1 m, plafon 3,2 m).
2. **Aset nyata untuk bentuk kompleks**: manusia, tanaman, dan peralatan memakai model detail, bukan primitif.
3. **Material berlapis**: tekstur foto (albedo, normal, roughness) dengan variasi; tidak ada putih murni maupun hitam murni.
4. **Cahaya bermotivasi dengan kedalaman**: setiap cahaya punya sumber yang terlihat, ditambah AO di sudut dan titik kontak.
5. **Kepadatan yang bercerita**: rak penuh mengikuti stok, papan informasi, poster, dan barang sehari-hari staf.
6. **Keaslian lokal**: paving block, ubin pemandu, AC split, galon, kursi plastik, APAR, papan nama apoteker dan jam praktik.
7. **Palet terkendali**: ±60% netral hangat, ±30% kayu dan batu, ±10% aksen teal (§8).
8. **Keterbacaan gameplay di atas segalanya**: stasiun interaktif, signage, dan status pasien tetap jelas; dekorasi tidak pernah menyerupai objek interaktif.

---

## 3. Strategi & pipeline aset

### Sumber

| Sumber | Lisensi | Dipakai untuk | Alasan |
|---|---|---|---|
| [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) | MIT | Pasien, pegawai, avatar pemain, dan animasi motion capture | 115 manusia realistis berpakaian dengan rangka yang sama (`Bip01`), ditambah ±470 animasi: berjalan, menunggu, gelisah, marah, berbicara, duduk |
| [Poly Haven](https://polyhaven.com) | CC0 | Tanaman pot, APAR, CCTV, tanda lantai basah, rak besi dan kardus gudang, galon, kursi plastik, unit AC luar, rolling door, lampu jalan, tempat sampah | Model realistis dengan tekstur PBR dan polycount wajar |
| [ambientCG](https://ambientcg.com) | CC0 | Lantai, dinding, plafon, kayu HPL, stainless, kain, kulit sintetis, paving, aspal, ubin pemandu | Tekstur foto PBR dengan ukuran fisik |
| Buatan sendiri | — | Gondola, meja pelayanan, etalase, lemari resep, kulkas farmasi, POS/EDC, signage, kemasan produk, AC split, papan nama apoteker | Tidak ada padanan gratis yang sesuai dengan konteks apotek Indonesia |

Model berbayar dan "gratis" dengan lisensi tidak jelas **tidak dipakai**. Sumber yang mewajibkan login, seperti Sketchfab atau Mixamo, juga tidak dipakai, agar pipeline bisa diulang siapa saja.

### Kriteria seleksi

- Lisensi CC0 atau MIT, sehingga boleh didistribusikan ulang dalam repositori publik.
- Cocok dengan konteks Indonesia.
- Setelah optimasi: properti ≤ 15 rb segitiga, karakter ≤ 9 rb segitiga, tekstur ≤ 1K.
- Tanpa logo merek nyata.

### Pipeline (`scripts/assets/`, dapat diulang)

1. Unduh dari sumber resmi. File mentah disimpan di `.asset-cache/` dan diabaikan git.
2. Konversi: FBX→glTF untuk Rocketbox, TGA→WebP/JPEG.
3. Optimasi dengan `@gltf-transform`: dedup, weld, simplify bila perlu, ubah ukuran tekstur, WebP/JPEG, dan kompresi meshopt.
4. Simpan hasil ke `public/assets/`, lalu daftarkan di registri kode.

**Fallback.** Aset dimuat malas (lazy) dengan Suspense dan error boundary. Selama memuat atau bila gagal, versi prosedural ditampilkan.

**Lisensi.** Setiap aset dicatat di [`ASSET_CREDITS.md`](ASSET_CREDITS.md) (sumber, lisensi, pembuat, modifikasi). Teks lisensi MIT Rocketbox disertakan bersama berkasnya.

---

## 4. Interior apotek (prioritas utama)

| Elemen | Arah | Sumber |
|---|---|---|
| Lantai pelanggan | Ubin granit 60×60 putih krem bintik, semi-glossy, nat tipis | ambientCG `Tiles040` |
| Lantai staf, lab, gudang | Vinyl, epoksi, dan beton poles; tetap prosedural tetapi diredam | prosedural |
| Dinding | Plester cat putih hangat bertekstur halus; plint gelap | ambientCG `Plaster001` |
| Plafon | Panel akustik 60×60 berbintik dengan panel LED terbenam | ambientCG `OfficeCeiling001` |
| Meja pelayanan & kasir | Panel HPL oak bertekstur foto; top solid surface; sekat akrilik; POS, EDC, printer struk, tempat brosur | buatan sendiri + ambientCG `Wood058` |
| Rak obat bebas | Gondola pegboard; price strip dan label harga; header kategori; produk menghadap depan dan mengikuti stok | buatan sendiri |
| Lemari resep, kulkas, lab | Stainless sikat, kaca, laci berlabel | buatan sendiri + ambientCG `Metal009` |
| Ruang tunggu | Kursi gandeng berdudukan kain/logam berlubang, tanaman pot, TV antrean | buatan sendiri + Poly Haven |
| Gudang | Rak besi siku, kardus, palet | Poly Haven `steel_frame_shelves`, `cardboard_box_01` |

**Set dressing khas apotek Indonesia** (`SetDressing.tsx`). Hanya dekorasi: tidak ada sorotan, tidak ada prompt, dan tidak ada collider di jalur NPC.

- **Ruang pelanggan**
  - Pintu masuk: keset "SELAMAT DATANG", hand sanitizer, tempat sampah pedal stainless.
  - Lantai: stiker "ANTRE DI SINI" di setiap slot antrean.
  - Dinding:
    - lambris HPL kayu di ruang tunggu;
    - stiker kaca buram bertuliskan nama apotek di etalase;
    - APAR 3 kg beserta tandanya;
    - jam dinding yang menunjukkan **jam permainan**.
  - Plafon: dua CCTV kubah, detektor asap, dan speaker.
- **Meja pelayanan**
  - panel merek di muka meja;
  - rak brosur edukasi (DAGUSIBU, cuci tangan, tekanan darah; tanpa dosis).
- **Dinding belakang meja:** Surat Izin Apotek, SIPA, dan Jadwal Praktik Apoteker. Semuanya fiktif, memakai nama pemain dengan gelar "apt.", dan jam praktik diambil dari konfigurasi game.
- **Ruang belakang**
  - Administrasi: lampu meja dan kursi tamu.
  - Gudang: kardus dan perlengkapan kebersihan.
  - Ruang istirahat (setelah dibeli): kipas plafon berputar dan kursi plastik.
- **Peningkatan tetap bermakna**
  - Tanaman (keladi, pohon pot, sukulen di meja) muncul dari peningkatan Dekorasi atau Ruang Tunggu.
  - AC split dari peningkatan AC.
  - Poster dari Dekorasi tingkat 2.

Tidak dibuat: tanda "Dilarang merokok" dan galon dengan dispenser. Model galon CC0 yang tersedia hanya jeriken, bukan galon air minum.

---

## 5. Karakter & animasi

**Gaya:** manusia realistis (Rocketbox, ±8 rb segitiga) dengan tekstur kulit dan pakaian dari foto, serta normal map. Gerakannya memakai motion capture. Gaya ini lebih "realistic" daripada lingkungan, tetapi tetap selaras karena material lingkungan kini juga berbasis foto.

**Pemilihan pemeran**

| Peran | Avatar | Catatan |
|---|---|---|
| Pasien perempuan | `Female_Adult_03`, `05`, `07`, `09`, `12`, `Business_Female_01` | Prioritas wajah Asia, warna kulit sawo matang, dan busana sopan |
| Pasien perempuan berjilbab | `Female_Adult_10` (abaya hitam) + 3 varian warna (navy, marun, hijau tua); `Female_Adult_06` (lansia, jilbab putih & gamis khaki) + 3 varian (merah muda/marun, biru/navy, krem/hijau sage) | Varian dibuat pipeline dengan pewarnaan ulang per piksel hanya pada rentang warna kain (kulit & mata dikecualikan) |
| Pasien laki-laki | `Male_Adult_09`, `10`, `17`, `04`, `07`, `01`; lansia `03`, `05`, `14`; berpeci `15` (baju koko & kopiah) | Hindari kostum Timur Tengah (keffiyeh) dan burka yang tidak umum di Indonesia |
| Apoteker | `Medical_Female_01`, `Medical_Male_01` (jas putih) | Tanpa stetoskop karena itu atribut dokter |
| Asisten | `Female_Adult_09` (kardigan), `Male_Adult_01` (polo) | — |
| Kasir | `Female_Adult_15`, `Male_Adult_08` (kemeja biru) | Sesuai seragam kasir sebelumnya |
| Petugas gudang | `Female_Adult_13` (rompi), `Male_Adult_11` (kemeja kerja) | — |
| Manajer | `Business_Female_01`, `Business_Male_06` | — |
| Pemain (orang ketiga) | `Medical_Male_01` | Apoteker berjas putih |

Tinggi asli Rocketbox 1,72–1,87 m. Avatar diskalakan ke postur rata-rata Indonesia (perempuan ±1,55–1,65 m, laki-laki ±1,64–1,76 m) dengan variasi dari gaya karakter. Frekuensi langkah ikut disesuaikan agar kaki tidak meluncur.

**Animasi berdasarkan status gameplay** (klip Rocketbox, dipisah per gender)

| Status | Klip |
|---|---|
| Berjalan | `walk_neutral` (gerak akar horizontal dihapus); kecepatan putar mengikuti kecepatan gerak |
| Menunggu | `idle_neutral_01` |
| Tidak sabar (kesabaran < 35%) | `idle_waiting_01` / `idle_nervous` |
| Dilayani | `gestic_talk_neutral_01` |
| Menunggu racikan/resep | `sit_chair_idle_waiting_01` |
| Pergi kesal | `walk_neutral` dengan kecepatan lebih tinggi |
| Marah | `idle_angry_01` |
| Pegawai bekerja | `documents_idle` / `idle_neutral` |

**Teknik**
- Satu GLB per avatar, berisi tekstur WebP/JPEG 1024/512 dan geometri terkompresi meshopt.
- Satu GLB animasi per gender, dipakai bersama semua avatar karena nama tulangnya sama.
- `AnimationMixer` per karakter dengan crossfade 0,3 detik.
- Avatar diklon (`SkeletonUtils`) bila beberapa pasien memakai avatar yang sama.
- Avatar dimuat saat dibutuhkan; model prosedural tampil selama memuat.

**Jilbab.** Rocketbox hanya punya dua avatar berjilbab yang sesuai, sehingga antrean sempat diisi wajah yang sama. Masalah ini diatasi dengan 6 varian warna busana dari pipeline, jadi kini ada 8 tampilan berjilbab. Mesh jilbab buatan sendiri untuk avatar lain tetap menjadi opsi lanjutan (§13).

---

## 6. Material & tekstur

| Permukaan | Tekstur (CC0) | Ukuran fisik | Catatan |
|---|---|---|---|
| Lantai pelanggan | ambientCG `Tiles040` | sesuai grid 60 cm | Diberi tint krem hangat, roughness ±0,25 |
| Dinding | ambientCG `Plaster001` | 2 m | Tint putih hangat; normal halus |
| Plafon | ambientCG `OfficeCeiling001` | grid 60 cm | Emisif lemah agar tidak gelap |
| Kayu HPL | ambientCG `Wood058` | 1 m | Arah serat horizontal |
| Stainless / aluminium | ambientCG `Metal009` | 0,5 m | Logam sikat |
| Kain kursi / kulit sintetis | ambientCG `Fabric030` / `Leather026` | 0,5 m | — |
| Paving parkir | ambientCG `PavingStones099` | sesuai bata | Paving block zig-zag khas Indonesia (tahap R6) |
| Trotoar | ambientCG `TactilePaving003` | 30 cm | Ubin pemandu kuning (tahap R6) |
| Aspal | ambientCG `Asphalt025A` | 4 m | Tahap R6 |

- Semua tekstur diproyeksikan dengan UV skala meter, yang sudah dipakai sejak revisi 1, sehingga kerapatan texel konsisten.
- Peta roughness dari foto dipadatkan ke kanal G, dan normal map memakai konvensi OpenGL.
- Tekstur prosedural lama tetap menjadi fallback saat tekstur foto belum termuat.

---

## 7. Cahaya, bayangan & post-processing

**Keputusan berdasarkan pengukuran.** Rencana awal memakai post-processing (pmndrs `postprocessing` + N8AO) di profil Sedang dan Tinggi. Hasil pengukuran di GPU acuan (Intel Iris Xe, 1080p) menunjukkan biayanya terlalu besar untuk GPU terintegrasi:

| Komponen | Biaya per frame |
|---|---|
| Composer saja (render ke target HDR + SMAA + tone mapping) | ±6 ms |
| AO layar N8AO setengah resolusi | ±16 ms |
| MSAA 2× di composer | ±16 ms |
| Bloom | ±4,5 ms |

Karena itu:

- **Rendah, Sedang, dan Tinggi** tidak memakai composer. Kedalaman datang dari:
  - **AO sudut terpanggang** (`CornerAO`): strip gradien di kaki dan puncak dinding serta tepi plafon, satu draw call;
  - **AO lantai terpanggang** dari tata letak;
  - bayangan blob karakter;
  - bayangan matahari real-time yang di-cache (Tinggi).
- **Ultra (baru, untuk GPU diskrit)** memakai composer dengan AO layar N8AO (setengah resolusi), bloom selektif, SMAA, dan tone mapping Neutral di akhir rantai. Library-nya dimuat malas (chunk terpisah ±330 KB), sehingga profil lain tidak mengunduhnya.
- **Tone mapping** tetap Neutral. Exposure tidak berubah karena composer membaca `gl.toneMappingExposure` yang sama.

---

## 8. Warna & atmosfer

| Peran | Warna | Hex |
|---|---|---|
| Dinding | Putih hangat | `#EEE9DF` |
| Plafon | Putih tulang | `#F2F0EA` |
| Lantai pelanggan | Krem granit | `#DAD3C7` |
| Lantai staf | Vinyl abu hangat | `#C8C6C0` |
| Kayu HPL | Oak hangat | `#B5895C` |
| Aksen merek | Teal / teal tua | `#129E89` / `#0E655B` |
| Aksen sekunder | Amber (info, peringatan) | `#E9A93B` |
| Logam | Aluminium / baja gelap | `#B9BEC1` / `#3B4246` |
| Eksterior | Beton / aspal | `#A7A39B` / `#3A3D40` |

| Waktu | Suasana |
|---|---|
| 07:30–10:00 | Pagi cerah; sinar matahari rendah masuk dari etalase. |
| 10:00–15:00 | Siang netral; bayangan pendek. |
| 15:00–18:00 | Sore keemasan; bayangan panjang. |
| 18:00–20:00 | Senja ke malam; interior hangat; papan nama dan lampu jalan menyala. |

---

## 9. Eksterior & kawasan (world building 2026-10-02)

Eksterior tidak lagi sekadar latar di balik dinding tak terlihat. Sekarang ia berupa **kawasan ruko kecil yang dapat dijelajahi**. Data posisinya ada di `src/game/world/district.ts`, rinciannya di PROJECT_STATUS.md "World building".

- **Tata kawasan:**
  - halaman depan deret ruko apotek;
  - jalan 2 lajur dengan zebra cross, garis henti, dan kanstin hitam-putih berlubang di mulut gang;
  - trotoar seberang dengan ubin pemandu, halte, dan teras kedai kopi;
  - gang samping kiri/kanan yang menyambung ke gang belakang (tembok & rumah warga beratap genteng/seng, jemuran, tong sampah);
  - gerbang "Kawasan Ruko Melati" di kedua ujung jalan (gapura, pagar trotoar, portal, pos satpam) sebagai batas yang terlihat.

  Di luar gerbang, jalan berlanjut dengan deretan bangunan sederhana sebagai latar.
- **Ruko bervariasi:**
  - 2 atau 3 lantai, atap datar berparapet atau pelana genteng (dengan dinding pelana);
  - balkon, teralis, toren air biru/oranye, kanopi kain miring atau seng bertopang, AC luar.

  Toko buka berupa **kios berceruk** dengan meja, etalase, atau tumpukan ban tepat di garis muka, jadi jelas dilayani dari depan dan tidak tampak bisa dimasuki. Isinya khas: renteng sachet & tabung gas 3 kg di kelontong, mesin fotokopi, etalase ponsel di konter pulsa, kaleng cat & pipa di toko bangunan, roti, printer besar di percetakan, papan menu di kedai kopi, piring lauk bertumpuk di rumah makan. Toko tutup memakai rolling door. Semua nama toko fiktif & generik.
- **Kawasan apotek:**
  - pintu bongkar muat gudang di gang kiri, dengan kanopi seng, lampu dinding, dan papan "Penerimaan Barang" berisi langkah penerimaan barang;
  - area bongkar muat bermarka kuning dengan palet;
  - mobil boks distributor (PBF) dengan kurir & troli saat ada kiriman;
  - parkir motor bergaris di halaman dan parkir motor karyawan di gang kanan;
  - jendela lantai atas di sisi samping & belakang apotek.
- **Kehidupan jalan:**
  - mobil & angkot di lajur kiri; angkot berpelat kuning dengan pintu geser terbuka di sisi trotoar;
  - pejalan kaki yang keluar dari rumah warga atau turun dari angkot, mampir ke kios/kafe, menunggu di halte, dan menyeberang lewat zebra cross;
  - penjaga kios & satpam yang menoleh saat pemain mendekat.

  Semuanya latar dan tidak memengaruhi simulasi, kecuali mobil boks yang mengikuti status kiriman.
- **Model buatan sendiri (tanpa aset baru):**
  - mobil boks, mobil, dan angkot (model ulang di fase kualitas kendaraan, lihat §9a);
  - gerbang, halte, rumah warga, dan properti gang dibangun dengan `GeoBuilder`.

  Avatar memakai Rocketbox yang sudah ada.
- **Material:**
  - paving block, aspal, plester fasad, dan ubin pemandu (foto ambientCG);
  - lantai gang & tiang beton memakai plester bertint abu-abu, karena tekstur Concrete033 terlalu gelap (rata-rata RGB ±80) dan tampak seperti tanah becek;
  - AO kontak kawasan dipanggang sekali dari collider (10 px/m).
- **Pohon ketapang kencana:** sama seperti revisi 2 (kartu daun beratlas). Motor matik dimodel ulang (§9a).
- **Properti Poly Haven:** AC luar detail hanya untuk 3 unit di apotek (dekat pemain). AC ruko latar memakai model sederhana yang digabung ke mesh kawasan. Juga papan kapur berdiri, panel listrik di mulut gang, dan meja–kursi teras kedai kopi.

Tidak dipakai: lampu jalan dan tempat sampah Poly Haven yang bergaya Eropa, serta APAR Poly Haven yang alasnya bertuliskan huruf Korea. Lampu jalan tetap memakai model modern buatan sendiri, dan APAR dibuat sendiri.

### 9a. Kendaraan & bangunan (fase kualitas kendaraan, 2026-10-02)

Audit, daftar berkas, hasil uji, dan performa ada di PROJECT_STATUS.md "Fase kualitas kendaraan". Aturan gaya yang dipakai:

- **Satu gaya dengan apotek:** semi-realistis, proporsi dunia nyata, permukaan halus berbevel, tekstur foto CC0 untuk bahan besar, detail kecil dari geometri (bukan tekstur datar). Tidak ada kotak polos atau bentuk "mainan".
- **Mobil (MPV, hatchback):**
  - siluet dari profil samping dengan **lengkung roda sungguhan** dan kap/atap berupa kurva halus; denah dibentuk ulang (sudut moncong & buritan membulat) dan kabin menyempit ke atas (tumblehome);
  - kabin kaca gelap (kaca film, lazim di Indonesia) dengan pilar A/B/C/D, atap berwarna bodi, lis krom, garis pintu yang mengitari lengkung roda, gagang, garis karakter, ambang hitam;
  - lampu depan berumah gelap dengan dua proyektor krom & garis DRL, sein, lampu belakang vertikal, lampu kabut, gril berlis krom, emblem generik, bemper berlubang udara, spion, rel atap (MPV), knalpot, antena sirip hiu, spoiler kecil;
  - ambang bawah ±0,22–0,25 m (jarak bebas mobil penumpang Indonesia), jadi bodi tidak tampak "berkaki";
  - cat `MeshPhysicalMaterial` dengan clearcoat; warna dari palet jalanan Indonesia (putih, perak, hitam, abu, sesekali merah/biru).
- **Angkot (minibus angkutan kota):** kabin di atas roda depan, kaca depan besar, jendela penumpang berbingkai, pintu geser terbuka di sisi trotoar (lubang pintu gelap, anak tangga, pegangan), lis putih, bemper krom, rak atap, papan trayek "05 MELATI – TERMINAL", pelat kuning angkutan umum, pelindung lumpur. Bus besar tidak dibuat karena tidak lazim di jalan ruko 2 lajur.
- **Mobil boks distributor:** kabin cab-over dengan kaca depan, gril, lampu persegi, spion besar bertangkai; bak aluminium bergelombang (tekstur CC0) berbingkai dengan pintu belakang dua daun dan palang pengunci; bemper berlampu; sasis, tangki, pelindung lumpur.
- **Roda (`wheelModels.ts`, dipakai semua kendaraan):** ban lathe dengan dinding samping cembung & alur tapak, velg alloy berpalang dengan **lubang sungguhan** (cakram & kaliper terlihat di baliknya), tutup tengah. Parameter `detail` menurunkan segmen untuk motor parkir dan tumpukan ban.
- **Motor matik (110–125 cc):** cover depan berbentuk V dengan topeng gelap & lampu, pelindung kaki dalam hitam, batok setang + spidometer, bodi belakang meruncing dengan stiker garis, cover bawah hitam, jok dua tingkat, begel, spakbor depan & belakang, garpu teleskopik, bak CVT + sokbreker (kiri), knalpot berpelindung panas (kanan), standar tengah, spion oval, sein, pelat hitam. Lampu motor parkir tidak menyala saat malam.
- **Pelat nomor:** tekstur kanvas dengan nomor fiktif (putih: kendaraan pribadi; kuning: angkutan umum).
- **Ruko — arketipe fasad (`shopModels.ts`), tiap ruko memakai salah satunya:**

  | Gaya | Ciri |
  |---|---|
  | `modern` | Plester beralur horizontal, jendela pita lebar, sirip aluminium, kanopi beton tipis dengan lampu sorot & fasia papan nama, etalase kaca berceruk 0,3 m di balik pintu harmonika |
  | `klasik` | Atap pelana genteng berlisplang, roster, jendela nako, pintu lipat papan kayu, pilar keramik, kanopi seng bertopang |
  | `bata` | Bata ekspos lantai atas, jendela berbingkai putih, ambang & pilar batu alam, balkon besi, kanopi kain bergaris |
  | `warung` | Terpal miring lebar, papan nama besar, etalase lauk (piring disusun bertingkat ala rumah makan Padang) |
  | `bengkel` | Kanopi seng dalam, tumpukan ban, motor servis, papan perkakas |
  | `bangunan` | Kanopi seng, papan perkakas, kaleng cat & pipa |

  Isi kios memakai **atlas barang kanvas** (`goodsAtlasTexture`): kemasan dengan kata kategori generik (tanpa merek nyata), renteng sachet, kain/batik, poster, makanan, dan barang lain. Pakaian berupa siluet kemeja bergantung. Papan nama berisi dua baris: nama toko + layanan (mis. "SEMBAKO · GAS · AIR GALON").
- **Ruko latar di luar gerbang:** 16 ruko tertutup bergaya sama (bukan kotak polos) dengan LOD 1: kisi roster, balkon, bilah nako, dan jeruji disederhanakan; pipa air & AC dihilangkan.
- **Bahan foto baru (ambientCG CC0):** bata ekspos `Bricks101`, batu alam `Tiles143`, seng gelombang `CorrugatedSteel005`, papan kayu `Planks037A`.
- **Identitas apotek tidak diubah:** fasad, kanopi beton, papan nama, dan etalase apotek tetap seperti sebelumnya.

---

## 10. Performa

**Profil kualitas (revisi 2, final)**

| Fitur | Rendah | Sedang | Tinggi | Ultra |
|---|---|---|---|---|
| Tekstur foto permukaan | albedo 512 px | albedo 1K (permukaan utama) + normal/ORM 512 | albedo + normal/ORM 1K (permukaan utama) | seperti Tinggi |
| Filter anisotropik | 1× | 4× | 8× | 8× |
| AO | lantai + sudut (terpanggang) | lantai + sudut | lantai + sudut | lantai + AO layar (N8AO) |
| Bloom / SMAA | – | – | – | ✓ / ✓ |
| Bayangan matahari real-time (di-cache) | – | – | ✓ | ✓ |
| Karakter Rocketbox | ✓ | ✓ | ✓ | ✓ |
| Lampu titik interior | 0 | 2 | 4 | 4 |
| Antialias / DPR maks | – / 1 | MSAA kanvas / 1,25 | MSAA kanvas / 2 | SMAA / 2 |

**Anggaran.** Acuan: Intel Iris Xe, 1920×1080, rata-rata 5 sudut pandang.

| Anggaran | Rendah | Sedang | Tinggi | Hasil (§12) |
|---|---|---|---|---|
| Waktu render per frame | ≤ 6 ms | ≤ 10 ms | ≤ 14 ms | Revisi 2: Rendah ✅ · Sedang ⚠️ di batas (9,5–11,5 ms) · Tinggi ✅. Fase kendaraan (2026-10-03, 5 sudut pandang luar): Rendah 6,19 ms ⚠️ · Sedang 10,43 ms ⚠️ di batas · Tinggi 12,36 ms ✅ |
| Draw call (tampilan terberat) | ≤ 350 | ≤ 350 | ≤ 350 | Interior ≤ 300 ✅ · tampilan jalan 371–407 ❌ (sudah > 350 sebelum fase kendaraan; lihat §13) |
| Segitiga (tampilan terberat) | ≤ 400 rb | ≤ 400 rb | ≤ 400 rb | ±224 rb (revisi 2) → 335 rb setelah fase kendaraan ✅ |
| Unduhan aset 3D saat masuk permainan | ≤ 10 MB | ≤ 20 MB | ≤ 20 MB | 5,1 / 6,7 / 8,3 MB ✅ |

**Teknik**
- Instancing untuk produk.
- Geometri statis digabung per material.
- Aset dimuat malas dan di-cache.
- Kompresi meshopt; tekstur WebP/JPEG berukuran sesuai jarak pandang.
- Environment map dirender sekali; shadow map di-cache.
- Render sesuai permintaan saat panel terbuka.
- **Culling berbasis posisi kamera** (pengganti occlusion culling, world building 2026-10-02):
  - isi apotek tidak dirender dari gang/gang belakang;
  - ruang belakang hanya dirender bila terlihat lewat pintu yang terbuka;
  - NPC & kendaraan di luar hanya dirender dari dalam apotek bila garis pandangnya menembus kaca etalase.
- **LOD animasi avatar:** avatar tersembunyi tidak diperbarui; avatar jauh atau di belakang kamera diperbarui tiap 3/6 frame.
- **Kawasan:**
  - papan nama dalam satu atlas;
  - kotak latar tanpa tepi bulat;
  - lalu lintas instanced;
  - satu lapisan AO lantai transparan di setiap titik.
- **Kendaraan & ruko (fase kualitas kendaraan):**
  - roda lalu lintas: 3 `InstancedMesh` (ban, velg, bagian gelap) untuk semua kendaraan; putaran & belokan dihitung di matriks instance;
  - bayangan kontak instanced (satu bidang ber-alphaMap per kendaraan) sehingga kendaraan tetap menapak di profil tanpa bayangan matahari;
  - busur lubang velg memakai kerapatan sudut yang sama dengan lingkar luar (velg mobil 3.672 → 792 segitiga);
  - parameter `detail` roda (motor parkir 0,3; tumpukan ban 0,35; lalu lintas 0,7);
  - ruko latar memakai LOD 1; geometri motor dibuat sekali lalu dipakai ulang.
- Pengukuran memakai benchmark GPU asli (Chromium + ANGLE/D3D11):
  - satu frame penuh = logika + render + post-processing, lewat `__pharmacyDebug.frame()` khusus mode dev;
  - pemanasan 20 frame, lalu median 3 batch × 30 frame, disinkronkan dengan `readPixels`.

---

## 11. Rencana bertahap

| Tahap | Isi | Status |
|---|---|---|
| V1–V7 (revisi 1) | Fondasi render, tekstur prosedural, arsitektur, perabot, karakter prosedural, atmosfer, optimasi | ✅ Selesai |
| **R1 Pipeline aset** | Skrip `scripts/assets/` (tekstur, model, karakter, kredit), `public/assets/`, manifest hasil, loader malas dengan fallback, `ASSET_CREDITS.md`, tes kelengkapan berkas | ✅ Selesai |
| **R2 Render & cahaya** | Post-processing diukur. Hasilnya terlalu berat untuk GPU terintegrasi, sehingga dipindah ke profil **Ultra** baru (dimuat malas). Profil lain memakai AO sudut terpanggang | ✅ Selesai (diubah dari rencana) |
| **R3 Material foto** | 12 set ambientCG dengan skala fisik, kontras albedo diratakan untuk permukaan bersih; tekstur prosedural tetap menjadi cadangan | ✅ Selesai |
| **R4 Karakter** | 25 avatar Rocketbox + 6 varian busana berjilbab, 7 klip motion capture per gender, skala postur Indonesia, fallback prosedural | ✅ Selesai |
| **R5 Perabot & dressing apotek** | Properti Poly Haven, set dressing khas Indonesia (§4), panel merek meja, rak resep lebih penuh pada stok normal | ✅ Selesai |
| **R6 Eksterior** | Paving/aspal/ubin pemandu foto, pohon ketapang, motor matik, properti CC0, kehidupan jalan | ✅ Selesai |
| **R7 Optimasi & verifikasi** | Benchmark GPU 4 profil, ukuran unduhan, pemecahan chunk, uji unit + E2E, dokumentasi | ✅ Selesai |

Setiap tahap mengikuti siklus yang sama:
1. Implementasi.
2. Tangkapan layar dari 14 sudut pandang tetap di browser.
3. Ukur waktu render dan `renderer.info`.
4. Jalankan seluruh tes.
5. Perbarui dokumen ini.

---

## 12. Hasil pengukuran

> **Fase kualitas kendaraan (2026-10-03):** A/B berselang-seling melawan commit sebelum fase, sesi yang sama, rata-rata 5 sudut pandang luar: +0,17 ms (Rendah), +0,37 ms (Sedang), +0,67 ms (Tinggi), atau +3–6%. Interior di dalam derau. Segitiga tampilan terberat 335 rb. Rincian & optimasi ada di PROJECT_STATUS.md "Fase kualitas kendaraan → Performa".
>
> **World building (2026-10-02):** pengukuran setelah kawasan, lalu lintas, dan pejalan kaki ditambahkan ada di PROJECT_STATUS.md "World building → Performa". Perbandingan dibuat dengan A/B di sesi yang sama: rata-rata 5 sudut pandang ±+0,7 ms (Rendah), ±−0,5 ms (Sedang), ±+1,0 ms (Tinggi). Tampilan interior setara atau lebih cepat berkat culling; tampilan jalan lebih berat. Angka absolut di bawah ini berasal dari sesi 2026-10-01 dan tidak dapat dibandingkan langsung dengan sesi berikutnya karena variansi iGPU.

**Revisi 1**: waktu render rata-rata 5 sudut pandang, Iris Xe, 1920×1080, sebelum → sesudah V1–V7.

| Kualitas | Sebelum | Sesudah |
|---|---|---|
| Rendah | 4,18 ms | 4,35 ms |
| Sedang | 4,41 ms | 6,22 ms |
| Tinggi | 6,68 ms | 8,12 ms |

Keterbatasan: diukur di satu perangkat; angka ini waktu render GPU, bukan FPS penuh.

**Revisi 2.** GPU Intel Iris Xe, 1920×1080. Waktu frame penuh (logika + render), median 3 batch × 30 frame setelah pemanasan, rata-rata 5 sudut pandang. Angkanya berfluktuasi ±1–2 ms antarputaran karena laptop yang sama juga menjalankan server pengembangan, dan sesekali ada pemuatan avatar atau kompilasi shader.

| Kualitas | Rata-rata | Rentang beberapa putaran | Tampilan terberat (jalan) | Anggaran |
|---|---|---|---|---|
| Rendah | 5,9 ms | 5,7–5,9 ms | 7,7–8,5 ms | ≤ 6 ms ✅ |
| Sedang | 11,5 ms | 9,5–11,5 ms | 10–17 ms | ≤ 10 ms ⚠️ batas |
| Tinggi | 13,4 ms | 10,0–13,4 ms | 13–18 ms | ≤ 14 ms ✅ |
| Ultra | 38 ms | — | 40 ms | khusus GPU diskrit |

Rincian biaya tampilan utama (Sedang, pintu masuk ke arah meja, 8,3 ms): permukaan besar bertekstur foto (lantai, dinding, plafon, kayu) ±3 ms. Avatar, pohon, dekorasi, dan AO sudut masing-masing di bawah derau pengukuran (< 1 ms).

| Ukuran | Nilai |
|---|---|
| Unduhan aset 3D saat bermain (masuk + 15 detik pertama) | Rendah 5,1 MB · Sedang 6,7 MB · Tinggi 8,3 MB (anggaran ≤ 10/20/20 MB ✅) |
| Total aset di repositori (semua varian & resolusi) | ±24 MB |
| Chunk JavaScript post-processing (hanya Ultra) | 332 KB (gzip 162 KB), tidak diunduh profil lain |
| Draw call / segitiga (tampilan terberat) | ±407 / ±224 rb |

Keterbatasan pengukuran: satu perangkat saja, diukur di build pengembangan, tanpa perangkat seluler.

---

## 13. Keterbatasan & solusi realistis

| Keterbatasan | Dampak | Solusi |
|---|---|---|
| Wajah Rocketbox didominasi ras Eropa | Pasien kurang terasa Indonesia | Dipilih avatar Asia, sawo matang, dan berjilbab; ke depan bisa memakai MakeHuman (CC0) atau model buatan sendiri |
| Hanya 2 avatar berjilbab yang sesuai | Variasi jilbab terbatas | Sebagian teratasi dengan 6 varian warna busana (8 tampilan). Varian abaya punya artefak kecil di pergelangan (hanya terlihat sangat dekat). Mesh jilbab buatan sendiri untuk avatar lain adalah lanjutan berikutnya |
| Animasi Rocketbox tanpa gerak wajah/jari bermakna | Wajah statis saat berbicara | Klip berbicara memakai gestur tubuh; blendshape visem Rocketbox tersedia di repositori sumber bila kelak dibutuhkan |
| Tidak ada model gratis untuk perabot apotek, motor matik, kendaraan Indonesia (angkot, MPV), dan pohon tropis | Harus dibuat sendiri | Dibuat dari kode dengan detail dan tekstur foto (motor & kendaraan dimodel ulang 2026-10-02, §9a). Dari sangat dekat, panel hasil ekstrusi belum semulus model DCC. Pilihan realistis berikutnya: model di Blender atau membeli aset berlisensi jelas |
| Kaca kendaraan gelap, tanpa pengemudi & interior kabin | Kendaraan bergerak tanpa sosok di dalamnya (tertutup kaca film) | Disengaja: kaca transparan butuh pengurutan transparansi + interior + avatar tambahan per kendaraan. Lanjutan: kaca semi-transparan + siluet pengemudi untuk LOD dekat |
| Tidak ada motor yang melaju di jalan | Lalu lintas hanya mobil & angkot | Perlu pengendara beranimasi (pose duduk Rocketbox) dan sistem roda instanced untuk motor; direkomendasikan untuk fase berikutnya |
| Post-processing (AO layar, bloom) terlalu berat untuk GPU terintegrasi | Profil Sedang dan Tinggi tanpa AO layar | AO sudut dan AO lantai terpanggang; AO layar tersedia di profil Ultra untuk GPU diskrit |
| Profil Sedang di batas anggaran 10 ms pada tampilan jalan | Penurunan FPS saat menatap jalan dari teras | DPR Sedang diturunkan ke 1,25; urutan gambar permukaan latar (`LATE_DRAW`) menghemat ±0,3 ms. Opsi lanjutan: atlas bahan kendaraan, gabungan material ruko yang mirip, LOD avatar jauh |
| Tekstur foto dan model menambah ukuran unduhan | Muat awal lebih lama | Tekstur ≤ 1K WebP, meshopt, lazy loading per avatar, profil Rendah 512 px; terukur 5–8 MB per sesi |
| Kompresi tekstur GPU (KTX2/Basis) butuh encoder `toktx` yang tidak tersedia di lingkungan ini | Memori GPU lebih besar dibanding KTX2 | Ukuran tekstur dibatasi; KTX2 bisa ditambahkan di pipeline nanti tanpa mengubah kode game |
| GI/lightmap terpanggang butuh unwrap UV2 dan path tracer offline | Belum ada pantulan cahaya antarpermukaan yang nyata | AO terpanggang sebagai pendekatan; lightmap dipertimbangkan setelah tata letak final |
| Pengukuran performa hanya di satu laptop | Belum tahu perilaku di GPU lain atau seluler | Uji di perangkat lain; profil Rendah sebagai cadangan |

---

## 14. Aset & lisensi

Daftar lengkap ada di [`ASSET_CREDITS.md`](ASSET_CREDITS.md). Aset buatan sendiri (geometri prosedural, tekstur kanvas, kemasan produk, audio) tetap dibuat di dalam kode.
