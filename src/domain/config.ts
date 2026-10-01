/**
 * Konfigurasi ekonomi & keseimbangan. Semua angka dapat diubah di sini tanpa
 * menyentuh logika permainan.
 */
export const ECONOMY = {
  startingMoney: { career: 6_000_000, learning: 10_000_000 } as Record<'career' | 'learning', number>,
  /** Biaya operasional harian (listrik, sewa, kebersihan). */
  baseOperationalCost: 180_000,
  /** Hari awal dengan biaya operasional dikurangi (masa adaptasi). */
  graceDays: 3,
  graceCostMult: 0.5,
  /** Batas kredit darurat sebelum dianggap bangkrut. */
  emergencyCreditLimit: -1_500_000,
  /** Jumlah hari berturut-turut di bawah batas kredit sebelum game over. */
  bankruptcyDays: 3,
  /** Biaya jasa pelayanan resep per lembar. */
  prescriptionServiceFee: 5_000,
  /** Jasa peracikan tambahan. */
  compoundingServiceFee: 15_000,
  /** Denda pemeriksaan jika ada stok kedaluwarsa di rak. */
  inspectionFinePerBatch: 150_000,
  inspectionReward: 250_000,
  cancelOrderRefundRate: 1,
};

export const TIME = {
  openMinute: 8 * 60,
  closeMinute: 20 * 60,
  lastArrivalMinute: 19 * 60 + 30,
  preopenMinute: 7 * 60 + 30,
  minutesPerDay: 1440,
  /** Detik nyata per menit permainan pada kecepatan 1x (1 hari kerja ≈ 24 menit nyata). */
  realSecondsPerGameMinute: 2,
  nearExpiryDays: 30,
};

export const PATIENTS = {
  baseArrivalIntervalMin: 12,
  baseArrivalIntervalMax: 24,
  basePatience: 100,
  /** Pengurangan kesabaran per menit saat menunggu. */
  patienceDecayPerMinute: 1.2,
  /** Pengurangan kesabaran per menit saat sedang dilayani. */
  servingDecayPerMinute: 0.35,
  baseQueueCapacity: 5,
  reputationLossOnLeave: 2,
  reputationLossOnTurnAway: 0.5,
  reputationGainOnServe: 0.6,
};

export const CAPACITY = {
  baseShelf: 900,
  baseWarehouse: 2500,
  baseMaxEmployees: 2,
  baseCounters: 1,
};

export const PROGRESSION = {
  xpPerLevel: (level: number) => 200 + (level - 1) * 150,
  maxLevel: 20,
  startReputation: 50,
};

/** Fitur yang dibuka bertahap pada mode karier (level minimum). */
export const FEATURE_UNLOCKS = {
  service: 1,
  pos: 1,
  inventory: 1,
  catalog: 1,
  procurement: 1,
  missions: 1,
  finance: 1,
  employees: 2,
  upgrades: 2,
  compounding: 3,
  events: 3,
  expansions: 4,
} as const;

export type FeatureKey = keyof typeof FEATURE_UNLOCKS;

export const XP = {
  serve: 10,
  prescription: 25,
  perfectPrescription: 15,
  compounding: 35,
  sale: 5,
  inquiry: 6,
  orderReceived: 8,
  upgrade: 20,
};
