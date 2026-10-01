import { ScreenShell } from './ScreenShell';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Kontrol',
    body: [
      'Klik layar permainan untuk mengunci kursor. W A S D bergerak, mouse melihat sekeliling, Shift berlari.',
      'E berinteraksi dengan objek yang dituju (nama objek & petunjuk muncul di tengah layar).',
      'Tab membuka tablet manajemen, V mengganti kamera orang pertama/ketiga, Esc membuka menu jeda.',
      'Kontrol alternatif: panah ←/→ memutar kamera, ↑/↓ bergerak. Semua tombol dapat diubah di Pengaturan.',
      'Opsi "Akses cepat stasiun" memungkinkan semua stasiun dibuka dari tablet tanpa berjalan.',
    ],
  },
  {
    title: 'Siklus harian',
    body: [
      'Pagi (07.30) apotek masih tutup: periksa stok, terima kiriman, lalu buka apotek di papan BUKA/TUTUP dekat pintu.',
      'Pasien datang dan mengantre. Layani mereka di Meja Pelayanan; pembayaran diselesaikan di Mesin Kasir.',
      'Kesabaran pasien berkurang saat menunggu. Pasien yang pergi menurunkan reputasi.',
      'Pukul 20.00 apotek tutup: gaji dan biaya operasional dibayar, laporan harian dibuat dari transaksi yang tercatat.',
    ],
  },
  {
    title: 'Jenis pasien',
    body: [
      'Obat bebas — dengarkan keluhan, pilih produk yang sesuai (aturan simulasi), lalu kirim ke kasir.',
      'Resep & tebus ulang — periksa kelengkapan, cocokkan obat, pilih batch (FEFO), jumlah, etiket, lalu serahkan.',
      'Tanya ketersediaan — jawab sesuai stok layak (rak + gudang).',
      'Informasi umum — pilih jawaban yang tepat.',
      'Racikan — terima pesanan, kerjakan di laboratorium, pasien membayar di kasir.',
      'Pasien pembatal — jika pasien membatalkan di kasir, batalkan transaksi dengan benar.',
    ],
  },
  {
    title: 'Stok, batch, dan FEFO',
    body: [
      'Setiap penerimaan membuat batch dengan nomor dan tanggal kedaluwarsa sendiri.',
      'Penjualan & resep mengambil stok dari rak pelayanan. Barang kiriman masuk ke gudang — pindahkan ke rak.',
      'FEFO (First Expired, First Out): gunakan batch yang paling dekat kedaluwarsa terlebih dahulu.',
      'Batch kedaluwarsa tidak dapat diserahkan dan harus dimusnahkan (dicatat sebagai kerugian).',
    ],
  },
  {
    title: 'Pengembangan',
    body: [
      'Naik level membuka fitur: Pegawai & Peningkatan (Lv 2), Peracikan & Event (Lv 3), Perluasan ruangan (Lv 4).',
      'Pegawai bekerja otomatis sesuai peran, tetapi bisa keliru. Pemain tetap mengambil keputusan penting.',
      'Setiap peningkatan memiliki efek nyata (kapasitas, kesabaran pasien, waktu kirim, dll.).',
      'Jika kas negatif, kamu memakai kredit darurat. Di bawah batas kredit selama 3 hari berturut-turut, apotek bangkrut (Mode Karier).',
    ],
  },
  {
    title: 'Catatan edukatif',
    body: [
      'Semua data obat, harga, resep, dan pasien adalah CONTOH SIMULASI yang disederhanakan.',
      'Pemetaan keluhan → produk dan resep racikan adalah aturan permainan, bukan pedoman pengobatan atau prosedur kefarmasian.',
      'Untuk informasi kesehatan nyata, konsultasikan dengan tenaga kesehatan profesional.',
    ],
  },
];

export function GuideScreen() {
  return (
    <ScreenShell title="Panduan Permainan" wide>
      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <section key={s.title} className="panel rounded-2xl p-5">
            <h2 className="mb-2 text-lg font-semibold text-white">{s.title}</h2>
            <ul className="space-y-1.5 text-sm text-slate-300">
              {s.body.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ScreenShell>
  );
}
