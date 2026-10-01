import type { UpgradeDef } from '@/domain/types';

/**
 * Peningkatan & perluasan. Setiap level memiliki efek permainan nyata yang
 * diagregasi oleh `getEffects()` di domain/upgrades.ts.
 */
export const UPGRADES: UpgradeDef[] = [
  {
    id: 'shelf',
    name: 'Rak Pelayanan Tambahan',
    kind: 'upgrade',
    description: 'Menambah kapasitas rak di area pelayanan.',
    requiredLevel: 2,
    levels: [
      { cost: 800_000, effects: { shelfCapacity: 350 }, description: '+350 kapasitas rak' },
      { cost: 1_600_000, effects: { shelfCapacity: 450 }, description: '+450 kapasitas rak' },
      { cost: 2_800_000, effects: { shelfCapacity: 600 }, description: '+600 kapasitas rak' },
    ],
  },
  {
    id: 'warehouse-rack',
    name: 'Rak Gudang Bertingkat',
    kind: 'upgrade',
    description: 'Rak bertingkat di ruang penyimpanan untuk kapasitas gudang lebih besar.',
    requiredLevel: 2,
    levels: [
      { cost: 700_000, effects: { warehouseCapacity: 1000 }, description: '+1.000 kapasitas gudang' },
      { cost: 1_500_000, effects: { warehouseCapacity: 1500 }, description: '+1.500 kapasitas gudang' },
    ],
  },
  {
    id: 'waiting-room',
    name: 'Ruang Tunggu Nyaman',
    kind: 'upgrade',
    description: 'Kursi tambahan dan ruang tunggu lebih nyaman: antrean lebih panjang, pasien lebih sabar.',
    requiredLevel: 2,
    levels: [
      { cost: 600_000, effects: { queueCapacity: 2, patienceDecay: -0.1 }, description: '+2 antrean, kesabaran turun 10% lebih lambat' },
      { cost: 1_200_000, effects: { queueCapacity: 2, patienceDecay: -0.1 }, description: '+2 antrean, kesabaran turun 10% lebih lambat' },
      { cost: 2_200_000, effects: { queueCapacity: 3, patienceDecay: -0.1 }, description: '+3 antrean, kesabaran turun 10% lebih lambat' },
    ],
  },
  {
    id: 'ac',
    name: 'Pendingin Ruangan',
    kind: 'upgrade',
    description: 'Pasien lebih nyaman, tetapi biaya listrik naik.',
    requiredLevel: 2,
    levels: [{ cost: 1_000_000, effects: { patienceDecay: -0.15, operationalCostMult: 0.08 }, description: 'Kesabaran turun 15% lebih lambat; biaya operasional +8%' }],
  },
  {
    id: 'service-system',
    name: 'Sistem Antrean Digital',
    kind: 'upgrade',
    description: 'Nomor antrean dan alur kerja lebih rapi: pegawai melayani lebih cepat.',
    requiredLevel: 3,
    levels: [
      { cost: 1_200_000, effects: { serviceSpeed: 0.15 }, description: 'Kecepatan layanan pegawai +15%' },
      { cost: 2_400_000, effects: { serviceSpeed: 0.2 }, description: 'Kecepatan layanan pegawai +20%' },
    ],
  },
  {
    id: 'computer',
    name: 'Sistem Komputer Apotek',
    kind: 'upgrade',
    description: 'Level 1 membuka rekomendasi pengadaan otomatis; setiap level mempercepat proses pesanan pemasok.',
    requiredLevel: 2,
    levels: [
      { cost: 900_000, effects: { computerLevel: 1 }, description: 'Rekomendasi pengadaan + waktu kirim −15%' },
      { cost: 2_000_000, effects: { computerLevel: 1 }, description: 'Waktu kirim −15% lagi' },
    ],
  },
  {
    id: 'compounding-equipment',
    name: 'Peralatan Racik Lanjutan',
    kind: 'upgrade',
    description: 'Timbangan analitik dan alat pembagi serbuk: membuka resep racikan serbuk terbagi.',
    requiredLevel: 3,
    levels: [
      { cost: 1_100_000, effects: { compoundingLevel: 1 }, description: 'Membuka racikan serbuk terbagi' },
      { cost: 2_000_000, effects: { compoundingLevel: 1 }, description: 'Timbangan presisi (toleransi tampilan lebih akurat)' },
    ],
  },
  {
    id: 'decor',
    name: 'Dekorasi & Tanaman',
    kind: 'cosmetic',
    description: 'Tanaman, poster edukasi, dan pencahayaan hangat. Sedikit meningkatkan perolehan reputasi.',
    requiredLevel: 2,
    levels: [
      { cost: 300_000, effects: { reputationGain: 0.1 }, description: 'Tanaman hias (+10% reputasi dari layanan)' },
      { cost: 700_000, effects: { reputationGain: 0.1 }, description: 'Poster edukasi (+10% reputasi)' },
      { cost: 1_300_000, effects: { reputationGain: 0.1 }, description: 'Pencahayaan hangat (+10% reputasi)' },
    ],
  },
  {
    id: 'exp-big-warehouse',
    name: 'Perluasan: Gudang Besar',
    kind: 'expansion',
    description: 'Membuka ruang gudang tambahan di sayap belakang.',
    requiredLevel: 4,
    unlocksRoom: 'big-warehouse',
    levels: [{ cost: 4_000_000, effects: { warehouseCapacity: 3000, operationalCostMult: 0.05 }, description: '+3.000 kapasitas gudang; biaya operasional +5%' }],
  },
  {
    id: 'exp-counter-2',
    name: 'Perluasan: Loket Pelayanan Kedua',
    kind: 'expansion',
    description: 'Loket tambahan agar pegawai dapat melayani lebih banyak pasien sekaligus.',
    requiredLevel: 4,
    unlocksRoom: 'counter-2',
    levels: [{ cost: 3_500_000, effects: { serviceCounters: 1, queueCapacity: 3, spawnRate: 0.1 }, description: '+1 loket pegawai, +3 antrean, kunjungan +10%' }],
  },
  {
    id: 'exp-lab-2',
    name: 'Perluasan: Ruang Racik Kedua',
    kind: 'expansion',
    description: 'Ruang racik tambahan: peralatan lebih lengkap dan satu pegawai tambahan.',
    requiredLevel: 5,
    unlocksRoom: 'lab-2',
    levels: [{ cost: 3_000_000, effects: { compoundingLevel: 1, maxEmployees: 1 }, description: '+1 level peralatan racik, +1 slot pegawai' }],
  },
  {
    id: 'exp-admin',
    name: 'Perluasan: Ruang Administrasi',
    kind: 'expansion',
    description: 'Ruang administrasi yang lebih besar: operasional lebih efisien.',
    requiredLevel: 4,
    unlocksRoom: 'admin-plus',
    levels: [{ cost: 2_500_000, effects: { computerLevel: 1, operationalCostMult: -0.12, maxEmployees: 1 }, description: 'Biaya operasional −12%, waktu kirim −15%, +1 slot pegawai' }],
  },
  {
    id: 'exp-lounge',
    name: 'Perluasan: Ruang Istirahat Pegawai',
    kind: 'expansion',
    description: 'Pegawai pulih lebih cepat dan tim dapat bertambah.',
    requiredLevel: 4,
    unlocksRoom: 'staff-lounge',
    levels: [{ cost: 2_000_000, effects: { energyRecovery: 1, maxEmployees: 1 }, description: 'Pemulihan energi 2×, +1 slot pegawai' }],
  },
];
