import type { AchievementDef } from '@/domain/types';

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a-serve-1', name: 'Langkah Pertama', description: 'Layani pasien pertama.', stat: 'patientsServed', threshold: 1, rewardXp: 20 },
  { id: 'a-serve-50', name: 'Ramah & Sigap', description: 'Layani 50 pasien.', stat: 'patientsServed', threshold: 50, rewardXp: 100 },
  { id: 'a-serve-250', name: 'Legenda Lingkungan', description: 'Layani 250 pasien.', stat: 'patientsServed', threshold: 250, rewardXp: 300 },
  { id: 'a-sales-100', name: 'Mesin Kasir Berdering', description: 'Selesaikan 100 transaksi.', stat: 'salesCompleted', threshold: 100, rewardXp: 150 },
  { id: 'a-rx-10', name: 'Pembaca Resep', description: 'Layani 10 resep.', stat: 'prescriptionsDispensed', threshold: 10, rewardXp: 80 },
  { id: 'a-rx-50', name: 'Ahli Pelayanan Resep', description: 'Layani 50 resep.', stat: 'prescriptionsDispensed', threshold: 50, rewardXp: 250 },
  { id: 'a-perfect-10', name: 'Tanpa Cela', description: 'Layani 10 resep dengan skor sempurna.', stat: 'perfectPrescriptions', threshold: 10, rewardXp: 150 },
  { id: 'a-issue-5', name: 'Mata Jeli', description: 'Temukan 5 masalah kelengkapan resep.', stat: 'issuesDetected', threshold: 5, rewardXp: 100 },
  { id: 'a-compound-perfect-5', name: 'Peracik Presisi', description: '5 racikan dengan nilai sempurna.', stat: 'compoundingPerfect', threshold: 5, rewardXp: 150 },
  { id: 'a-orders-10', name: 'Rantai Pasok Lancar', description: 'Terima 10 pengiriman.', stat: 'ordersReceived', threshold: 10, rewardXp: 100 },
  { id: 'a-upgrades-5', name: 'Arsitek Apotek', description: 'Beli 5 peningkatan.', stat: 'upgradesBought', threshold: 5, rewardXp: 150 },
  { id: 'a-hire-3', name: 'Pemimpin Tim', description: 'Rekrut 3 pegawai.', stat: 'employeesHired', threshold: 3, rewardXp: 100 },
  { id: 'a-days-7', name: 'Seminggu Bertahan', description: 'Selesaikan 7 hari operasional.', stat: 'daysCompleted', threshold: 7, rewardXp: 150 },
  { id: 'a-days-30', name: 'Bulan Pertama', description: 'Selesaikan 30 hari operasional.', stat: 'daysCompleted', threshold: 30, rewardXp: 400 },
  { id: 'a-rev-5m', name: 'Omzet 5 Juta', description: 'Total pendapatan Rp 5.000.000.', stat: 'totalRevenue', threshold: 5_000_000, rewardXp: 150 },
  { id: 'a-rev-50m', name: 'Omzet 50 Juta', description: 'Total pendapatan Rp 50.000.000.', stat: 'totalRevenue', threshold: 50_000_000, rewardXp: 500 },
  { id: 'a-expired-5', name: 'Penjaga Mutu', description: 'Musnahkan 5 batch kedaluwarsa.', stat: 'expiredDisposed', threshold: 5, rewardXp: 80 },
  { id: 'a-inquiry-20', name: 'Pusat Informasi', description: 'Jawab 20 pertanyaan ketersediaan.', stat: 'inquiriesAnswered', threshold: 20, rewardXp: 100 },
];
