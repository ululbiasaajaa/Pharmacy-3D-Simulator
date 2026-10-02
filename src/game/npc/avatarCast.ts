import type { EmployeeRole } from '@/domain/types';

/**
 * Pemetaan pemeran → avatar Rocketbox (ART_DIRECTION.md §5). Pilihan deterministik dari hash gaya
 * sehingga pasien yang sama selalu tampil sama (termasuk setelah simpan/muat).
 * Kriteria: wajah Asia/sawo matang & busana sopan untuk pasien; seragam yang terbaca untuk pegawai;
 * apoteker berjas putih tanpa stetoskop (atribut dokter).
 */
const F_PATIENT = ['Female_Adult_03', 'Female_Adult_05', 'Female_Adult_07', 'Female_Adult_12', 'Female_Adult_09', 'Business_Female_01'];
/** Berjilbab: dua avatar Rocketbox + varian warna busana dari pipeline (scripts/assets/characters.mjs). */
const F_HIJAB = ['Female_Adult_10', 'Female_Adult_10_b', 'Female_Adult_10_c', 'Female_Adult_10_d', 'Female_Adult_06_b', 'Female_Adult_06_c'];
const F_HIJAB_ELDERLY = ['Female_Adult_06', 'Female_Adult_06_b', 'Female_Adult_06_c', 'Female_Adult_06_d'];
const F_ELDERLY = ['Female_Adult_06', 'Female_Adult_09'];
const M_PATIENT = ['Male_Adult_09', 'Male_Adult_10', 'Male_Adult_17', 'Male_Adult_04', 'Male_Adult_07', 'Male_Adult_01'];
const M_ELDERLY = ['Male_Adult_03', 'Male_Adult_05', 'Male_Adult_14'];
/** Baju koko & kopiah. */
const M_PECI = 'Male_Adult_15';

const STAFF: Record<EmployeeRole, { f: string; m: string }> = {
  pharmacist: { f: 'Medical_Female_01', m: 'Medical_Male_01' },
  assistant: { f: 'Female_Adult_09', m: 'Male_Adult_01' },
  cashier: { f: 'Female_Adult_15', m: 'Male_Adult_08' },
  warehouse: { f: 'Female_Adult_13', m: 'Male_Adult_11' },
  manager: { f: 'Business_Female_01', m: 'Business_Male_06' },
};

export const PLAYER_AVATAR = 'Medical_Male_01';

const pick = (list: string[], h: number) => list[h % list.length];

export function patientAvatar(p: { female: boolean; elderly: boolean; hijab: boolean; peci: boolean }, h: number): string {
  if (p.female) {
    if (p.hijab) return pick(p.elderly ? F_HIJAB_ELDERLY : F_HIJAB, h >>> 3);
    return pick(p.elderly ? F_ELDERLY : F_PATIENT, h >>> 5);
  }
  if (p.peci) return M_PECI;
  return pick(p.elderly ? M_ELDERLY : M_PATIENT, h >>> 5);
}

export function staffAvatar(role: EmployeeRole, female: boolean): string {
  return STAFF[role][female ? 'f' : 'm'];
}
