# Pharmacy 3D Simulator

Game simulasi pengelolaan apotek 3D berbasis web. Pemain menjelajahi apotek dari sudut pandang orang pertama (atau orang ketiga), melayani pasien, memproses resep, mengelola stok per batch dengan FEFO, melakukan pengadaan, meracik obat, merekrut pegawai, dan mengembangkan apotek.

> Semua data obat, resep, harga, pemasok, dan pasien adalah **contoh fiktif untuk simulasi** dan bukan saran medis atau pedoman kefarmasian.

## Fitur

- **Dunia 3D yang dapat dijelajahi** — area pelanggan, meja pelayanan & kasir, rak obat bebas/resep, lemari pendingin, gudang, laboratorium racik, ruang administrasi, area pegawai, serta 4 ruang perluasan yang terbuka lewat pembelian. Semua model dibuat dari primitif low‑poly di kode.
- **Kontrol** — WASD + mouse (pointer lock), Shift lari, E interaksi, Tab tablet, V ganti kamera, Esc jeda; tombol dapat diubah. Kontrol alternatif panah/PageUp/PageDown dan opsi *Akses cepat stasiun*.
- **Interaksi berbasis raycast** — nama objek, petunjuk tombol, sorotan, alasan objek terkunci; dinding menghalangi interaksi.
- **Pasien NPC** — 7 kategori (obat bebas, resep, tebus ulang, tanya ketersediaan, racikan, pembatal, informasi), antrean dengan kapasitas, kesabaran, dialog kontekstual, berjalan masuk/antre/ke kasir/pulang.
- **Pelayanan resep** — wizard 5 langkah (resep → kelengkapan → penyiapan & batch → etiket + cetak → validasi & serah), deteksi masalah resep (aturan pakai/umur/penulis kosong, kekuatan tidak tersedia, iter habis), validasi yang menjelaskan kesalahan & tindakan.
- **Inventaris** — katalog 38 produk, stok per batch & lokasi (rak/gudang), FEFO dengan rekomendasi dan alasannya, kedaluwarsa, karantina, pemusnahan, stock opname, pemindahan, kapasitas, riwayat transaksi stok, dasbor.
- **Kasir** — tunai/kartu/digital (simulasi), ubah jumlah, hapus item, promo diskon, pembatalan; aman dari pemrosesan ganda.
- **Pengadaan** — 4 pemasok fiktif (harga, waktu kirim, keandalan, minimum order, relasi), status draf→dipesan→diproses→dalam perjalanan→tiba→diterima, pembatalan dengan refund, rekomendasi berbasis aturan.
- **Keuangan** — buku besar, laporan harian, laba/rugi, HPP & laba kotor, produk terlaris, stok rendah — semuanya dihitung dari transaksi tersimpan.
- **Laboratorium peracikan** — 3 skenario latihan; penimbangan (tahan-untuk-menuang), menggerus & mencampur (mini‑game ritme), pembagian, wadah, etiket; penilaian ketelitian & urutan; bahan terpakai walau gagal.
- **Pegawai** — 5 peran (kasir, petugas gudang, asisten, apoteker simulasi, manajer) dengan otomatisasi nyata, energi, shift, gaji, level, dan peluang kesalahan.
- **Peningkatan & perluasan** — 13 peningkatan dengan efek nyata (kapasitas, kesabaran, waktu kirim, peralatan racik, loket kedua, ruang istirahat…), tampil di dunia 3D.
- **Progres** — level & XP dengan fitur terbuka bertahap, reputasi, 19 misi, 18 pencapaian, 7 event acak (lonjakan pasien, keterlambatan kirim, pemeriksaan inventaris, dll.).
- **Mode permainan** — Karier, Pembelajaran (6 pelajaran terpandu + umpan balik + glosarium), Tantangan (5 skenario dengan target & batas waktu).
- **Simpan/muat** — IndexedDB, 3 slot + simpan otomatis, ekspor/impor JSON, validasi Zod, migrasi skema, penanganan data rusak.
- **Pengaturan** — volume, sensitivitas, kecepatan gerak, kualitas grafis, skala UI, bahasa (EN sebagian), aksesibilitas (kurangi gerak, kontras tinggi), pemetaan tombol.
- **AI opsional** — dialog pasien, petunjuk tutor, ulasan performa, narasi event melalui proxy server; game sepenuhnya dapat dimainkan tanpa AI.
- **Audio** — efek suara & musik latar prosedural (Web Audio, placeholder).

