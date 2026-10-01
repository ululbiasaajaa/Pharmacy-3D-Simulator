import type { Medicine, MedicineCategory, SymptomKey } from '@/domain/types';

/**
 * Katalog awal. SELURUH data adalah CONTOH SIMULASI untuk keperluan permainan.
 * Harga, kekuatan, dan deskripsi disederhanakan dan TIDAK boleh dianggap sebagai
 * informasi klinis atau rekomendasi pengobatan.
 */
type Seed = Omit<Medicine, 'active' | 'dataStatus' | 'refrigerated' | 'prescriptionOnly' | 'volume'> &
  Partial<Pick<Medicine, 'refrigerated' | 'prescriptionOnly' | 'volume'>>;

const seeds: Seed[] = [
  // Analgesik / antipiretik
  { id: 'pct-500', name: 'Parasetamol 500 mg', genericName: 'Parasetamol', category: 'analgesik', strength: '500 mg', form: 'tablet', buyPrice: 2_500, sellPrice: 4_000, unit: 'strip', minStock: 15, description: 'Strip isi 10 tablet. Contoh produk analgesik-antipiretik bebas.' },
  { id: 'pct-syr', name: 'Parasetamol Sirup 120 mg/5 mL', genericName: 'Parasetamol', category: 'antipiretik', strength: '120 mg/5 mL', form: 'sirup', buyPrice: 9_000, sellPrice: 14_000, unit: 'botol', minStock: 6, description: 'Botol 60 mL. Contoh sediaan sirup untuk simulasi.', volume: 2 },
  { id: 'ibu-200', name: 'Ibuprofen 200 mg', genericName: 'Ibuprofen', category: 'analgesik', strength: '200 mg', form: 'tablet', buyPrice: 4_000, sellPrice: 6_500, unit: 'strip', minStock: 8, description: 'Strip isi 10 tablet. Contoh produk analgesik.' },
  { id: 'ibu-400', name: 'Ibuprofen 400 mg', genericName: 'Ibuprofen', category: 'resep', strength: '400 mg', form: 'tablet', buyPrice: 6_000, sellPrice: 10_000, unit: 'strip', minStock: 6, description: 'Strip isi 10 tablet. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  { id: 'mef-500', name: 'Asam Mefenamat 500 mg', genericName: 'Asam mefenamat', category: 'resep', strength: '500 mg', form: 'kaplet', buyPrice: 5_000, sellPrice: 8_500, unit: 'strip', minStock: 6, description: 'Strip isi 10 kaplet. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  // Antasida
  { id: 'ant-tab', name: 'Antasida Tablet Kunyah', genericName: 'Aluminium hidroksida + Magnesium hidroksida', category: 'antasida', strength: '200 mg/200 mg', form: 'tablet', buyPrice: 2_000, sellPrice: 3_500, unit: 'strip', minStock: 10, description: 'Strip isi 10 tablet kunyah. Contoh produk antasida.' },
  { id: 'ant-sus', name: 'Antasida Suspensi', genericName: 'Aluminium hidroksida + Magnesium hidroksida', category: 'antasida', strength: '200 mg/200 mg per 5 mL', form: 'suspensi', buyPrice: 8_000, sellPrice: 13_000, unit: 'botol', minStock: 5, description: 'Botol 60 mL. Contoh sediaan suspensi.', volume: 2 },
  { id: 'ome-20', name: 'Omeprazol 20 mg', genericName: 'Omeprazol', category: 'resep', strength: '20 mg', form: 'kapsul', buyPrice: 7_000, sellPrice: 12_000, unit: 'strip', minStock: 5, description: 'Strip isi 10 kapsul. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  // Vitamin
  { id: 'vitc-500', name: 'Vitamin C 500 mg', genericName: 'Asam askorbat', category: 'vitamin', strength: '500 mg', form: 'tablet', buyPrice: 5_000, sellPrice: 8_000, unit: 'strip', minStock: 10, description: 'Strip isi 10 tablet. Contoh suplemen vitamin.' },
  { id: 'vitb-kom', name: 'Vitamin B Kompleks', genericName: 'Vitamin B kompleks', category: 'vitamin', strength: '-', form: 'tablet', buyPrice: 3_000, sellPrice: 5_000, unit: 'strip', minStock: 8, description: 'Strip isi 10 tablet. Contoh suplemen vitamin.' },
  { id: 'multi-syr', name: 'Multivitamin Sirup Anak', genericName: 'Multivitamin', category: 'vitamin', strength: '60 mL', form: 'sirup', buyPrice: 15_000, sellPrice: 24_000, unit: 'botol', minStock: 4, description: 'Botol 60 mL. Contoh suplemen untuk simulasi.', volume: 2 },
  { id: 'fe-fol', name: 'Tablet Besi Folat', genericName: 'Ferro sulfat + Asam folat', category: 'vitamin', strength: '-', form: 'tablet', buyPrice: 3_500, sellPrice: 6_000, unit: 'strip', minStock: 6, description: 'Strip isi 10 tablet. Contoh suplemen.' },
  // Batuk & pilek
  { id: 'gg-100', name: 'Gliseril Guaiakolat 100 mg', genericName: 'Gliseril guaiakolat', category: 'batuk-pilek', strength: '100 mg', form: 'tablet', buyPrice: 2_000, sellPrice: 3_500, unit: 'strip', minStock: 8, description: 'Strip isi 10 tablet. Contoh produk ekspektoran.' },
  { id: 'obh-syr', name: 'Sirup Obat Batuk Hitam', genericName: 'Succus liquiritiae + Amonium klorida', category: 'batuk-pilek', strength: '100 mL', form: 'sirup', buyPrice: 7_000, sellPrice: 11_500, unit: 'botol', minStock: 6, description: 'Botol 100 mL. Contoh sirup batuk.', volume: 2 },
  { id: 'dmp-15', name: 'Dekstrometorfan 15 mg', genericName: 'Dekstrometorfan HBr', category: 'batuk-pilek', strength: '15 mg', form: 'tablet', buyPrice: 2_500, sellPrice: 4_000, unit: 'strip', minStock: 6, description: 'Strip isi 10 tablet. Contoh produk antitusif.' },
  { id: 'ctm-4', name: 'Klorfeniramin Maleat 4 mg', genericName: 'Klorfeniramin maleat', category: 'batuk-pilek', strength: '4 mg', form: 'tablet', buyPrice: 1_000, sellPrice: 2_000, unit: 'strip', minStock: 10, description: 'Strip isi 10 tablet. Contoh antihistamin.' },
  { id: 'cet-10', name: 'Setirizin 10 mg', genericName: 'Setirizin HCl', category: 'batuk-pilek', strength: '10 mg', form: 'tablet', buyPrice: 3_000, sellPrice: 5_500, unit: 'strip', minStock: 6, description: 'Strip isi 10 tablet. Contoh antihistamin.' },
  // Topikal
  { id: 'pvi-10', name: 'Povidon Iodin 10%', genericName: 'Povidon iodin', category: 'topikal', strength: '10%', form: 'cairan', buyPrice: 8_000, sellPrice: 13_000, unit: 'botol', minStock: 5, description: 'Botol 30 mL. Contoh antiseptik luar.', volume: 1.5 },
  { id: 'kal-los', name: 'Losion Kalamin', genericName: 'Kalamin + Seng oksida', category: 'topikal', strength: '60 mL', form: 'cairan', buyPrice: 9_000, sellPrice: 15_000, unit: 'botol', minStock: 4, description: 'Botol 60 mL. Contoh losion untuk kulit.', volume: 2 },
  { id: 'gen-sal', name: 'Salep Gentamisin 0,1%', genericName: 'Gentamisin sulfat', category: 'resep', strength: '0,1%', form: 'salep', buyPrice: 6_000, sellPrice: 11_000, unit: 'tube', minStock: 4, description: 'Tube 5 g. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  // Kesehatan umum
  { id: 'oralit', name: 'Oralit', genericName: 'Garam rehidrasi oral', category: 'kesehatan-umum', strength: '200 mL', form: 'serbuk', buyPrice: 800, sellPrice: 1_500, unit: 'sachet', minStock: 15, description: 'Sachet untuk dilarutkan. Contoh produk kesehatan.', volume: 0.5 },
  { id: 'masker', name: 'Masker Medis (isi 50)', genericName: 'Masker medis', category: 'kesehatan-umum', strength: '-', form: 'alat', buyPrice: 18_000, sellPrice: 30_000, unit: 'box', minStock: 4, description: 'Kotak isi 50 lembar.', volume: 4 },
  { id: 'plester', name: 'Plester Luka (isi 10)', genericName: 'Plester', category: 'kesehatan-umum', strength: '-', form: 'alat', buyPrice: 4_000, sellPrice: 7_000, unit: 'pak', minStock: 8, description: 'Pak isi 10 lembar.' },
  { id: 'kasa', name: 'Kasa Steril (isi 16)', genericName: 'Kasa steril', category: 'kesehatan-umum', strength: '-', form: 'alat', buyPrice: 5_000, sellPrice: 9_000, unit: 'pak', minStock: 5, description: 'Pak isi 16 lembar kasa.' },
  { id: 'termo', name: 'Termometer Digital', genericName: 'Termometer', category: 'kesehatan-umum', strength: '-', form: 'alat', buyPrice: 25_000, sellPrice: 42_000, unit: 'pcs', minStock: 2, description: 'Termometer digital untuk penggunaan rumah.', volume: 2 },
  { id: 'mkp-60', name: 'Minyak Kayu Putih 60 mL', genericName: 'Oleum cajuputi', category: 'kesehatan-umum', strength: '60 mL', form: 'cairan', buyPrice: 12_000, sellPrice: 19_000, unit: 'botol', minStock: 5, description: 'Botol 60 mL.', volume: 2 },
  // Obat resep
  { id: 'amox-500', name: 'Amoksisilin 500 mg', genericName: 'Amoksisilin', category: 'resep', strength: '500 mg', form: 'kapsul', buyPrice: 4_500, sellPrice: 8_000, unit: 'strip', minStock: 8, description: 'Strip isi 10 kapsul. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  { id: 'amlo-5', name: 'Amlodipin 5 mg', genericName: 'Amlodipin besilat', category: 'resep', strength: '5 mg', form: 'tablet', buyPrice: 3_000, sellPrice: 6_000, unit: 'strip', minStock: 6, description: 'Strip isi 10 tablet. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  { id: 'amlo-10', name: 'Amlodipin 10 mg', genericName: 'Amlodipin besilat', category: 'resep', strength: '10 mg', form: 'tablet', buyPrice: 4_500, sellPrice: 8_000, unit: 'strip', minStock: 4, description: 'Strip isi 10 tablet. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  { id: 'met-500', name: 'Metformin 500 mg', genericName: 'Metformin HCl', category: 'resep', strength: '500 mg', form: 'tablet', buyPrice: 2_500, sellPrice: 5_000, unit: 'strip', minStock: 6, description: 'Strip isi 10 tablet. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  { id: 'sim-10', name: 'Simvastatin 10 mg', genericName: 'Simvastatin', category: 'resep', strength: '10 mg', form: 'tablet', buyPrice: 3_500, sellPrice: 7_000, unit: 'strip', minStock: 4, description: 'Strip isi 10 tablet. Dalam simulasi hanya diserahkan dengan resep.', prescriptionOnly: true },
  { id: 'ins-pen', name: 'Insulin Pen (contoh)', genericName: 'Insulin', category: 'resep', strength: '100 IU/mL', form: 'cairan', buyPrice: 85_000, sellPrice: 120_000, unit: 'pen', minStock: 2, description: 'Contoh produk yang perlu disimpan di lemari pendingin. Hanya dengan resep.', prescriptionOnly: true, refrigerated: true, volume: 1 },
  // Bahan racik (satuan gram, tidak dijual langsung)
  { id: 'zno', name: 'Seng Oksida (bahan)', genericName: 'Zinci oxydum', category: 'bahan-racik', strength: 'serbuk', form: 'serbuk', buyPrice: 120, sellPrice: 0, unit: 'gram', minStock: 50, description: 'Bahan racik simulasi.', volume: 0.02 },
  { id: 'vas-alb', name: 'Vaselin Putih (bahan)', genericName: 'Vaselinum album', category: 'bahan-racik', strength: 'basis', form: 'salep', buyPrice: 60, sellPrice: 0, unit: 'gram', minStock: 200, description: 'Bahan dasar salep untuk simulasi.', volume: 0.02 },
  { id: 'talk', name: 'Talkum (bahan)', genericName: 'Talcum', category: 'bahan-racik', strength: 'serbuk', form: 'serbuk', buyPrice: 40, sellPrice: 0, unit: 'gram', minStock: 200, description: 'Bahan racik simulasi.', volume: 0.02 },
  { id: 'sal-acid', name: 'Asam Salisilat (bahan)', genericName: 'Acidum salicylicum', category: 'bahan-racik', strength: 'serbuk', form: 'serbuk', buyPrice: 200, sellPrice: 0, unit: 'gram', minStock: 20, description: 'Bahan racik simulasi.', volume: 0.02 },
  { id: 'asc-pow', name: 'Asam Askorbat (bahan)', genericName: 'Acidum ascorbicum', category: 'bahan-racik', strength: 'serbuk', form: 'serbuk', buyPrice: 250, sellPrice: 0, unit: 'gram', minStock: 20, description: 'Bahan racik simulasi.', volume: 0.02 },
  { id: 'lakt', name: 'Laktosa (bahan)', genericName: 'Lactosum', category: 'bahan-racik', strength: 'serbuk', form: 'serbuk', buyPrice: 50, sellPrice: 0, unit: 'gram', minStock: 100, description: 'Bahan pengisi simulasi.', volume: 0.02 },
];

export const MEDICINES: Medicine[] = seeds.map((s) => ({
  volume: 1,
  prescriptionOnly: false,
  refrigerated: false,
  ...s,
  active: true,
  dataStatus: 'contoh-simulasi',
}));

export const CATEGORY_LABELS: Record<MedicineCategory, string> = {
  analgesik: 'Analgesik',
  antipiretik: 'Antipiretik',
  antasida: 'Antasida',
  vitamin: 'Vitamin & Suplemen',
  'batuk-pilek': 'Batuk & Pilek',
  topikal: 'Obat Luar (Topikal)',
  'kesehatan-umum': 'Produk Kesehatan Umum',
  resep: 'Obat dengan Resep',
  'bahan-racik': 'Bahan Racik',
};

/**
 * Pemetaan keluhan → produk yang dianggap sesuai DALAM SIMULASI.
 * Ini aturan permainan, bukan panduan swamedikasi.
 */
export const SYMPTOM_PRODUCTS: Record<SymptomKey, { label: string; complaint: string; products: string[] }> = {
  'sakit-kepala': { label: 'Sakit kepala', complaint: 'kepala saya pusing sejak tadi pagi', products: ['pct-500', 'ibu-200'] },
  demam: { label: 'Demam', complaint: 'anak saya agak demam sejak semalam', products: ['pct-syr', 'pct-500'] },
  maag: { label: 'Nyeri lambung', complaint: 'perut saya perih, sepertinya maag kambuh', products: ['ant-tab', 'ant-sus'] },
  batuk: { label: 'Batuk', complaint: 'saya batuk-batuk beberapa hari ini', products: ['obh-syr', 'gg-100', 'dmp-15'] },
  pilek: { label: 'Pilek/bersin', complaint: 'saya bersin-bersin dan hidung meler', products: ['ctm-4', 'cet-10'] },
  'luka-ringan': { label: 'Luka ringan', complaint: 'lutut saya lecet karena jatuh', products: ['pvi-10', 'plester', 'kasa'] },
  'daya-tahan': { label: 'Menjaga daya tahan', complaint: 'saya ingin menjaga stamina', products: ['vitc-500', 'vitb-kom', 'multi-syr'] },
  gatal: { label: 'Gatal ringan', complaint: 'kulit saya gatal kena biang keringat', products: ['kal-los'] },
};

export const INFO_TOPICS: { id: string; question: string; options: string[]; correct: number; explanation: string }[] = [
  {
    id: 'hours',
    question: 'Apotek ini buka jam berapa ya?',
    options: ['Pukul 08.00–20.00', 'Buka 24 jam', 'Hanya sore hari'],
    correct: 0,
    explanation: 'Jam operasional apotek dalam permainan adalah 08.00–20.00.',
  },
  {
    id: 'storage',
    question: 'Bagaimana cara menyimpan obat sirup di rumah secara umum?',
    options: [
      'Ikuti petunjuk pada kemasan; umumnya di tempat sejuk, kering, terhindar dari cahaya',
      'Selalu di dalam freezer',
      'Di dalam mobil agar mudah dibawa',
    ],
    correct: 0,
    explanation: 'Petunjuk penyimpanan pada kemasan adalah acuan utama. (Informasi umum, contoh simulasi.)',
  },
  {
    id: 'expired',
    question: 'Obat saya sudah lewat tanggal kedaluwarsa, masih boleh dipakai?',
    options: ['Sebaiknya tidak digunakan; tanyakan cara pembuangan yang benar', 'Boleh jika warnanya belum berubah', 'Boleh asal dosisnya digandakan'],
    correct: 0,
    explanation: 'Obat kedaluwarsa tidak dianjurkan digunakan. (Informasi umum, contoh simulasi.)',
  },
  {
    id: 'rx-needed',
    question: 'Saya mau beli amoksisilin tanpa resep, bisa?',
    options: ['Dalam simulasi ini, amoksisilin hanya diserahkan dengan resep', 'Bisa, berapa pun jumlahnya', 'Bisa jika membayar lebih'],
    correct: 0,
    explanation: 'Di dalam permainan, obat berlabel "resep" hanya dapat diserahkan melalui alur resep.',
  },
  {
    id: 'label',
    question: 'Apa arti "sesudah makan" pada etiket?',
    options: ['Obat diminum setelah makan sesuai petunjuk pada etiket', 'Obat diminum saat perut kosong', 'Tidak ada artinya'],
    correct: 0,
    explanation: 'Etiket menjelaskan waktu penggunaan sesuai instruksi penulis resep. (Contoh simulasi.)',
  },
];
