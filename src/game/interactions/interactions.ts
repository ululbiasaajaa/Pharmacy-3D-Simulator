import { act, useGame } from '@/stores/gameStore';
import { useUi, type PanelArgs, type PanelId } from '@/stores/uiStore';
import { useWorld } from '@/game/world/worldStore';
import { audio } from '@/services/audio/audioEngine';
import { callNextPatient } from '@/domain/patients';
import { isFeatureUnlocked, requiredLevel } from '@/domain/progression';
import { openPharmacy } from '@/domain/simulation';
import type { FeatureKey } from '@/domain/config';
import type { GameState, RoomId } from '@/domain/types';
import { EXPANSION_DOORS, INTERIOR_DOORS, ROOM_LABELS } from '@/game/world/layout';

export interface InteractableDef {
  id: string;
  label: string;
  /** Kata kerja pada petunjuk tombol, mis. "Layani pasien". */
  action: (s: GameState) => string;
  /** Penjelasan objek (ditampilkan di Learning Mode). */
  explanation: string;
  /** Alasan objek tidak dapat digunakan, atau null. */
  blocked?: (s: GameState) => string | null;
  run: (s: GameState) => void;
}

const featureGate = (key: FeatureKey) => (s: GameState) =>
  isFeatureUnlocked(s, key) ? null : `Terbuka di Level ${requiredLevel(key)}`;

const roomGate = (room: RoomId) => (s: GameState) => (s.pharmacy.unlockedRooms.includes(room) ? null : 'Ruangan belum dibuka (beli perluasan)');

const open = (panel: PanelId, args?: PanelArgs) => () => {
  audio.play('open');
  useUi.getState().openPanel(panel, args);
};

