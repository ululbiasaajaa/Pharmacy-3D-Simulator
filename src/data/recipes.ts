import type { CompoundingRecipe, CompoundingStep } from '@/domain/types';

const DISCLAIMER =
  'Skenario latihan permainan. Komposisi dan langkah disederhanakan dan tidak menggantikan pelatihan, standar, atau prosedur peracikan nyata.';

export const RECIPES: CompoundingRecipe[] = [
  {
    id: 'rcp-zno-salep',
    name: 'Salep Seng Oksida 10% (latihan)',
    description: 'Buat 50 g salep: seng oksida digerus halus lalu dicampur bertahap dengan basis vaselin.',
    ingredients: [
      { medicineId: 'zno', amount: 5, tolerance: 0.05 },
      { medicineId: 'vas-alb', amount: 45, tolerance: 0.05 },
    ],
    steps: ['weigh', 'grind', 'mix', 'container', 'label'],
    container: 'Pot salep 50 g',
    containerOptions: ['Pot salep 50 g', 'Botol sirup 60 mL', 'Kertas puyer'],
    labelInstructions: 'Obat luar. Oleskan tipis sesuai petunjuk.',
    price: 35_000,
    requiredEquipmentLevel: 0,
    disclaimer: DISCLAIMER,
  },
  {
    id: 'rcp-bedak-salisil',
    name: 'Bedak Salisil 2% (latihan)',
    description: 'Buat 100 g serbuk tabur: asam salisilat digerus lalu dicampur homogen dengan talkum.',
    ingredients: [
      { medicineId: 'sal-acid', amount: 2, tolerance: 0.05 },
      { medicineId: 'talk', amount: 98, tolerance: 0.05 },
    ],
    steps: ['weigh', 'grind', 'mix', 'container', 'label'],
    container: 'Botol bedak tabur',
    containerOptions: ['Botol bedak tabur', 'Pot salep 50 g', 'Botol sirup 60 mL'],
    labelInstructions: 'Obat luar. Taburkan tipis pada kulit.',
    price: 30_000,
    requiredEquipmentLevel: 0,
    disclaimer: DISCLAIMER,
  },
  {
    id: 'rcp-puyer-vitc',
    name: 'Serbuk Terbagi Vitamin C (latihan)',
    description: 'Campur asam askorbat dengan laktosa hingga homogen, lalu bagi rata menjadi 10 bungkus.',
    ingredients: [
      { medicineId: 'asc-pow', amount: 5, tolerance: 0.04 },
      { medicineId: 'lakt', amount: 5, tolerance: 0.06 },
    ],
    steps: ['weigh', 'grind', 'mix', 'divide', 'container', 'label'],
    container: 'Kertas puyer',
    containerOptions: ['Kertas puyer', 'Pot salep 50 g', 'Botol bedak tabur'],
    divideInto: 10,
    labelInstructions: 'Sesuai petunjuk pada etiket skenario.',
    price: 40_000,
    requiredEquipmentLevel: 1,
    disclaimer: DISCLAIMER,
  },
];

export const STEP_LABELS: Record<CompoundingStep, string> = {
  weigh: 'Menimbang bahan',
  grind: 'Menggerus di mortir',
  mix: 'Mencampur hingga homogen',
  divide: 'Membagi serbuk',
  container: 'Memasukkan ke wadah',
  label: 'Membuat etiket',
};