## Teknologi

React 19 · TypeScript · Vite · Three.js · React Three Fiber · Drei · Zustand · Immer · React Router · Tailwind CSS 4 · Zod · idb (IndexedDB) · Vitest · React Testing Library · Playwright. Proxy AI opsional: Node.js + `@anthropic-ai/sdk`.

## Instalasi & menjalankan

Prasyarat: Node.js 20+ (diuji dengan Node 24).

```bash
npm install
npm run dev          # http://localhost:5173
```

Build produksi:

```bash
npm run build        # hasil di dist/
npm run preview
```

## Pengujian

```bash
npm run typecheck    # tsc
npm run lint         # ESLint
npm test             # Vitest: unit, integrasi, komponen, persistensi
npx playwright install chromium   # sekali saja
npm run test:e2e     # Playwright end-to-end (menjalankan dev server otomatis)
npm run check        # typecheck + lint + test + build
```

Detail skenario dan hasil: [TESTING.md](TESTING.md).

## Konfigurasi

- **Ekonomi & keseimbangan**: `src/domain/config.ts` (modal awal, biaya operasional, masa adaptasi, batas kredit darurat, kecepatan waktu, kesabaran, kapasitas, XP).
- **Data permainan**: `src/data/` (katalog obat, pemasok, resep, racikan, peningkatan, misi, event, pencapaian, tantangan, pelajaran, tutorial).
- **AI opsional** (lihat `.env.example`):
  1. Siapkan kredensial di server: `ANTHROPIC_API_KEY` (atau profil `ant auth login`).
  2. Jalankan `npm run ai-proxy` (port 8787; Vite mem-proxy `/api/ai` saat dev).
  3. Aktifkan *Fitur AI* di Pengaturan.
  Kunci API tidak pernah dikirim ke browser. Proxy memakai model `claude-opus-5-5` (ubah dengan `AI_MODEL`) dengan *server-side refusal fallback* aktif. Game memeriksa `/api/ai/health`; bila proxy tidak tersedia, toggle *Fitur AI* dinonaktifkan dan ditandai "Tidak tersedia", dan game memakai teks lokal.

## Deploy (hosting statis, mis. Vercel)

Game adalah situs statis hasil Vite dan memakai `HashRouter`, sehingga tidak memerlukan aturan *rewrite*.

1. Push repo ke GitHub, lalu *import* di Vercel (preset **Vite** terdeteksi otomatis).
2. Build command `npm run build`, output directory `dist`.

`npm run ai-proxy` tidak berjalan di hosting statis; tanpa proxy, fitur AI otomatis tidak tersedia dan game sepenuhnya memakai teks lokal. Simpanan permainan tersimpan di IndexedDB browser masing-masing pemain (gunakan ekspor/impor untuk memindahkannya).

## Dokumentasi

- [PROJECT_STATUS.md](PROJECT_STATUS.md) — status milestone, bug, hasil uji, langkah berikutnya
- [ARCHITECTURE.md](ARCHITECTURE.md) — arsitektur, modul, alur data
- [GAME_DESIGN.md](GAME_DESIGN.md) — gameplay loop, sistem, ekonomi, mode
- [TESTING.md](TESTING.md) — cara & hasil pengujian

## Aset & lisensi

Seluruh model 3D, teks papan, dan audio dibuat di dalam kode (primitif Three.js, CanvasTexture, Web Audio). Tidak ada aset pihak ketiga. Audio berstatus placeholder.
