import type { Supplier } from '@/domain/types';
import { MEDICINES } from './medicines';

/** Pemasok fiktif. Harga beli = harga dasar × pengali harga pemasok. */
const byIds = (ids: string[] | 'all', mult: number) =>
  MEDICINES.filter((m) => ids === 'all' || ids.includes(m.id)).map((m) => ({
    medicineId: m.id,
    unitCost: Math.max(10, Math.round((m.buyPrice * mult) / 10) * 10),
  }));

const OTC = MEDICINES.filter((m) => !m.prescriptionOnly && m.category !== 'bahan-racik').map((m) => m.id);
const RX = MEDICINES.filter((m) => m.prescriptionOnly).map((m) => m.id);
const BAHAN = MEDICINES.filter((m) => m.category === 'bahan-racik').map((m) => m.id);

export const SUPPLIERS: Supplier[] = [
  {
    id: 'sup-cepat',
    name: 'PBF Cepat Sehat (fiktif)',
    products: byIds(OTC, 1.08),
    leadTimeHours: 4,
    reliability: 0.95,
    relationship: 'baru',
    reputation: 70,
    minOrder: 100_000,
    shelfLifeDays: [90, 240],
    ordersCompleted: 0,
  },
  {
    id: 'sup-hemat',
    name: 'PBF Hemat Farma (fiktif)',
    products: byIds([...OTC, ...RX], 0.9),
    leadTimeHours: 20,
    reliability: 0.75,
    relationship: 'baru',
    reputation: 55,
    minOrder: 300_000,
    shelfLifeDays: [40, 180],
    ordersCompleted: 0,
  },
  {
    id: 'sup-lengkap',
    name: 'PBF Nusantara Lengkap (fiktif)',
    products: byIds('all', 1.0),
    leadTimeHours: 10,
    reliability: 0.88,
    relationship: 'baru',
    reputation: 65,
    minOrder: 200_000,
    shelfLifeDays: [120, 360],
    ordersCompleted: 0,
  },
  {
    id: 'sup-bahan',
    name: 'CV Bahan Racik Mandiri (fiktif)',
    products: byIds(BAHAN, 0.95),
    leadTimeHours: 8,
    reliability: 0.9,
    relationship: 'baru',
    reputation: 60,
    minOrder: 50_000,
    shelfLifeDays: [180, 540],
    ordersCompleted: 0,
  },
];
