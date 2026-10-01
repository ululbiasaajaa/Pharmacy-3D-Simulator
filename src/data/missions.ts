import type { MissionDef } from '@/domain/types';

const ALL = ['career', 'learning', 'challenge'] as const;
const CAREER = ['career'] as const;

export const MISSIONS: MissionDef[] = [
  { id: 'm-first-serve', name: 'Pelanggan Pertama', description: 'Layani satu pasien hingga selesai.', objective: { type: 'serve-patients', target: 1 }, requiredLevel: 1, reward: { money: 100_000, xp: 30, reputation: 1 }, modes: [...ALL] },
  { id: 'm-sales-5', name: 'Kasir Sibuk', description: 'Selesaikan 5 transaksi penjualan.', objective: { type: 'complete-sales', target: 5 }, requiredLevel: 1, requiresMission: 'm-first-serve', reward: { money: 150_000, xp: 40, reputation: 1 }, modes: [...ALL] },
  { id: 'm-first-rx', name: 'Resep Pertama', description: 'Layani satu resep dengan benar.', objective: { type: 'dispense-prescriptions', target: 1 }, requiredLevel: 1, reward: { money: 150_000, xp: 50, reputation: 2 }, modes: [...ALL] },
  { id: 'm-first-order', name: 'Belanja Stok', description: 'Buat satu pesanan ke pemasok.', objective: { type: 'place-orders', target: 1 }, requiredLevel: 1, reward: { money: 50_000, xp: 30, reputation: 0 }, modes: [...ALL] },
  { id: 'm-receive-2', name: 'Barang Datang', description: 'Terima 2 pengiriman ke gudang.', objective: { type: 'receive-orders', target: 2 }, requiredLevel: 1, requiresMission: 'm-first-order', reward: { money: 120_000, xp: 40, reputation: 1 }, modes: [...ALL] },
  { id: 'm-transfer-3', name: 'Rak Selalu Penuh', description: 'Pindahkan stok dari gudang ke rak sebanyak 3 kali.', objective: { type: 'transfer-stock', target: 3 }, requiredLevel: 1, reward: { money: 80_000, xp: 30, reputation: 0 }, modes: [...ALL] },
  { id: 'm-inquiry-5', name: 'Informasi Tepat', description: 'Jawab 5 pertanyaan ketersediaan obat dengan benar.', objective: { type: 'answer-inquiries', target: 5 }, requiredLevel: 1, reward: { money: 100_000, xp: 40, reputation: 2 }, modes: [...ALL] },
  { id: 'm-serve-20', name: 'Pelayanan Prima', description: 'Layani 20 pasien.', objective: { type: 'serve-patients', target: 20 }, requiredLevel: 2, requiresMission: 'm-first-serve', reward: { money: 400_000, xp: 100, reputation: 3 }, modes: [...CAREER] },
  { id: 'm-stock-pct', name: 'Stok Aman Parasetamol', description: 'Miliki minimal 40 strip Parasetamol 500 mg (rak + gudang).', objective: { type: 'stock-medicine', target: 40, medicineId: 'pct-500' }, requiredLevel: 2, reward: { money: 100_000, xp: 40, reputation: 0 }, modes: [...CAREER] },
  { id: 'm-hire', name: 'Membangun Tim', description: 'Rekrut satu pegawai.', objective: { type: 'hire-employee', target: 1 }, requiredLevel: 2, reward: { money: 200_000, xp: 60, reputation: 1 }, modes: ['career', 'learning'] },
  { id: 'm-upgrade', name: 'Investasi Pertama', description: 'Beli satu peningkatan fasilitas.', objective: { type: 'buy-upgrade', target: 1 }, requiredLevel: 2, reward: { money: 200_000, xp: 60, reputation: 1 }, modes: ['career', 'learning'] },
  { id: 'm-revenue-1m', name: 'Omzet Sejuta', description: 'Kumpulkan pendapatan penjualan Rp 1.000.000.', objective: { type: 'revenue-total', target: 1_000_000 }, requiredLevel: 2, reward: { money: 250_000, xp: 80, reputation: 2 }, modes: [...CAREER] },
  { id: 'm-compound-1', name: 'Tangan Peracik', description: 'Selesaikan satu racikan.', objective: { type: 'compound', target: 1 }, requiredLevel: 3, reward: { money: 250_000, xp: 80, reputation: 2 }, modes: ['career', 'learning'] },
  { id: 'm-expired', name: 'Rak Bersih', description: 'Musnahkan satu batch kedaluwarsa.', objective: { type: 'dispose-expired', target: 1 }, requiredLevel: 2, reward: { money: 100_000, xp: 50, reputation: 2 }, modes: ['career', 'learning'] },
  { id: 'm-rx-15', name: 'Andalan Resep', description: 'Layani 15 resep.', objective: { type: 'dispense-prescriptions', target: 15 }, requiredLevel: 3, requiresMission: 'm-first-rx', reward: { money: 600_000, xp: 150, reputation: 3 }, modes: [...CAREER] },
  { id: 'm-rep-70', name: 'Apotek Terpercaya', description: 'Capai reputasi 70.', objective: { type: 'reach-reputation', target: 70 }, requiredLevel: 3, reward: { money: 500_000, xp: 120, reputation: 0 }, modes: [...CAREER] },
  { id: 'm-compound-5', name: 'Laboratorium Aktif', description: 'Selesaikan 5 racikan.', objective: { type: 'compound', target: 5 }, requiredLevel: 4, requiresMission: 'm-compound-1', reward: { money: 700_000, xp: 180, reputation: 3 }, modes: [...CAREER] },
  { id: 'm-serve-100', name: 'Seratus Senyuman', description: 'Layani 100 pasien.', objective: { type: 'serve-patients', target: 100 }, requiredLevel: 4, requiresMission: 'm-serve-20', reward: { money: 1_500_000, xp: 300, reputation: 5 }, modes: [...CAREER] },
  { id: 'm-revenue-10m', name: 'Apotek Sukses', description: 'Kumpulkan pendapatan penjualan Rp 10.000.000.', objective: { type: 'revenue-total', target: 10_000_000 }, requiredLevel: 5, requiresMission: 'm-revenue-1m', reward: { money: 2_000_000, xp: 400, reputation: 5 }, modes: [...CAREER] },
];
