# Pengujian — Pharmacy 3D Simulator

## Cara menjalankan

| Perintah | Isi |
|---|---|
| `npm run typecheck` | Pemeriksaan tipe TypeScript (`tsc -b`) |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm test` | Vitest — unit, integrasi, komponen (jsdom), persistensi (fake-indexeddb) |
| `npm run test:e2e` | Playwright — menjalankan dev server otomatis; perlu `npx playwright install chromium` sekali |
| `npm run build` | Build produksi |
| `npm run check` | typecheck + lint + test + build |

E2E memakai WebGL perangkat lunak (SwiftShader) agar scene 3D benar-benar dirender di lingkungan tanpa GPU, dan opsi aksesibilitas **Akses cepat stasiun** agar stasiun dapat dibuka tanpa navigasi 3D (pointer lock tidak andal di browser headless).

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
| Vitest | ✅ 84/84 lulus (11 berkas) |
| Build produksi | ✅ berhasil |
| Playwright E2E | ✅ 2/2 lulus (Chromium headless + SwiftShader, ±3 menit) |
| Smoke visual manual (tangkapan layar Playwright) | ✅ menu, scene 3D, antrean NPC, panel pelayanan/kasir/tablet, orang ketiga, eksterior |

## Batasan pengujian

- Kontrol mouse-look dengan pointer lock dan navigasi WASD ke objek tidak diuji otomatis (pointer lock tidak andal di headless). Interaksi E pada objek diuji secara manual melalui tangkapan layar; logika interaksi diuji lewat panel yang sama.
- Performa (FPS) di perangkat nyata belum diukur; SwiftShader jauh lebih lambat daripada GPU.
- Proxy AI hanya diuji tanpa kredensial (respons 503 & fallback lokal) dan dengan respons tiruan di unit test; panggilan nyata ke model memerlukan kredensial dan tidak dijalankan.
- Audio prosedural tidak diuji otomatis.
- E2E hanya di Chromium.
- Pada 2026-10-01 alur utama E2E sekali gagal (berjalan ±5 menit, kemungkinan melewati batas waktu 300 detik) saat dev server pengguna sedang berjalan dan dipakai ulang oleh Playwright. Rincian galatnya tidak tersimpan, dan dua kali jalan ulang lulus. Dugaan: beban CPU (SwiftShader). Penyebab pastinya belum dikonfirmasi.
