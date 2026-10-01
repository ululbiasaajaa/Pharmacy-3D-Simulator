# Desain Permainan — Pharmacy 3D Simulator

## Gameplay loop

1. **Persiapan (07.30)** — waktu berhenti. Terima kiriman, isi rak, pesan barang, atur pegawai.
2. **Buka apotek** — papan BUKA/TUTUP di pintu (atau tombol HUD). Pasien mulai datang.
3. **Layani pasien** di Meja Pelayanan sesuai kategorinya.
4. **Kasir** — selesaikan pembayaran (atau biarkan pegawai kasir).
5. Stok & kas berubah; XP, reputasi, misi, dan pencapaian diperbarui.
6. **Tutup (20.00)** — pasien tersisa pulang, gaji & biaya operasional dibayar, laporan harian + ulasan performa.
7. Gunakan uang untuk pengadaan, pegawai, peningkatan, dan perluasan → tantangan baru terbuka.

Waktu: 1 menit permainan = 2 detik nyata pada 1× (hari kerja ±24 menit nyata). Kecepatan 1×/2×/4×/8× dan jeda tersedia.

## Pasien

| Kategori | Cara melayani | Benar → | Salah → |
|---|---|---|---|
| Obat bebas (keluhan) | Pilih produk yang sesuai aturan simulasi, kirim ke kasir | Penjualan, XP, reputasi | Pasien menolak, kesabaran −12, reputasi −0,5 |
| Obat bebas (produk tertentu) | Tambahkan produk & jumlah yang diminta | idem | idem |
| Resep / tebus ulang | Wizard resep | Penjualan + jasa resep, XP | Validasi gagal: penalti kecil, harus diperbaiki |
| Tanya ketersediaan | Jawab sesuai stok layak (rak + gudang) | Reputasi +, kadang membeli | Reputasi −1,5 |
| Informasi umum | Pilih jawaban tepat | XP | Reputasi −1 |
| Racikan | Terima pesanan → kerjakan di lab → kasir | Harga racikan + jasa | Ulangi; bahan terbuang |
| Pembatal | Saat di kasir pasien membatalkan → batalkan transaksi | Pergi tanpa kecewa | Tidak dapat dibayar |

Kesabaran turun 1,2/menit saat antre (0,35 saat dilayani, 0,6 di kasir) dan dipengaruhi peningkatan, event, mode. Habis → pasien pergi (reputasi −2). Antrean penuh → pasien batal masuk (reputasi −0,5). Pasien skenario (tutorial/pelajaran) tidak kehilangan kesabaran.

Kedatangan: interval acak 12–24 menit × (1,5 − reputasi/100) ÷ pengali perluasan, × event/tantangan; Learning Mode ×1,8.

## Resep

Alur: **Resep → Kelengkapan → Penyiapan (produk, batch, jumlah) → Etiket → Periksa & serahkan**.

Masalah tersembunyi (±22% setelah level 2; 8% di awal): aturan pakai kosong, umur kosong, kekuatan tidak tersedia (dapat diselesaikan dengan *konfirmasi ke penulis resep*), penulis resep kosong, iter habis (harus *ditolak*). Laporan yang salah memperlama tunggu; penolakan resep sah menurunkan reputasi.

Validasi memeriksa: kelengkapan, masalah belum ditangani, produk (nama/kekuatan/bentuk), jumlah, batch (lokasi rak, kedaluwarsa, stok), FEFO (peringatan), aturan pakai etiket, etiket disiapkan, item tambahan, produk rantai dingin (info). Skor = 100 − 25/galat − 10/peringatan. "Periksa ulang" gratis di Learning Mode; di mode lain memakan sedikit kesabaran.

## Inventaris & FEFO

- Stok per **batch** (nomor lot, kedaluwarsa, HPP, lokasi). Penjualan/resep mengambil dari **rak**; kiriman masuk **gudang**.
- **FEFO**: batch layak dengan kedaluwarsa terdekat; sistem merekomendasikan batch beserta alasan, pemain tetap bebas memilih.
- Batch kedaluwarsa diblokir; harus dimusnahkan (kerugian nonkas). Pemeriksaan inventaris (event) mendenda batch kedaluwarsa di rak.
- Kapasitas berbasis volume (rak 900, gudang 2.500; dapat ditingkatkan).
- Semua perubahan tercatat di riwayat transaksi stok.

## Pengadaan

