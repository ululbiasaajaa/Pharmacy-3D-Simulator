import type { GameStats } from '@/domain/types';

export type LessonSetup = 'otc' | 'rx-basic' | 'rx-issue' | 'fefo' | 'procure' | 'compound';

export interface LessonDef {
  id: string;
  title: string;
  summary: string;
  intro: string[];
  steps: string[];
  setup: LessonSetup;
  objectives: { stat: keyof GameStats; target: number; label: string }[];
  source: string;
}

/**
 * Pelajaran Learning Mode. Konten adalah penyederhanaan alur kerja untuk
 * permainan; ditandai sebagai contoh simulasi, bukan pedoman praktik.
 */
export const LESSONS: LessonDef[] = [
  {
    id: 'lesson-otc',
    title: '1. Pelayanan Obat Bebas & Kasir',
    summary: 'Dengarkan keluhan, pilih produk yang sesuai aturan simulasi, lalu selesaikan pembayaran.',
    intro: [
      'Pasien datang dengan keluhan ringan. Dalam permainan ini, setiap keluhan dipetakan ke beberapa produk yang dianggap sesuai.',
      'Setelah produk dipilih, pasien diarahkan ke kasir untuk membayar.',
    ],
    steps: ['Buka Meja Pelayanan (E)', 'Dengarkan keluhan pasien', 'Tambahkan produk yang sesuai ke keranjang', 'Kirim ke kasir', 'Selesaikan pembayaran di Mesin Kasir'],
    setup: 'otc',
    objectives: [{ stat: 'salesCompleted', target: 1, label: 'Selesaikan 1 transaksi' }],
    source: 'Contoh simulasi — pemetaan keluhan → produk adalah aturan permainan.',
  },
  {
    id: 'lesson-rx',
    title: '2. Pelayanan Resep',
    summary: 'Periksa resep, pilih produk dan batch, siapkan etiket, lalu serahkan.',
    intro: [
      'Alur resep dalam permainan: terima → periksa kelengkapan → cocokkan obat → pilih batch (FEFO) → jumlah → etiket → pemeriksaan akhir → serahkan.',
      'Sistem akan memvalidasi pekerjaanmu dan menjelaskan kesalahan.',
    ],
    steps: ['Terima resep di Meja Pelayanan', 'Centang pemeriksaan kelengkapan', 'Cocokkan setiap item dengan katalog', 'Pilih batch & jumlah', 'Siapkan etiket', 'Serahkan obat'],
    setup: 'rx-basic',
    objectives: [{ stat: 'prescriptionsDispensed', target: 1, label: 'Layani 1 resep' }],
    source: 'Contoh simulasi — alur disederhanakan untuk permainan.',
  },
  {
    id: 'lesson-rx-issue',
    title: '3. Memeriksa Kelengkapan Resep',
    summary: 'Temukan informasi yang kurang pada resep dan ambil tindakan yang tepat.',
    intro: [
      'Tidak semua resep lengkap. Periksa identitas pasien, penulis resep, kekuatan obat, dan aturan pakai.',
      'Jika ada masalah, laporkan jenis masalahnya lalu lakukan konfirmasi (simulasi) sebelum melanjutkan.',
    ],
    steps: ['Terima resep', 'Laporkan masalah kelengkapan yang ditemukan', 'Konfirmasi ke penulis resep (simulasi)', 'Lanjutkan pelayanan'],
    setup: 'rx-issue',
    objectives: [{ stat: 'issuesDetected', target: 1, label: 'Temukan 1 masalah resep' }],
    source: 'Contoh simulasi.',
  },
  {
    id: 'lesson-fefo',
    title: '4. FEFO & Kedaluwarsa',
    summary: 'Gunakan batch yang paling dekat kedaluwarsa terlebih dahulu dan musnahkan batch kedaluwarsa.',
    intro: [
      'FEFO (First Expired, First Out): batch dengan tanggal kedaluwarsa paling dekat — yang masih layak — digunakan lebih dahulu.',
      'Batch yang sudah kedaluwarsa tidak boleh diserahkan dan harus dimusnahkan (dicatat sebagai kerugian).',
    ],
    steps: ['Buka Lemari Gudang atau Rak Obat', 'Temukan batch berstatus KEDALUWARSA', 'Musnahkan batch tersebut', 'Layani resep dengan batch FEFO'],
    setup: 'fefo',
    objectives: [
      { stat: 'expiredDisposed', target: 1, label: 'Musnahkan 1 batch kedaluwarsa' },
      { stat: 'prescriptionsDispensed', target: 1, label: 'Layani 1 resep' },
    ],
    source: 'Prinsip FEFO umum dalam manajemen persediaan; penerapan di sini adalah contoh simulasi.',
  },
  {
    id: 'lesson-procure',
    title: '5. Pengadaan Barang',
    summary: 'Pesan barang yang habis ke pemasok, tunggu kiriman, lalu terima ke gudang.',
    intro: [
      'Vitamin C habis. Buka Komputer → Pengadaan, pilih pemasok dengan mempertimbangkan harga dan waktu kirim.',
      'Saat barang tiba, terima ke gudang lalu pindahkan ke rak.',
    ],
    steps: ['Buka Komputer', 'Pilih pemasok & jumlah', 'Konfirmasi pesanan', 'Tunggu kiriman (percepat waktu jika perlu)', 'Terima barang'],
    setup: 'procure',
    objectives: [{ stat: 'ordersReceived', target: 1, label: 'Terima 1 pengiriman' }],
    source: 'Contoh simulasi.',
  },
  {
    id: 'lesson-compound',
    title: '6. Peracikan',
    summary: 'Timbang bahan, gerus, campur, masukkan ke wadah, dan buat etiket.',
    intro: [
      'Ruang peracikan memungkinkan pembuatan sediaan sesuai instruksi skenario.',
      'Ketelitian menimbang dan urutan kerja menentukan nilai. Semua resep racikan adalah skenario latihan.',
    ],
    steps: ['Pergi ke Meja Peracikan', 'Pilih pesanan racikan', 'Timbang setiap bahan', 'Gerus & campur', 'Pilih wadah & buat etiket'],
    setup: 'compound',
    objectives: [{ stat: 'compoundingCompleted', target: 1, label: 'Selesaikan 1 racikan' }],
    source: 'Skenario latihan permainan; tidak menggantikan pelatihan peracikan.',
  },
];
