# Status Proyek — Pharmacy 3D Simulator

_Terakhir diperbarui: 2026-10-01_

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
- **Audio & model 3D adalah placeholder** buatan kode (primitif low-poly, Web Audio). Tidak ada aset final.
- **AI nyata belum diuji end-to-end** karena memerlukan kredensial; jalur tanpa kredensial (503 → fallback lokal) sudah diuji. Tanpa proxy (mis. di hosting statis), toggle AI di Pengaturan dinonaktifkan dan ditandai "Tidak tersedia".
- **Pegawai tidak memakai pathfinding**: berpindah ruangan dengan teleport bila jarak jauh; pasien berjalan lurus antar titik di area pelanggan.
- **Kamera orang ketiga** hanya bertabrakan dengan dinding/pintu (bukan perabot rendah).
- **Kasir tidak bisa membuat transaksi tanpa pasien** (keputusan desain untuk mencegah uang tanpa batas); transaksi dibuat dari Meja Pelayanan.
- Timbangan & mortir membuka laboratorium yang sama (bukan langsung ke langkah tertentu).
- Ukuran bundle 3D ±920 KB (gzip ±250 KB) — dimuat terpisah dari menu.
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

## Keputusan teknis penting

Lihat [ARCHITECTURE.md](ARCHITECTURE.md#keputusan-teknis-penting). Ringkas: domain murni + immer, `GameState` JSON tunggal dengan RNG deterministik, uang hanya lewat buku besar, guard status anti-ganda, AI hanya via proxy server dengan fallback lokal, aset dibuat di kode.

## Asumsi

- Bahasa utama UI: Indonesia (sesuai dokumen kebutuhan).
- Satuan stok = satuan kemasan (strip/botol/gram); jumlah resep ditulis dalam satuan yang sama.
- Harga & data obat adalah contoh; tidak dimaksudkan akurat secara klinis maupun komersial.
- Hari permainan dimulai Senin, 5 Januari 2026 (kalender simulasi).

## Langkah berikutnya yang disarankan

1. Uji bermain manual dengan mouse/keyboard di GPU nyata untuk menyetel sensitivitas, kecepatan gerak, dan tempo kedatangan pasien.
2. Lengkapi terjemahan bahasa Inggris untuk panel simulasi.
3. Ganti aset placeholder (model karakter & audio) dengan aset berlisensi jelas; catat sumbernya di README.
4. Tambahkan pathfinding sederhana (grid) untuk pegawai & pasien.
5. Uji AI end-to-end dengan kredensial server dan tambahkan evaluasi kualitas teks.
6. Tambah E2E untuk Challenge Mode dan peracikan.
