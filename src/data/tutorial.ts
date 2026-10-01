import type { GameState } from '@/domain/types';

export type TutorialSignal = 'ack' | 'moved' | 'sent-to-checkout' | 'opened-missions';

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** Selesai jika predikat terpenuhi atau sinyal diterima. */
  done?: (s: GameState) => boolean;
  signal?: TutorialSignal;
  hint?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Selamat datang!',
    text: 'Kamu adalah pengelola apotek kecil ini. Tugas pertamamu: membuka apotek dan melayani pasien pertama.',
    signal: 'ack',
  },
  {
    id: 'move',
    title: 'Bergerak',
    text: 'Klik layar untuk mengunci kursor. Gunakan W A S D untuk bergerak dan mouse untuk melihat sekeliling.',
    signal: 'moved',
    hint: 'Tidak nyaman dengan mouse? Tombol panah juga dapat memutar kamera.',
  },
  {
    id: 'open',
    title: 'Buka apotek',
    text: 'Pergi ke papan "BUKA/TUTUP" di dekat pintu masuk dan tekan E, atau gunakan tombol Buka Apotek di HUD.',
    done: (s) => s.time.phase === 'open',
  },
  {
    id: 'serve',
    title: 'Layani pasien',
    text: 'Pasien pertama sudah menunggu. Pergi ke Meja Pelayanan dan tekan E. Dengarkan kebutuhannya, tambahkan produk ke keranjang, lalu kirim ke kasir.',
    signal: 'sent-to-checkout',
  },
  {
    id: 'cashier',
    title: 'Selesaikan pembayaran',
    text: 'Buka Mesin Kasir (E), pilih metode pembayaran, lalu selesaikan transaksi.',
    done: (s) => s.stats.salesCompleted >= 1,
  },
  {
    id: 'inventory',
    title: 'Isi rak dari gudang',
    text: 'Obat yang dijual diambil dari rak. Buka Lemari Gudang di ruang penyimpanan dan pindahkan stok ke rak.',
    done: (s) => s.stats.stockTransfers >= 1,
  },
  {
    id: 'order',
    title: 'Pesan barang',
    text: 'Buka Komputer di ruang administrasi, pilih pemasok, lalu buat pesanan untuk produk yang hampir habis.',
    done: (s) => s.stats.ordersPlaced >= 1,
  },
  {
    id: 'missions',
    title: 'Papan misi',
    text: 'Lihat Papan Misi di dinding area pelayanan untuk tujuan berikutnya dan klaim hadiah misi yang selesai.',
    signal: 'opened-missions',
  },
];