| Pemasok | Harga | Waktu kirim | Keandalan | Min. order | Umur simpan |
|---|---|---|---|---|---|
| Cepat Sehat | ×1,08 | 4 j | 95% | 100 rb | 90–240 hr |
| Hemat Farma | ×0,90 (termasuk obat resep) | 20 j | 75% | 300 rb | 40–180 hr |
| Nusantara Lengkap | ×1,00 (semua) | 10 j | 88% | 200 rb | 120–360 hr |
| Bahan Racik Mandiri | ×0,95 (bahan) | 8 j | 90% | 50 rb | 180–540 hr |

Pembayaran di muka; batal sebelum dikirim = refund penuh. Relasi naik menjadi *baik* (3 pesanan) dan *mitra* (10 pesanan, diskon 3%). Komputer level 1 membuka rekomendasi (titik pesan ulang = stok minimum + permintaan harian × waktu kirim).

## Peracikan

3 skenario latihan (salep seng oksida, bedak salisil, serbuk terbagi vitamin C — yang terakhir butuh peralatan level 1). Penilaian: penimbangan dalam toleransi (±4–6%), urutan langkah, kualitas gerus/campur (mini‑game ritme), jumlah bungkus, wadah, etiket. Gagal kritis = ulangi; bahan yang ditimbang tetap terpakai.

## Pegawai

| Peran | Tugas otomatis |
|---|---|
| Kasir | Memproses pembayaran & pembatalan di kasir |
| Petugas gudang | Menerima kiriman, mengisi rak di bawah minimum, mengarantina batch kedaluwarsa |
| Asisten pelayanan | Obat bebas, tanya ketersediaan, informasi |
| Apoteker (simulasi) | + resep & tebus ulang (bisa ragu → dikembalikan ke pemain) |
| Manajer | Biaya operasional −5%, pegawai lain lebih awet, pesan ulang otomatis (opsional) |

Racikan selalu dikerjakan pemain. Pegawai memiliki kemampuan (peluang benar), kecepatan, energi (istirahat bila < 15), shift (pagi/siang/penuh/libur), level. Slot pegawai awal 2; loket pelayanan pegawai awal 1.

## Ekonomi

- Modal: Karier Rp 6.000.000 · Pembelajaran Rp 10.000.000 · Tantangan sesuai skenario.
- Pemasukan: penjualan, jasa resep (Rp 5.000), jasa racik (Rp 15.000), hadiah misi/tantangan, apresiasi pemeriksaan.
- Pengeluaran: pembelian stok, gaji, operasional harian Rp 180.000 (× efek peningkatan × jumlah ruang; 50% selama 3 hari pertama), peningkatan, perluasan, denda; kerugian kedaluwarsa/rusak (nonkas).
- **Perlindungan pemula**: masa adaptasi 3 hari; kas boleh negatif sampai **kredit darurat −Rp 1.500.000**; bangkrut hanya bila di bawah batas tersebut 3 hari berturut-turut (Karier). Learning Mode tidak bisa bangkrut.
- Anti-eksploitasi: transaksi selalu terkait pasien, semua transaksi/resep/pesanan/misi memiliki guard status; harga beli selalu ≤ harga jual.

## Progres

XP per level = 200 + 150 × (level − 1). Fitur terbuka (Karier): Lv1 pelayanan, kasir, inventaris, katalog, pengadaan, misi, keuangan · Lv2 pegawai, peningkatan · Lv3 peracikan, event · Lv4 perluasan. Reputasi 0–100 memengaruhi kedatangan pasien.

## Mode

- **Karier** — progres terbuka bertahap, event, risiko bangkrut.
- **Pembelajaran** — semua fitur terbuka, kesabaran ×0,3, kedatangan lebih jarang, tanpa event acak & bangkrut, 6 pelajaran (setup skenario otomatis, tujuan terukur, umpan balik + sumber), petunjuk produk & penjelasan objek, pemeriksaan ulang gratis, glosarium.
- **Tantangan** — 5 skenario: *Modal Tipis*, *Serbuan Pasien*, *Stok Terbatas*, *Gudang Kedaluwarsa*, *Pengiriman Terlambat*; masing-masing dengan kondisi awal, pengubah aturan, target, batas hari, menang/kalah, rekor tersimpan.

## Event

Peluang 14%/jam (maks. 1 aktif) mulai level 3: lonjakan pasien (interval ×0,5), keterlambatan kirim (+6 j), permintaan vitamin / batuk-pilek naik, pemeriksaan inventaris, hari pelayanan khusus (reputasi ×2, kesabaran lebih awet), kenaikan harga pemasok (+15%). Narasi dapat divariasikan AI; dampaknya tetap ditentukan sistem.