const DEFS: InteractableDef[] = [
  {
    id: 'sign',
    label: 'Papan BUKA/TUTUP',
    action: (s) => (s.time.phase === 'preopen' ? 'Buka apotek' : s.time.phase === 'open' ? 'Lihat status (apotek buka)' : 'Lihat laporan harian'),
    explanation: 'Papan penanda jam operasional. Membuka apotek memulai kedatangan pasien. Apotek otomatis tutup pukul 20.00.',
    run: (s) => {
      if (s.time.phase === 'preopen') {
        act(openPharmacy);
        audio.play('door');
      } else if (s.time.phase === 'closed') useUi.getState().openPanel('report');
      else useUi.getState().openPanel('report', { tab: 'status' });
    },
  },
  {
    id: 'service-desk',
    label: 'Meja Pelayanan',
    action: (s) => (s.activePatientId ? 'Lanjutkan pelayanan' : s.queue.length ? 'Panggil & layani pasien berikutnya' : 'Buka meja pelayanan'),
    explanation: 'Tempat menerima pasien: mendengarkan kebutuhan, menerima resep, menjawab pertanyaan, dan menerima pesanan racikan.',
    blocked: (s) => (s.time.phase !== 'open' ? 'Apotek belum dibuka' : null),
    run: (s) => {
      if (!s.activePatientId && s.queue.length) act((d) => callNextPatient(d));
      audio.play('open');
      useUi.getState().openPanel('service');
    },
  },
  {
    id: 'register',
    label: 'Mesin Kasir',
    action: (s) => {
      const n = s.patients.filter((p) => p.status === 'checkout').length;
      return n ? `Proses pembayaran (${n} menunggu)` : 'Buka kasir';
    },
    explanation: 'Mesin kasir memproses pembayaran tunai, kartu, atau digital. Transaksi yang belum dibayar dapat dibatalkan tanpa mengubah stok.',
    run: open('pos'),
  },
  {
    id: 'otc-shelf',
    label: 'Rak Obat Bebas',
    action: () => 'Lihat & kelola rak',
    explanation: 'Obat untuk dijual diambil dari rak pelayanan. Isi ulang rak dari gudang agar stok siap dijual. Isi rak mencerminkan stok sebenarnya.',
    run: open('inventory', { manage: true, location: 'shelf' }),
  },
  {
    id: 'rx-shelf',
    label: 'Rak Obat Resep',
    action: () => 'Lihat obat resep',
    explanation: 'Obat dengan label "resep" disimpan di belakang meja dan hanya diserahkan melalui alur pelayanan resep.',
    run: open('inventory', { manage: true, location: 'shelf', category: 'resep' }),
  },
  {
    id: 'fridge',
    label: 'Lemari Pendingin',
    action: () => 'Periksa produk rantai dingin',
    explanation: 'Produk rantai dingin (contoh: insulin) memerlukan penyimpanan dingin. Serahkan dengan kemasan pendingin.',
    run: open('inventory', { manage: true, refrigerated: true }),
  },
  {
    id: 'storage-cabinet',
    label: 'Lemari Gudang',
    action: (s) => {
      const arrived = s.purchaseOrders.filter((o) => o.status === 'arrived').length;
      return arrived ? `Terima ${arrived} kiriman & kelola gudang` : 'Kelola stok gudang';
    },
    explanation: 'Gudang menyimpan stok cadangan per batch. Terima kiriman di sini, pindahkan stok ke rak, dan musnahkan batch rusak/kedaluwarsa.',
    run: open('inventory', { manage: true, location: 'warehouse', tab: 'receive' }),
  },
  {
    id: 'computer',
    label: 'Komputer Apotek',
    action: () => 'Buka sistem pengadaan',
    explanation: 'Komputer menampilkan pemasok, pesanan, status pengiriman, dan (setelah peningkatan) rekomendasi pengadaan otomatis.',
    run: open('procurement'),
  },
  {
    id: 'filing',
    label: 'Lemari Arsip Keuangan',
    action: () => 'Lihat laporan keuangan',
    explanation: 'Buku keuangan: semua pemasukan dan pengeluaran tercatat. Laporan dihitung dari transaksi yang tersimpan.',
    blocked: featureGate('finance'),
    run: open('finance'),
  },
  {
    id: 'lockers',
    label: 'Loker Pegawai',
    action: () => 'Kelola pegawai & jadwal',
    explanation: 'Rekrut, atur shift, dan atur otomatisasi pegawai. Setiap peran memiliki tugas berbeda.',
    blocked: featureGate('employees'),
    run: open('employees'),
  },
  {
    id: 'blueprint',
    label: 'Denah Pengembangan',
    action: () => 'Lihat peningkatan & perluasan',
    explanation: 'Denah untuk membeli peningkatan fasilitas dan membuka ruangan baru. Setiap peningkatan memiliki efek permainan.',
    blocked: featureGate('upgrades'),
    run: open('upgrades'),
  },
  {
    id: 'mission-board',
    label: 'Papan Misi',
    action: (s) => {
      const n = s.missions.filter((m) => m.status === 'completed').length;
      return n ? `Klaim ${n} hadiah misi` : 'Lihat misi & pencapaian';
    },
    explanation: 'Misi memberi tujuan dan hadiah. Klaim hadiah setelah misi selesai.',
    run: open('missions'),
  },
  {
    id: 'info-board',
    label: 'Papan Informasi',
    action: (s) => (s.mode === 'learning' ? 'Pilih pelajaran' : s.mode === 'challenge' ? 'Lihat target tantangan' : 'Lihat status apotek'),
    explanation: 'Papan informasi berisi pelajaran (Learning Mode), target tantangan (Challenge Mode), atau ringkasan status apotek.',
    run: (s) => {
      audio.play('open');
      useUi.getState().openPanel(s.mode === 'learning' ? 'lessons' : s.mode === 'challenge' ? 'challenge' : 'report', { tab: 'status' });
    },
  },
  {
    id: 'waiting-chairs',
    label: 'Kursi Tunggu',
    action: () => 'Lihat antrean',
    explanation: 'Kapasitas antrean dan kenyamanan ruang tunggu memengaruhi kesabaran pasien. Tingkatkan melalui Ruang Tunggu Nyaman.',
    run: open('service', { tab: 'queue' }),
  },
  {
    id: 'lab-table',
    label: 'Meja Peracikan',
    action: (s) => {
      const n = s.compoundingOrders.filter((o) => o.status === 'pending' || o.status === 'in-progress').length;
      return n ? `Kerjakan racikan (${n} pesanan)` : 'Buka laboratorium';
    },
    explanation: 'Meja kerja peracikan: pilih pesanan, timbang bahan, gerus di mortir, campur, masukkan ke wadah, lalu buat etiket.',
    blocked: featureGate('compounding'),
    run: open('compounding'),
  },
  {
    id: 'scale',
    label: 'Timbangan',
    action: () => 'Menimbang bahan',
    explanation: 'Timbangan dipakai untuk menimbang bahan sesuai instruksi. Ketelitian dinilai terhadap toleransi skenario.',
    blocked: featureGate('compounding'),
    run: open('compounding', { tab: 'weigh' }),
  },
  {
    id: 'mortar',
    label: 'Mortir & Stamper',
    action: () => 'Menggerus & mencampur',
    explanation: 'Mortir dan stamper dipakai untuk menggerus serbuk dan mencampur bahan hingga homogen.',
    blocked: featureGate('compounding'),
    run: open('compounding', { tab: 'grind' }),
  },
  {
    id: 'ingredient-rack',
    label: 'Rak Bahan Racik',
    action: () => 'Lihat stok bahan',
    explanation: 'Bahan racik (satuan gram) disimpan per batch dan dipakai saat peracikan.',
    run: open('inventory', { manage: true, category: 'bahan-racik' }),
  },
  // Ruang perluasan
  {
    id: 'bw-cabinet',
    label: 'Rak Gudang Besar',
    action: () => 'Kelola stok gudang',
    explanation: 'Gudang tambahan menambah kapasitas penyimpanan secara signifikan.',
    blocked: roomGate('big-warehouse'),
    run: open('inventory', { manage: true, location: 'warehouse' }),
  },
  {
    id: 'lab2-table',
    label: 'Meja Racik 2',
    action: () => 'Kerjakan racikan',
    explanation: 'Ruang racik kedua dengan peralatan lebih lengkap.',
    blocked: roomGate('lab-2'),
    run: open('compounding'),
  },
  {
    id: 'admin2-computer',
    label: 'Komputer Administrasi+',
    action: () => 'Laporan & pengadaan',
    explanation: 'Ruang administrasi tambahan membuat operasional lebih efisien.',
    blocked: roomGate('admin-plus'),
    run: open('finance'),
  },
  {
    id: 'coffee',
    label: 'Mesin Kopi Pegawai',
    action: () => 'Lihat energi & jadwal pegawai',
    explanation: 'Ruang istirahat mempercepat pemulihan energi pegawai.',
    blocked: roomGate('staff-lounge'),
    run: open('employees'),
  },
  {
    id: 'counter-2',
    label: 'Loket Pelayanan 2',
    action: () => 'Atur pegawai pelayanan',
    explanation: 'Loket kedua memungkinkan lebih banyak pegawai melayani secara bersamaan.',
    blocked: roomGate('counter-2'),
    run: open('employees'),
  },
];

