# Art Direction — Pharmacy 3D Simulator

_Versi 1.1 · 2026-10-01 · Status: tahap V1–V6 diimplementasikan, V7 diverifikasi (lihat [bagian 9](#9-rencana-bertahap) & [bagian 11](#11-hasil-pengukuran))_

Dokumen ini menetapkan arah visual baru: **stylized realistic**. Lingkungan apotek harus terasa nyata dan punya identitas, tanpa mengorbankan keterbacaan gameplay dan performa. Semua sistem gameplay tetap dipertahankan; perubahan hanya pada lapisan visual (`src/game/**`).

---

## 1. Audit kondisi awal

Diukur pada build pengembangan, kualitas grafis **Sedang**, 1280×720, Chromium + SwiftShader (render perangkat lunak). Waktu frame SwiftShader hanya dipakai sebagai pembanding relatif, bukan FPS nyata di GPU.

| Metrik | Nilai awal |
|---|---|
| Mesh di scene | 322 (6 instanced) |
| Material unik | 102 |
| Lampu | 9 (tanpa bayangan di Rendah/Sedang) |
| Draw call per frame | 36–314 (terberat: tampilan dari jalan 314, pintu masuk 231) |
| Segitiga per frame | 0,4 rb–13,7 rb |
| Tekstur | 27–29 (seluruhnya label teks) |

**Temuan visual**

1. **Bentuk** — semua objek berupa kotak bersudut tajam tanpa bevel, plint, kusen, atau trim, sehingga terkesan seperti balok mainan.
2. **Material** — warna datar tanpa tekstur, kekasaran seragam, tanpa pantulan lingkungan; logam tampak seperti plastik dan kaca tidak meyakinkan.
3. **Pencahayaan** — hemisfer + ambient + 6 lampu titik membuat cahaya rata tanpa kedalaman, dengan titik silau besar di plafon.
4. **Grounding** — tidak ada bayangan kontak/AO di kualitas Rendah/Sedang; perabot dan karakter tampak melayang.
5. **Produk** — kubus warna acak dalam grid seragam, tidak mencerminkan produk di katalog.
6. **Karakter** — humanoid dari 14 kotak (mirip Roblox), mata kotak hitam, tanpa leher, tangan, atau kaki; animasi hanya ayunan kaki; pasien "duduk" dengan turun 0,35 m menembus lantai.
7. **Signage** — label datar melayang tanpa penggantung atau bingkai.
8. **Eksterior** — bidang rumput polos, pohon ikosahedron, langit satu warna, tanpa bangunan sekitar; fasad tanpa kedalaman.
9. **Atmosfer** — pencahayaan identik sepanjang hari padahal jam permainan berjalan 07:30–20:00.
10. **Warna** — dominan putih/abu + teal, ditambah konfeti warna jenuh acak dari produk; terkesan steril dan tidak terarah.
11. **Performa** — jumlah segitiga sangat kecil, tetapi draw call tinggi karena setiap primitif adalah mesh terpisah (±14 draw call per karakter, 5 material baru per karakter).

---

## 2. Arah visual: stylized realistic

**Konsep:** apotek lingkungan modern di sebuah **ruko di Indonesia** — bersih, hangat, ramah, dan tenang. Bentuk disederhanakan secukupnya agar tetap ringan dan mudah dibaca, tetapi proporsi, material, dan cahaya mengikuti dunia nyata. Semua merek bersifat fiktif; tidak meniru jaringan apotek nyata.

**Pilar**

1. **Skala & proporsi nyata** — ukuran metrik (meja 1,05 m, rak 2 m, pintu 2,1 m).
2. **Tepi lunak** — benda keras diberi bevel 0,5–2 cm agar menangkap highlight; tidak ada kotak tajam murni.
3. **Material berlapis** — warna dasar + variasi kekasaran + detail normal halus; tidak ada putih murni maupun hitam murni.
4. **Cahaya bermotivasi** — setiap cahaya punya sumber yang terlihat (panel plafon, etalase, papan nama), dan setiap area punya gradien cahaya.
5. **Grounding** — setiap objek dan karakter punya bayangan kontak/AO.
6. **Palet terkendali** — ±60% netral hangat, ±30% kayu & batu, ±10% aksen teal; warna produk tertata per kategori.
7. **Keterbacaan gameplay di atas segalanya** — stasiun interaktif, signage, dan status pasien tetap jelas.
8. **Data menggerakkan visual** — isi rak, kondisi pasien, waktu, dan peningkatan terlihat langsung di dunia 3D.

---

## 3. Arsitektur & interior

| Elemen | Arah |
|---|---|
| Fasad | Ruko satu lantai: kanopi di atas etalase, kotak rolling door di atas kaca, panel nama teal dengan huruf timbul bercahaya dan tanda plus menyala, kaca etalase berbingkai aluminium, teras keramik, area parkir paving block di depan. |
| Lantai | Area pelanggan: keramik/granit 60×60 krem muda bernat tipis, agak mengilap. Area staf & ruang belakang: vinyl abu hangat. Lab: epoksi mint pucat. |
| Dinding | Cat putih hangat bertekstur halus, plint abu gelap 10 cm, panel aksen teal + logo di belakang meja pelayanan. |
| Plafon | Gipsum dengan grid panel 60×60, lampu panel LED terbenam; area staf memakai lampu yang sama agar konsisten. |
| Pintu dalam | Kusen aluminium, daun pintu HPL krem, plakat ruang di atas pintu; pintu perluasan yang terkunci diberi pita/tanda jelas. |
| Signage | Papan gantung berbingkai dengan kabel penggantung (tidak melayang), tipografi seragam, warna sesuai fungsi (teal = layanan, biru = info, oranye = terkunci). |

---

## 4. Rak, produk, meja pelayanan & peralatan

| Objek | Arah |
|---|---|
| Meja pelayanan & kasir | Modul panjang: muka HPL kayu oak + strip teal, top solid surface putih bertepi bulat, kick plate gelap dengan lis cahaya, sekat akrilik di loket, monitor, printer etiket, mesin EDC generik. |
| Rak obat bebas | Gondola dengan papan belakang berlubang (pegboard), price strip putih tiap tingkat, header kategori, produk menghadap depan. |
| Rak obat resep | Lemari tinggi di belakang meja: rak terbuka di atas dan laci kecil di bawah. |
| **Produk** | Kemasan prosedural **dari katalog obat**: kotak (tablet/kapsul/kaplet), botol sirup/cairan bertutup, tube salep, sachet di kotak display, kotak alat kesehatan. Label memuat nama & kekuatan dengan pita warna per kategori. **Jumlah facing mengikuti stok rak sebenarnya.** Logo golongan obat (bebas/bebas terbatas/keras) sengaja **tidak** digambar karena data golongan belum ada di katalog — perlu verifikasi data dulu agar tidak menyesatkan. |
| Lemari pendingin | Bodi putih, pintu kaca berbingkai, rak kawat, lampu dalam, display suhu digital 2–8 °C. |
| Kursi tunggu | Kursi gandeng rangka krom dengan dudukan berlubang (khas ruang tunggu di Indonesia). |
| Lab racik | Meja stainless dengan backsplash, timbangan digital, mortir & stamper porselen, gelas ukur, rak toples bahan berlabel. |
| Gudang | Rak besi dengan kardus berlabel, palet kayu. |
| Administrasi | Meja kerja kayu, kursi kantor, monitor, lemari arsip, papan denah. |
| Sorotan interaksi | Siku sudut (corner bracket) teal yang rapi, bukan kotak wireframe dengan garis diagonal. |

---

## 5. Karakter & animasi

**Gaya:** proporsi realistis yang sedikit disederhanakan (±7 kepala), bentuk halus (kapsul, lathe), wajah sederhana (mata, alis, hidung) tanpa tekstur rumit.

**Variasi (fiktif):** warna kulit nusantara; rambut pendek, cepak, panjang terikat, sanggul; jilbab; peci dan postur sedikit membungkuk untuk lansia; kacamata; kaos, kemeja, blus, rok panjang/gamis, celana panjang. Pegawai: apoteker berjas putih, asisten polo teal, kasir kemeja biru, petugas gudang rompi oranye, manajer kemeja gelap.

**Teknik:** satu `SkinnedMesh` per karakter (±12 tulang, skinning kaku) dengan satu material bersama berbasis warna verteks → **1 draw call per karakter** (sebelumnya ±14).

**Animasi prosedural berbasis status gameplay**

| Status | Animasi |
|---|---|
| Berjalan | Siklus paha–lutut, ayunan lengan berlawanan, goyang pinggul, kepala stabil; lansia lebih lambat. |
| Menunggu | Bernapas, pindah tumpuan, sesekali menoleh. |
| Tidak sabar (kesabaran < 35%) | Mengetuk kaki, bersedekap, melihat jam. |
| Dilayani | Mengangguk dan gestur tangan saat berbicara. |
| Menunggu racikan/resep | Pose duduk sungguhan di kursi tunggu. |
| Pergi kesal | Kepala tertunduk, langkah cepat. |
| Pegawai bekerja | Gerak tangan mengetik/menyerahkan barang. |

---

## 6. Material, tekstur, pencahayaan & bayangan

- **Material PBR** (`MeshStandardMaterial`) dengan **tekstur prosedural** yang dibuat dari kode saat scene dimuat (canvas): albedo, roughness, dan normal map untuk keramik, cat, plafon, kayu HPL, logam sikat, paving, aspal, dan plester. Resolusi menyesuaikan kualitas grafis. UV memakai skala dunia (meter) sehingga tekstur konsisten tanpa salinan per objek.
- **Cahaya lingkungan (IBL)**: environment map dibuat di dalam scene (Lightformer: panel plafon, cahaya etalase, pantulan lantai) dan dirender **sekali**. Ini memberi cahaya ambien dan pantulan yang meyakinkan pada lantai mengilap, kaca, dan logam, tanpa unduhan HDRI.
- **Rig cahaya**: matahari (directional) dari arah etalase yang mengikuti jam permainan, sedikit lampu titik interior (Rendah 0, Sedang 2, Tinggi 4) untuk gradien antarzona, panel emisif sebagai sumber yang terlihat, plafon "menyala sendiri" (emisif bertekstur) agar tidak ada titik silau lampu, **genangan cahaya terpanggang** di lantai di bawah setiap panel, dan halo cahaya palsu (sprite aditif) untuk kesan glow tanpa post-processing.
  _Penyesuaian dari rencana:_ lampu sorot (spot) sempat dipakai, tetapi diganti karena biaya per pikselnya paling besar; efek "kolam cahaya" kini dipanggang ke tekstur lantai.
- **Bayangan**: AO lantai **terpanggang (baked)** dari data tata letak (satu tekstur, satu draw call, ikut berubah saat perabot/ruang bertambah), bayangan blob di bawah karakter, sinar matahari yang menembus etalase diproyeksikan ke lantai (Rendah/Sedang), dan bayangan matahari real-time **hanya di kualitas Tinggi** — shadow map di-cache dan hanya diperbarui saat matahari bergerak atau sekali per detik.
- **Malam hari**: material luar ruangan meredam pantulan IBL-nya sendiri (environment map dipasang per material), sehingga fasad dan jalan menjadi gelap sementara interior tetap terang; jendela tetangga, lampu jalan, downlight kanopi, dan tanda plus menyala.
- **Tone mapping** Neutral (Khronos PBR Neutral) dengan exposure terkalibrasi sehingga warna merek tetap akurat. AgX sempat dicoba, tetapi membuat teal merek dan kulit karakter tampak pudar.

---

## 7. Warna & atmosfer

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

**Atmosfer mengikuti jam permainan**

| Waktu | Suasana |
|---|---|
| 07:30–10:00 | Pagi cerah; sinar matahari rendah masuk dari etalase, langit biru muda. |
| 10:00–15:00 | Siang netral, terang merata, bayangan pendek. |
| 15:00–18:00 | Sore keemasan; cahaya hangat, bayangan panjang. |
| 18:00–20:00 | Senja → malam; langit biru gelap, interior terasa hangat, papan nama dan lampu jalan menyala. |

---

## 8. Strategi performa

**Profil kualitas**

| Fitur | Rendah | Sedang | Tinggi |
|---|---|---|---|
| Resolusi tekstur prosedural | 256 px | 512 px | 1024 px |
| Normal & roughness map | – | ✓ | ✓ |
| Filter anisotropik | 1× | 4× | 8× |
| Lampu titik interior | 0 | 2 | 4 |
| Bayangan matahari real-time (di-cache) | – | – | ✓ |
| Sinar matahari terproyeksi ke lantai | ✓ | ✓ | – (memakai bayangan asli) |
| Halo cahaya | – | ✓ | ✓ |
| Detail eksterior jauh (pohon & tiang listrik seberang jalan) | – | ✓ | ✓ |
| Antialias / DPR maks | – / 1 | ✓ / 1,5 | ✓ / 2 |

**Anggaran (direvisi setelah pengukuran)** — acuan GPU terintegrasi Intel Iris Xe, 1920×1080, rata-rata 5 sudut pandang:

| Anggaran | Rendah | Sedang | Tinggi |
|---|---|---|---|
| Waktu render per frame | ≤ 5 ms | ≤ 7 ms | ≤ 9 ms |
| Draw call (tampilan terberat) | ≤ 300 | ≤ 300 | ≤ 300 |
| Segitiga (tampilan terberat) | ≤ 200 rb | ≤ 200 rb | ≤ 200 rb |

Anggaran draw call awal (150/220/260) **tidak tercapai**: label teks kanvas (setiap papan 1–2 draw call), produk ber-instance per rak, dan deretan ruko menambah draw call. Karena waktu render tetap jauh di bawah 16,7 ms (60 FPS), anggaran direvisi berdasarkan waktu frame yang terukur, bukan jumlah draw call.

**Teknik**

- **Penggabungan geometri statis** per material melalui `GeoBuilder`; detail bertambah tanpa menambah draw call.
- **LOD bevel otomatis**: bagian tipis memakai kotak biasa, bagian kecil 1 segmen lengkung, bagian besar 2 segmen (segitiga turun ±40% tanpa perubahan visual).
- **Instancing** untuk produk; satu atlas kemasan dengan UV per instance.
- **Material bersama**; **satu material untuk semua karakter** (warna verteks, 1 draw call per karakter, geometri dibagi antarkarakter bergaya sama).
- **Tekstur prosedural di-cache** dan dibuat sekali; tanpa unduhan aset.
- **Environment map dirender sekali**, bukan per frame.
- **Shadow map di-cache** (kualitas Tinggi): karakter memakai bayangan blob sehingga semua penghasil bayangan matahari statis.
- Overlay lantai (AO & genangan cahaya) masing-masing satu bidang; raycast interaksi tidak menguji instance produk.
- **Render sesuai permintaan saat panel terbuka**: selama panel/modal menutupi scene, scene 3D tidak dirender ulang setiap frame (hemat GPU & baterai); logika permainan tetap berjalan.
- **Pengukuran**: `renderer.info` + benchmark render di GPU asli melalui Chromium headless (ANGLE/D3D11). SwiftShader (render CPU) **tidak** representatif untuk performa GPU dan hanya dipakai untuk uji E2E.

---

## 9. Rencana bertahap

| Tahap | Isi | Status |
|---|---|---|
| V1 Fondasi render | Tone mapping Neutral, IBL dari Lightformer, rig cahaya, langit gradien & model siang–malam, alat ukur render. | ✅ Selesai |
| V2 Material & grounding | Tekstur prosedural PBR (keramik, cat, plafon, vinyl, epoksi, kayu, logam, paving, aspal, plester, pegboard, rolling door), UV skala meter, AO lantai terpanggang, genangan cahaya, bayangan blob. | ✅ Selesai |
| V3 Arsitektur | Plint, kusen pintu & gagang tuas, plafon grid + panel LED, dinding merek, fasad ruko 2 lantai (kanopi, kotak rolling door, papan nama, jendela atas, unit AC, tanda plus menyala), papan label bergaya signage. | ✅ Selesai |
| V4 Perabot & produk | Meja pelayanan HPL + lis LED + sekat akrilik, etalase kaca, gondola pegboard + price strip, lemari resep berlaci (A–L / M–Z), kulkas farmasi, kursi gandeng, lab stainless, timbangan, mortir, gudang rak besi, kantor, **kemasan dari katalog yang mengikuti stok**, siku sorot interaksi. | ✅ Selesai |
| V5 Karakter | Rig skinned prosedural 12 tulang, variasi kulit/rambut/jilbab/peci/kacamata/pakaian, seragam per peran, animasi berjalan, menunggu, tidak sabar, dilayani, duduk, bekerja, pergi kesal; kain rok/jas berbobot halus. | ✅ Selesai |
| V6 Atmosfer & eksterior | Siklus waktu (pagi–malam), sinar matahari lewat etalase, deretan ruko fiktif, parkir paving, kanstin hitam-putih, jalan bermarka, lampu jalan, tiang & kabel listrik, pohon, motor parkir, material luar meredup saat malam. | ✅ Selesai |
| V7 Optimasi & verifikasi | LOD bevel, shadow map cache, pemangkasan material, pengukuran akhir, unit test logika visual, uji regresi gameplay. | ✅ Selesai (lihat bagian 11) |

Setiap tahap: implementasi → tangkapan layar dari sudut pandang tetap → ukur waktu render & `renderer.info` → jalankan seluruh tes → perbarui dokumen ini.

---

## 10. Aset & lisensi

Semua model, tekstur, dan animasi **dibuat dari kode** di repositori ini, tanpa aset eksternal maupun berbayar. Bila kelak memakai aset luar (mis. CC0), sumber dan lisensinya wajib dicatat di README.
