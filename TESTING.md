# Pengujian — Pharmacy 3D Simulator

## Cara menjalankan

| Perintah | Isi |
|---|---|
| `npm run typecheck` | Pemeriksaan tipe TypeScript (`tsc -b`) |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm test` | Vitest — unit, integrasi, komponen (jsdom), persistensi (fake-indexeddb), serta pemeriksaan hasil pipeline aset (`scripts/assets/*.test.mjs`, lingkungan Node) |
| `npm run test:e2e` | Playwright — membangun build produksi lalu menjalankan `vite preview` di port 4173 (tidak bentrok dengan `npm run dev` yang sedang dipakai bermain); perlu `npx playwright install chromium` sekali. Port dapat diganti dengan `E2E_PORT` (PowerShell: `$env:E2E_PORT=4180; npm run test:e2e`). Bila server preview lama masih menyala di port itu, server tersebut dipakai ulang — matikan dulu agar build terbaru yang diuji. |
| `npm run build` | Build produksi |
| `npm run check` | typecheck + lint + test + build |

E2E berjalan terhadap build produksi (sama dengan yang di-deploy) agar halaman tidak di-reload oleh HMR/optimasi dependensi dev server. E2E memakai WebGL perangkat lunak (SwiftShader) agar scene 3D benar-benar dirender di lingkungan tanpa GPU, dan opsi aksesibilitas **Akses cepat stasiun** agar stasiun dapat dibuka tanpa navigasi 3D (pointer lock tidak andal di browser headless).

## Skenario pengujian

### Unit (`src/tests/unit`)

| Berkas | Cakupan |
|---|---|
| `inventory.test.ts` | Pemilihan batch FEFO (lewati kedaluwarsa, urutan, kekurangan), rekomendasi + alasan, saran pindah dari gudang, pemindahan rak↔gudang dengan catatan, isi ulang rak, pemusnahan kedaluwarsa (kerugian nonkas, kas tetap), tolak musnah batch belum ED, stock opname wajib alasan, kapasitas & peningkatan, dasbor |
| `prescriptions.test.ts` | Validasi resep (benar, salah kekuatan/jumlah/aturan pakai, FEFO, batch ED, kelengkapan & etiket), penyerahan mengurangi stok & membuat transaksi, idempoten, gagal validasi tidak mengubah stok, laporan masalah + konfirmasi, penolakan benar/salah |
| `pos.test.ts` | Transaksi (stok FEFO, kas, buku besar, HPP, pasien selesai), anti pemrosesan ganda, obat resep & bahan racik tidak dijual bebas, batas stok rak, produk tidak sesuai keluhan, pasien pembatal, promo diskon |
| `procurement.test.ts` | Alur pesan→kirim→tiba→terima (kas & inventaris), minimum order & kas tidak cukup, refund pembatalan, rekomendasi pengadaan |
| `compounding.test.ts` | Penilaian racikan (sempurna, di luar toleransi, urutan, wadah), alur pasien→racik→kasir, bahan terpakai saat gagal, gating peralatan |
| `progression.test.ts` | Misi (baseline, klaim sekali, misi berantai), level membuka fitur, Learning Mode, pencapaian, perhitungan laba/rugi, biaya & gating peningkatan |
| `persistence.test.ts` | Simpan→muat identik (IndexedDB), slot kosong & hapus, data rusak, migrasi v0→v1, tolak skema lebih baru, validasi pengaturan |
| `tutorial.test.ts` | Sinyal gerak diterima walau pemain berjalan sebelum langkah "Bergerak", membuka apotek di langkah awal langsung memunculkan pasien tutorial, pasien acak ditahan hanya selama pasien tutorial masih dilayani |
| `visual.test.ts` | Model siang–malam (arah & intensitas matahari, malam), tata letak produk dari stok (rak kosong tanpa stok, dalam batas tingkat & tidak bertumpuk, tersebar ke beberapa tingkat, lebih padat saat stok tinggi), bentuk kemasan per sediaan, cache tekstur prosedural, builder geometri (gabung per material, UV meter), gaya karakter deterministik & bobot skinning valid. **Revisi 2:** pemetaan pemeran avatar (deterministik, selalu menunjuk avatar yang tersedia, apoteker berjas putih, varian berjilbab ≥ 6, berpeci → baju koko), status gameplay → klip motion capture, AO sudut hanya di dalam bangunan, hanya profil Ultra yang memakai post-processing, dan pengaturan lama tetap valid (`ultra` diterima, nilai asing ditolak) |
| `scripts/assets/assets.test.mjs` | Kelengkapan hasil pipeline aset (lingkungan Node): setiap tekstur foto punya albedo/normal/ORM di semua ukuran, setiap avatar & pustaka animasi ada dengan klip untuk semua status, lisensi MIT Rocketbox disertakan, setiap model CC0 ada dan ≤ 15 rb segitiga |
| `world.test.ts` | **World building:** flood fill keterjangkauan pada collider (grid 0,2 m, radius pemain 0,3) dari titik muncul ke halaman, ujung kawasan, zebra cross, trotoar seberang, halte, kios, gang samping & belakang, area bongkar muat, gudang lewat pintu bongkar muat, dan ruang dalam; area tertutup (dalam ruko, luar gerbang, balik tembok belakang) tidak terjangkau; pintu bongkar muat tertutup memisahkan gudang dari gang; van parkir & motor karyawan tidak menutup jalur; rute pasien, graf pejalan kaki (terhubung), rute van, dan lajur bebas collider; properti jalan tidak tumpang tindih atau masuk bangunan; batas dunia tertutup struktur yang terlihat |
| `traffic.test.ts` | Lalu lintas: berhenti di garis henti saat ada orang di zebra cross lalu jalan lagi, berhenti untuk orang di lajur, jaga jarak dengan kendaraan diam, angkot berhenti di halte, simulasi 240 detik tanpa tumpang tindih. Mobil boks: datang saat ada kiriman → parkir di area bongkar muat (posisi & arah) → pergi setelah diterima, menunggu lajur timur kosong sebelum mundur ke jalan (tanpa kebuntuan), berhenti untuk orang di gang |
| `pedestrians.test.ts` | Graf pejalan kaki: semua tujuan terjangkau dari setiap pintu rumah, penyeberangan jalan hanya lewat zebra cross, rencana kegiatan berakhir di rumah/halte dan tidak memakai kafe dua kali, titik kegiatan tidak di dalam collider |
| `ai.test.ts` | Pemeriksaan ketersediaan proxy (`/health` ok/404/offline), AI tidak dipanggil bila proxy tidak tersedia, fallback lokal saat AI mati/proxy gagal/respons salah format, sanitasi keluaran AI (tolak instruksi dosis), ulasan dari data laporan, petunjuk tutor berbasis kondisi |

### Integrasi (`src/tests/integration/gameplay.test.ts`)

Hari penuh buka→tutup dengan laporan dari transaksi; gaji dibayar saat tutup; kasir otomatis menyelesaikan pembayaran; petugas gudang mengisi rak; asisten melayani pasien OTC (pegawai memengaruhi pelayanan); lonjakan pasien mengubah interval kedatangan lalu berakhir; pemeriksaan inventaris mendenda batch ED; ruang tunggu menambah kapasitas antrean; Challenge Mode (kondisi awal, target, kalah saat batas hari); Learning Mode (tidak bangkrut, kesabaran lebih lambat); Career Mode bangkrut setelah 3 hari di bawah batas kredit.

### Komponen (`src/tests/components/panels.test.tsx`)

Menu utama; alur UI pelayanan obat bebas → kasir → pembayaran; klik ganda tombol bayar tidak menggandakan uang; klaim hadiah misi; pemusnahan batch kedaluwarsa dari panel inventaris; toggle AI di Pengaturan nonaktif & bertanda "Tidak tersedia" tanpa proxy, aktif bila proxy terhubung.

### End-to-end (`e2e/gameplay.spec.ts`)

1. **Alur utama (Mode Karier)**: permainan baru → tutorial (sambutan, lewati langkah gerak, buka apotek) → layani pasien tutorial (keluhan sakit kepala → parasetamol) → bayar di kasir (kas +Rp 4.000) → pindahkan stok gudang→rak → buat pesanan ke pemasok → percepat waktu hingga barang tiba → terima ke gudang → klaim hadiah misi → simpan ke Slot 1 → muat ulang halaman → muat Slot 1 → kas & hari sama; tanpa error halaman.
2. **Learning Mode**: mulai pelajaran resep → wizard resep lengkap (kelengkapan, produk, batch FEFO, jumlah, etiket) → serahkan → bayar → pelajaran ditandai selesai dengan umpan balik.

## Hasil terakhir (2026-10-02, world building)

| Pemeriksaan | Hasil |
|---|---|
| Type check | ✅ lulus, 0 galat |
| Lint | ✅ lulus, 0 galat/peringatan |
| Vitest | ✅ 123/123 lulus (16 berkas; world building menambah `world`, `traffic`, `pedestrians`) |
| Build produksi | ✅ berhasil |
| Playwright E2E | ✅ 2/2 lulus terhadap build produksi (Chromium headless + SwiftShader, kualitas Rendah). World building: total 5,0–5,8 menit termasuk build; alur utama 3,1–3,9 menit dari batas 5 menit per tes |
| Smoke visual manual (tangkapan layar Playwright) | ✅ menu, scene 3D, antrean NPC, panel pelayanan/kasir/tablet, orang ketiga, eksterior. **Revisi 2**, diperiksa di GPU asli dengan profil Rendah dan Tinggi: avatar (antre, duduk, dilayani, staf di balik meja, pejalan kaki), tekstur foto, dekorasi apotek, ruang administrasi/gudang/istirahat, fasad & jalan, papan kapur, profil Ultra tanpa galat |

## Pengukuran performa grafis

**World building (2026-10-02).** Kawasan diuji juga secara dinamis di browser dengan GPU asli lewat hook dev `__pharmacyDebug.district()`. Hook itu melaporkan `vanParked`, registri kendaraan dan orang di luar, serta status halte. Langkah ujinya:
1. Suntikkan kiriman berstatus `arrived`.
2. Pantau van datang dan parkir (`vanParked` = true).
3. Terima kiriman.
4. Pantau van mundur dan pergi.
5. Periksa tidak ada error konsol.

Selain itu, tangkapan layar setiap area dan peta audit top-down (overlay collider, rute, batas) diperiksa.

Untuk performa dipakai **A/B berselang-seling di sesi yang sama**, karena variansi iGPU antarsesi terlalu besar: render identik bisa 6,5–9,0 ms. Ada dua bentuk:
- fitur hidup (lalu lintas, van, pejalan kaki, AO kawasan) disembunyikan vs ditampilkan;
- baseline sebelum world building yang dipasang ulang sementara di balik flag dev, lalu dihapus.

Hasilnya ada di PROJECT_STATUS.md "World building → Performa".

Benchmark render di GPU asli dijalankan dengan Chromium headless (`--use-angle=d3d11`) pada laptop pengembang (Intel Iris Xe), 1920×1080, dari 5 sudut pandang tetap.

- **Metode revisi 2:** satu frame penuh lewat `__pharmacyDebug.frame()` (logika + render + post-processing), pemanasan 20 frame, lalu median 3 batch × 30 frame yang disinkronkan dengan `readPixels`.
- **Mengapa berubah:** metode revisi 1 (`gl.render` 60×) tidak mengukur post-processing dan peka terhadap lonjakan sesaat, misalnya pemuatan avatar atau kompilasi shader.
- **Ukuran unduhan aset** diukur dari respons jaringan `/assets/` selama masuk permainan dan 15 detik pertama.

Hasil ada di [ART_DIRECTION.md §12](ART_DIRECTION.md#12-hasil-pengukuran). Angka-angka ini belum diuji di perangkat lain. SwiftShader (dipakai E2E) jauh lebih lambat dan tidak representatif untuk performa GPU.

## Batasan pengujian

- Kontrol mouse-look dengan pointer lock dan navigasi WASD ke objek tidak diuji otomatis (pointer lock tidak andal di headless). Interaksi E pada objek diuji secara manual melalui tangkapan layar; logika interaksi diuji lewat panel yang sama.
- Performa (FPS) di perangkat nyata belum diukur; SwiftShader jauh lebih lambat daripada GPU.
- Proxy AI hanya diuji tanpa kredensial (respons 503 & fallback lokal) dan dengan respons tiruan di unit test; panggilan nyata ke model memerlukan kredensial dan tidak dijalankan.
- Audio prosedural tidak diuji otomatis.
- Avatar dan tekstur foto menambah beban render SwiftShader. Alur utama E2E naik dari ±3,0 menit menjadi 3,0–3,9 menit (batas 5 menit), dan variasinya bergantung pada beban CPU mesin. Bila mendekati batas, opsi aman adalah menonaktifkan avatar khusus E2E atau menaikkan batas waktu. Saat ini belum dilakukan karena kedua tes masih lulus.
- Tampilan avatar dan animasi motion capture diperiksa lewat tangkapan layar, bukan asersi otomatis. Unit test hanya memeriksa pemetaan, ketersediaan berkas, dan klip.
- Benchmark GPU berfluktuasi ±1–2 ms antarputaran pada laptop yang sama, karena server pengembangan ikut berjalan dan ada pemuatan aset sesaat. Profil Ultra hanya diukur di GPU terintegrasi (±38 ms, sesuai peringatannya), bukan di GPU diskrit sasarannya.
- E2E hanya di Chromium.
- **World building:** perilaku dinamis (van, lalu lintas, pejalan kaki, kurir/penjaga menoleh) diuji lewat logika murni di unit test dan diperiksa di browser. Belum ada E2E otomatis untuk perilaku visual di dalam scene. Skrip cek dinamis, peta audit, dan benchmark berada di folder kerja sementara pengembang, bukan di repo.
- Benchmark world building berfluktuasi besar antarputaran (render identik 6,5–9,0 ms; sesekali lonjakan 20–27 ms). Angka yang dilaporkan adalah median beberapa putaran yang diselang-seling dalam satu sesi.
- Selama peningkatan visual (2026-10-01), E2E sempat gagal karena dua hal yang sudah diperbaiki: (1) dev server Vite me-reload halaman saat menemukan dependensi baru (`RoundedBoxGeometry`, `BufferGeometryUtils`) tepat setelah game dimulai → kini dipra-bundel (`optimizeDeps.include`) dan E2E memakai build produksi; (2) render SwiftShader yang lebih berat membuat alur utama melewati batas 300 detik → scene kini tidak dirender ulang selama panel terbuka.
- Pada 2026-10-01 alur utama E2E sekali gagal (berjalan ±5 menit, kemungkinan melewati batas waktu 300 detik) saat dev server pengguna sedang berjalan dan dipakai ulang oleh Playwright. Rincian galatnya tidak tersimpan, dan dua kali jalan ulang lulus. Dugaan: beban CPU (SwiftShader). Penyebab pastinya belum dikonfirmasi.
