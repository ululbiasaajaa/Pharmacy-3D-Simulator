# Pengujian — Pharmacy 3D Simulator

## Cara menjalankan

| Perintah | Isi |
|---|---|
| `npm run typecheck` | Pemeriksaan tipe TypeScript (`tsc -b`) |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm test` | Vitest — unit, integrasi, komponen (jsdom), persistensi (fake-indexeddb) |
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
| `visual.test.ts` | Model siang–malam (arah & intensitas matahari, malam), tata letak produk dari stok (rak kosong tanpa stok, dalam batas tingkat & tidak bertumpuk, tersebar ke beberapa tingkat, lebih padat saat stok tinggi), bentuk kemasan per sediaan, cache tekstur prosedural, builder geometri (gabung per material, UV meter), gaya karakter deterministik & bobot skinning valid |
| `ai.test.ts` | Pemeriksaan ketersediaan proxy (`/health` ok/404/offline), AI tidak dipanggil bila proxy tidak tersedia, fallback lokal saat AI mati/proxy gagal/respons salah format, sanitasi keluaran AI (tolak instruksi dosis), ulasan dari data laporan, petunjuk tutor berbasis kondisi |

### Integrasi (`src/tests/integration/gameplay.test.ts`)

Hari penuh buka→tutup dengan laporan dari transaksi; gaji dibayar saat tutup; kasir otomatis menyelesaikan pembayaran; petugas gudang mengisi rak; asisten melayani pasien OTC (pegawai memengaruhi pelayanan); lonjakan pasien mengubah interval kedatangan lalu berakhir; pemeriksaan inventaris mendenda batch ED; ruang tunggu menambah kapasitas antrean; Challenge Mode (kondisi awal, target, kalah saat batas hari); Learning Mode (tidak bangkrut, kesabaran lebih lambat); Career Mode bangkrut setelah 3 hari di bawah batas kredit.

### Komponen (`src/tests/components/panels.test.tsx`)

Menu utama; alur UI pelayanan obat bebas → kasir → pembayaran; klik ganda tombol bayar tidak menggandakan uang; klaim hadiah misi; pemusnahan batch kedaluwarsa dari panel inventaris; toggle AI di Pengaturan nonaktif & bertanda "Tidak tersedia" tanpa proxy, aktif bila proxy terhubung.

### End-to-end (`e2e/gameplay.spec.ts`)

1. **Alur utama (Mode Karier)**: permainan baru → tutorial (sambutan, lewati langkah gerak, buka apotek) → layani pasien tutorial (keluhan sakit kepala → parasetamol) → bayar di kasir (kas +Rp 4.000) → pindahkan stok gudang→rak → buat pesanan ke pemasok → percepat waktu hingga barang tiba → terima ke gudang → klaim hadiah misi → simpan ke Slot 1 → muat ulang halaman → muat Slot 1 → kas & hari sama; tanpa error halaman.
2. **Learning Mode**: mulai pelajaran resep → wizard resep lengkap (kelengkapan, produk, batch FEFO, jumlah, etiket) → serahkan → bayar → pelajaran ditandai selesai dengan umpan balik.

## Hasil terakhir (2026-10-01)

| Pemeriksaan | Hasil |
|---|---|
| Type check | ✅ lulus, 0 galat |
| Lint | ✅ lulus, 0 galat/peringatan |
| Vitest | ✅ 94/94 lulus (12 berkas) |
| Build produksi | ✅ berhasil |
| Playwright E2E | ✅ 2/2 lulus terhadap build produksi (Chromium headless + SwiftShader, ±4,2 menit termasuk build) |
| Smoke visual manual (tangkapan layar Playwright) | ✅ menu, scene 3D, antrean NPC, panel pelayanan/kasir/tablet, orang ketiga, eksterior |

## Pengukuran performa grafis

Benchmark render di GPU asli dijalankan dengan Chromium headless (`--use-angle=d3d11`) pada laptop pengembang (Intel Iris Xe), 1920×1080: scene dirender 60 kali berturut-turut lalu disinkronkan (`readPixels`) dari 5 sudut pandang tetap. Hasil sebelum/sesudah peningkatan visual ada di [ART_DIRECTION.md §11](ART_DIRECTION.md#11-hasil-pengukuran). Angka ini adalah waktu render (bukan FPS penuh) dan belum diuji di perangkat lain. SwiftShader (dipakai E2E) jauh lebih lambat dan tidak representatif untuk performa GPU.

## Batasan pengujian

- Kontrol mouse-look dengan pointer lock dan navigasi WASD ke objek tidak diuji otomatis (pointer lock tidak andal di headless). Interaksi E pada objek diuji secara manual melalui tangkapan layar; logika interaksi diuji lewat panel yang sama.
- Performa (FPS) di perangkat nyata belum diukur; SwiftShader jauh lebih lambat daripada GPU.
- Proxy AI hanya diuji tanpa kredensial (respons 503 & fallback lokal) dan dengan respons tiruan di unit test; panggilan nyata ke model memerlukan kredensial dan tidak dijalankan.
- Audio prosedural tidak diuji otomatis.
- E2E hanya di Chromium.
- Selama peningkatan visual (2026-10-01), E2E sempat gagal karena dua hal yang sudah diperbaiki: (1) dev server Vite me-reload halaman saat menemukan dependensi baru (`RoundedBoxGeometry`, `BufferGeometryUtils`) tepat setelah game dimulai → kini dipra-bundel (`optimizeDeps.include`) dan E2E memakai build produksi; (2) render SwiftShader yang lebih berat membuat alur utama melewati batas 300 detik → scene kini tidak dirender ulang selama panel terbuka.
- Pada 2026-10-01 alur utama E2E sekali gagal (berjalan ±5 menit, kemungkinan melewati batas waktu 300 detik) saat dev server pengguna sedang berjalan dan dipakai ulang oleh Playwright. Rincian galatnya tidak tersimpan, dan dua kali jalan ulang lulus. Dugaan: beban CPU (SwiftShader). Penyebab pastinya belum dikonfirmasi.
