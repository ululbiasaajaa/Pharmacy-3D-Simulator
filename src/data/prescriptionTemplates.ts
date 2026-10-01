import type { DosageForm } from '@/domain/types';

/**
 * Templat resep FIKTIF untuk simulasi alur kerja pelayanan resep.
 * Tidak menggambarkan terapi yang benar untuk kondisi nyata mana pun.
 */
export interface RxTemplateItem {
  medicineId: string;
  writtenName: string;
  strength: string;
  form: DosageForm;
  qty: [number, number];
  instructions: string;
}

export interface RxTemplate {
  id: string;
  items: RxTemplateItem[];
  notes: string;
  refillable: boolean;
}

export const RX_TEMPLATES: RxTemplate[] = [
  {
    id: 'rx-a',
    items: [
      { medicineId: 'amox-500', writtenName: 'Amoksisilin 500 mg caps', strength: '500 mg', form: 'kapsul', qty: [1, 2], instructions: '3 x sehari 1 kapsul, sesudah makan, dihabiskan' },
      { medicineId: 'pct-500', writtenName: 'Parasetamol 500 mg tab', strength: '500 mg', form: 'tablet', qty: [1, 1], instructions: '3 x sehari 1 tablet bila perlu' },
    ],
    notes: 'Contoh resep simulasi.',
    refillable: false,
  },
  {
    id: 'rx-b',
    items: [{ medicineId: 'amlo-5', writtenName: 'Amlodipin 5 mg tab', strength: '5 mg', form: 'tablet', qty: [2, 3], instructions: '1 x sehari 1 tablet, pagi hari' }],
    notes: 'Contoh resep simulasi.',
    refillable: true,
  },
  {
    id: 'rx-c',
    items: [
      { medicineId: 'met-500', writtenName: 'Metformin 500 mg tab', strength: '500 mg', form: 'tablet', qty: [2, 3], instructions: '2 x sehari 1 tablet, sesudah makan' },
      { medicineId: 'sim-10', writtenName: 'Simvastatin 10 mg tab', strength: '10 mg', form: 'tablet', qty: [1, 2], instructions: '1 x sehari 1 tablet, malam hari' },
    ],
    notes: 'Contoh resep simulasi.',
    refillable: true,
  },
  {
    id: 'rx-d',
    items: [
      { medicineId: 'ome-20', writtenName: 'Omeprazol 20 mg caps', strength: '20 mg', form: 'kapsul', qty: [1, 2], instructions: '1 x sehari 1 kapsul, sebelum makan' },
      { medicineId: 'ant-sus', writtenName: 'Antasida susp', strength: '200 mg/200 mg per 5 mL', form: 'suspensi', qty: [1, 1], instructions: '3 x sehari 1 sendok takar' },
    ],
    notes: 'Contoh resep simulasi.',
    refillable: false,
  },
  {
    id: 'rx-e',
    items: [
      { medicineId: 'mef-500', writtenName: 'Asam Mefenamat 500 mg', strength: '500 mg', form: 'kaplet', qty: [1, 1], instructions: '3 x sehari 1 kaplet bila nyeri, sesudah makan' },
      { medicineId: 'gen-sal', writtenName: 'Gentamisin salep 0,1%', strength: '0,1%', form: 'salep', qty: [1, 1], instructions: 'Oleskan tipis 2 x sehari pada area luka' },
    ],
    notes: 'Contoh resep simulasi.',
    refillable: false,
  },
  {
    id: 'rx-f',
    items: [
      { medicineId: 'ibu-400', writtenName: 'Ibuprofen 400 mg tab', strength: '400 mg', form: 'tablet', qty: [1, 1], instructions: '3 x sehari 1 tablet, sesudah makan' },
      { medicineId: 'cet-10', writtenName: 'Setirizin 10 mg tab', strength: '10 mg', form: 'tablet', qty: [1, 1], instructions: '1 x sehari 1 tablet, malam hari' },
    ],
    notes: 'Contoh resep simulasi.',
    refillable: false,
  },
  {
    id: 'rx-g',
    items: [{ medicineId: 'ins-pen', writtenName: 'Insulin pen 100 IU/mL', strength: '100 IU/mL', form: 'cairan', qty: [1, 1], instructions: 'Sesuai petunjuk dokter; simpan di lemari pendingin' }],
    notes: 'Contoh resep simulasi. Produk rantai dingin.',
    refillable: true,
  },
];

/** Varian kekuatan yang tidak tersedia di katalog — dipakai untuk menyisipkan masalah resep. */
export const UNAVAILABLE_STRENGTHS: Record<string, string> = {
  'amlo-5': '7,5 mg',
  'amox-500': '750 mg',
  'met-500': '750 mg',
  'ome-20': '30 mg',
  'sim-10': '15 mg',
  'mef-500': '250 mg',
  'ibu-400': '600 mg',
};

/** Pilihan aturan pakai yang tersedia pada pembuat etiket. */
export const LABEL_INSTRUCTION_OPTIONS = [
  '1 x sehari 1 tablet, pagi hari',
  '1 x sehari 1 tablet, malam hari',
  '1 x sehari 1 kapsul, sebelum makan',
  '2 x sehari 1 tablet, sesudah makan',
  '3 x sehari 1 tablet bila perlu',
  '3 x sehari 1 tablet, sesudah makan',
  '3 x sehari 1 kapsul, sesudah makan, dihabiskan',
  '3 x sehari 1 kaplet bila nyeri, sesudah makan',
  '3 x sehari 1 sendok takar',
  'Oleskan tipis 2 x sehari pada area luka',
  'Sesuai petunjuk dokter; simpan di lemari pendingin',
];