// Pintu dalam & pintu perluasan
for (const d of INTERIOR_DOORS) {
  DEFS.push({
    id: d.id,
    label: d.label,
    action: () => (useWorld.getState().doorsOpen[d.id] ? 'Tutup pintu' : 'Buka pintu'),
    explanation: 'Pintu penghubung area staf dengan ruang belakang.',
    run: () => {
      audio.play('door');
      useWorld.getState().toggleDoor(d.id);
    },
  });
}
for (const d of EXPANSION_DOORS) {
  DEFS.push({
    id: d.id,
    label: d.label,
    action: () => (useWorld.getState().doorsOpen[d.id] ? 'Tutup pintu' : 'Buka pintu'),
    explanation: `Pintu menuju ${ROOM_LABELS[d.room!].toLowerCase()}. Ruangan dibuka melalui perluasan apotek.`,
    blocked: (s) => (d.room && !s.pharmacy.unlockedRooms.includes(d.room) ? 'Terkunci — beli perluasan di Denah Pengembangan' : null),
    run: () => {
      audio.play('door');
      useWorld.getState().toggleDoor(d.id);
    },
  });
}

export const INTERACTABLES = new Map(DEFS.map((d) => [d.id, d]));

/** Menjalankan interaksi objek bila tidak diblokir. Mengembalikan alasan penolakan bila ada. */
export function interact(id: string): string | null {
  const game = useGame.getState().game;
  const def = INTERACTABLES.get(id);
  if (!game || !def) return null;
  const reason = def.blocked?.(game) ?? null;
  if (reason) {
    audio.play('error');
    return reason;
  }
  def.run(game);
  return null;
}
