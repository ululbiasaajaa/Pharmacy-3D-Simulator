/**
 * Tipe entitas inti Pharmacy 3D Simulator.
 * Seluruh GameState adalah data JSON murni (tanpa class/fungsi) agar mudah disimpan,
 * divalidasi, dan diuji.
 */

export type GameMode = 'career' | 'learning' | 'challenge';

/** Waktu absolut dalam menit permainan sejak hari 1 pukul 00:00. */
export type AbsMinute = number;

export type DayPhase = 'preopen' | 'open' | 'closed';

// ---------------------------------------------------------------- Obat & Inventaris

export type MedicineCategory =
  | 'analgesik'
  | 'antipiretik'
  | 'antasida'
  | 'vitamin'
  | 'batuk-pilek'
  | 'topikal'
  | 'kesehatan-umum'
  | 'resep'
  | 'bahan-racik';

export type DosageForm =
  | 'tablet'
  | 'kaplet'
  | 'kapsul'
  | 'sirup'
  | 'suspensi'
  | 'salep'
  | 'krim'
  | 'tetes'
  | 'serbuk'
  | 'cairan'
  | 'alat';

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: MedicineCategory;
  strength: string;
  form: DosageForm;
  buyPrice: number;
  sellPrice: number;
  unit: string;
  minStock: number;
  description: string;
  /** Volume penyimpanan per satuan (dipakai untuk kapasitas rak/gudang). */
  volume: number;
  /** true = hanya boleh diserahkan dengan resep (dalam simulasi). */
  prescriptionOnly: boolean;
  /** true = butuh penyimpanan dingin (lemari pendingin). */
  refrigerated: boolean;
  active: boolean;
  /** Label kejujuran data edukatif. */
  dataStatus: 'contoh-simulasi' | 'terverifikasi';
}

export type StockLocation = 'shelf' | 'warehouse';

export type BatchStatus = 'active' | 'quarantined' | 'disposed';

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNo: string;
  qty: number;
  /** Hari permainan saat batch kedaluwarsa (batch tidak layak mulai hari ini). */
  expiryDay: number;
  unitCost: number;
  receivedDay: number;
  location: StockLocation;
  status: BatchStatus;
}

export type InventoryTxType =
  | 'receive'
  | 'dispense'
  | 'sale'
  | 'compounding'
  | 'adjust'
  | 'transfer'
  | 'dispose-damaged'
  | 'dispose-expired'
  | 'return';

export interface InventoryTransaction {
  id: string;
  at: AbsMinute;
  type: InventoryTxType;
  medicineId: string;
  batchId: string;
  /** Perubahan jumlah (negatif = keluar). Untuk transfer dicatat dua kali. */
  qtyDelta: number;
  location: StockLocation;
  note: string;
  refId?: string;
  valueDelta: number;
}

// ---------------------------------------------------------------- Pasien

export type PatientCategory =
  | 'otc'
  | 'prescription'
  | 'refill'
  | 'inquiry'
  | 'compounding'
  | 'canceller'
  | 'info';

/** 'awaiting' = menunggu racikan selesai; 'checkout' = menunggu pembayaran di kasir. */
export type PatientStatus = 'entering' | 'waiting' | 'serving' | 'awaiting' | 'checkout' | 'done' | 'left';

export type PaymentMethod = 'cash' | 'card' | 'digital';

export interface PatientRequestItem {
  medicineId: string;
  qty: number;
}

export interface PatientVisit {
  at: AbsMinute;
  outcome: 'served' | 'left' | 'rejected' | 'cancelled' | 'turned-away';
  spent: number;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'L' | 'P';
  category: PatientCategory;
  /** Ringkasan kebutuhan yang dibaca pemain. */
  need: string;
  /** Kategori keluhan untuk pasien OTC berbasis gejala. */
  symptom?: SymptomKey;
  status: PatientStatus;
  patience: number;
  maxPatience: number;
  money: number;
  paymentMethod: PaymentMethod;
  prescriptionId?: string;
  compoundingOrderId?: string;
  requestedItems: PatientRequestItem[];
  /** Untuk pasien 'inquiry'. */
  inquiryMedicineId?: string;
  /** Untuk pasien 'info'. */
  infoTopicId?: string;
  arrivedAt: AbsMinute;
  servedAt?: AbsMinute;
  leftAt?: AbsMinute;
  satisfaction: number;
  /** Siapa yang melayani: 'player' atau id pegawai. */
  servedBy?: string;
  /** Pasien skenario (tutorial/pelajaran) tidak kehilangan kesabaran. */
  scripted?: boolean;
  visits: PatientVisit[];
  saleId?: string;
  /** Sudah mengajukan pembatalan (kategori canceller). */
  cancelRequested?: boolean;
  /** Pemain sudah menanyakan detail keluhan. */
  askedDetails?: boolean;
  /** Jumlah percobaan rekomendasi yang tidak sesuai. */
  wrongAttempts: number;
  /** Pegawai tidak mengambil pasien ini sebelum waktu tersebut (dikembalikan ke pemain). */
  blockedUntil?: AbsMinute;
  appearance: number;
}

export type SymptomKey = 'sakit-kepala' | 'demam' | 'maag' | 'batuk' | 'pilek' | 'luka-ringan' | 'daya-tahan' | 'gatal';

// ---------------------------------------------------------------- Resep

export type PrescriptionStatus = 'received' | 'in-review' | 'on-hold' | 'dispensed' | 'rejected';

export interface PrescriptionItem {
  /** Nama obat sebagaimana tertulis di resep (pemain harus mencocokkan dengan katalog). */
  writtenName: string;
  medicineId: string;
  strength: string;
  form: DosageForm;
  qty: number;
  instructions: string;
}

export type PrescriptionIssueKind =
  | 'missing-instructions'
  | 'missing-patient-age'
  | 'missing-prescriber'
  | 'unavailable-strength'
  | 'iter-exhausted';

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number | null;
  prescriber: string | null;
  clinic: string;
  writtenDay: number;
  items: PrescriptionItem[];
  notes: string;
  status: PrescriptionStatus;
  receivedAt: AbsMinute;
  /** Masalah yang disisipkan skenario; pemain harus mendeteksinya. */
  hiddenIssue?: PrescriptionIssueKind;
  /** Masalah sudah dikonfirmasi/diselesaikan (mis. konfirmasi ke penulis resep). */
  issueResolved?: boolean;
  isRefill: boolean;
  iterRemaining: number;
  dispensedAt?: AbsMinute;
  saleId?: string;
  score?: number;
}

export interface DispenseLine {
  itemIndex: number;
  medicineId: string;
  batchId: string;
  qty: number;
  instructions: string;
}

export interface DispenseDraft {
  prescriptionId: string;
  lines: DispenseLine[];
  labelPrepared: boolean;
  completenessChecked: boolean;
  reportedIssue: PrescriptionIssueKind | 'none' | null;
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  action: string;
  itemIndex?: number;
}

// ---------------------------------------------------------------- Pemasok & Pengadaan

export interface SupplierProduct {
  medicineId: string;
  unitCost: number;
}

export interface Supplier {
  id: string;
  name: string;
  products: SupplierProduct[];
  leadTimeHours: number;
  /** 0..1, peluang pengiriman tepat waktu. */
  reliability: number;
  relationship: 'baru' | 'baik' | 'mitra' | 'buruk';
  reputation: number;
  minOrder: number;
  /** Rentang umur simpan (hari) untuk barang yang dikirim. */
  shelfLifeDays: [number, number];
  ordersCompleted: number;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'processing' | 'shipping' | 'arrived' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  medicineId: string;
  qty: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  createdAt: AbsMinute;
  orderedAt?: AbsMinute;
  eta?: AbsMinute;
  arrivedAt?: AbsMinute;
  receivedAt?: AbsMinute;
  total: number;
  delayed?: boolean;
  receivedBy?: string;
}

// ---------------------------------------------------------------- Kasir & Keuangan

export interface SaleAllocation {
  batchId: string;
  qty: number;
  unitCost: number;
}

export interface SaleItem {
  medicineId: string;
  qty: number;
  unitPrice: number;
  allocations: SaleAllocation[];
}

export type SaleStatus = 'open' | 'completed' | 'cancelled';
export type SaleSource = 'pos' | 'prescription' | 'compounding' | 'employee';

export interface SaleTransaction {
  id: string;
  patientId?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  method: PaymentMethod | null;
  status: SaleStatus;
  source: SaleSource;
  createdAt: AbsMinute;
  completedAt?: AbsMinute;
  /** Harga pokok penjualan (dari batch yang dipakai). */
  cogs: number;
  handledBy: string;
  refId?: string;
  /** true = stok sudah dikurangi sebelum pembayaran (resep/racikan). */
  stockCommitted: boolean;
}

export type LedgerCategory =
  | 'sales'
  | 'service-fee'
  | 'mission-reward'
  | 'challenge-reward'
  | 'event-income'
  | 'stock-purchase'
  | 'salary'
  | 'operational'
  | 'upgrade'
  | 'expansion'
  | 'expiry-loss'
  | 'damage-loss'
  | 'refund'
  | 'fine'
  | 'other';

export interface LedgerEntry {
  id: string;
  at: AbsMinute;
  category: LedgerCategory;
  /** Positif = pemasukan, negatif = pengeluaran. */
  amount: number;
  description: string;
  refId?: string;
  /** true = kerugian nonkas (mis. nilai stok kedaluwarsa) — tidak mengubah kas. */
  nonCash?: boolean;
}

export interface DailyReport {
  day: number;
  revenue: number;
  expenses: number;
  nonCashLosses: number;
  profit: number;
  cogs: number;
  patientsServed: number;
  patientsLeft: number;
  salesCount: number;
  prescriptionsDispensed: number;
  compoundingDone: number;
  reputationStart: number;
  reputationEnd: number;
  avgWaitMinutes: number;
  errors: number;
  moneyEnd: number;
  topProducts: { medicineId: string; qty: number }[];
}

// ---------------------------------------------------------------- Peracikan

export interface CompoundingIngredient {
  medicineId: string;
  /** Jumlah target dalam satuan bahan (gram). */
  amount: number;
  /** Toleransi relatif (0.05 = ±5%). */
  tolerance: number;
}

export type CompoundingStep = 'weigh' | 'grind' | 'mix' | 'divide' | 'container' | 'label';

export interface CompoundingRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: CompoundingIngredient[];
  steps: CompoundingStep[];
  container: string;
  containerOptions: string[];
  divideInto?: number;
  labelInstructions: string;
  price: number;
  requiredEquipmentLevel: number;
  disclaimer: string;
}

export type CompoundingOrderStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

export interface CompoundingOrder {
  id: string;
  recipeId: string;
  patientId?: string;
  status: CompoundingOrderStatus;
  createdAt: AbsMinute;
  completedAt?: AbsMinute;
  score?: number;
  attempts: number;
  feedback?: string[];
}

export interface CompoundingAttempt {
  orderId: string;
  weighed: Record<string, number>;
  stepsDone: CompoundingStep[];
  grindQuality: number;
  mixQuality: number;
  container: string | null;
  labelText: string;
  divideCount?: number;
}

// ---------------------------------------------------------------- Pegawai

export type EmployeeRole = 'cashier' | 'warehouse' | 'assistant' | 'pharmacist' | 'manager';
export type Shift = 'pagi' | 'siang' | 'penuh' | 'libur';

export interface EmployeeTask {
  kind: 'serve' | 'checkout' | 'restock' | 'receive' | 'quarantine' | 'reorder' | 'rest';
  targetId?: string;
  remaining: number;
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  /** Gaji per hari kerja penuh. */
  salary: number;
  /** 0.5..1.5, pengali kecepatan. */
  speed: number;
  /** 0..1, akurasi/kemampuan. */
  skill: number;
  level: number;
  xp: number;
  status: 'working' | 'idle' | 'resting' | 'off';
  shift: Shift;
  energy: number;
  hiredDay: number;
  task: EmployeeTask | null;
  tasksDone: number;
  errors: number;
  appearance: number;
  /** Otomatisasi yang diizinkan pemain untuk pegawai ini. */
  autoEnabled: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  role: EmployeeRole;
  salary: number;
  speed: number;
  skill: number;
  level: number;
  appearance: number;
}

// ---------------------------------------------------------------- Peningkatan

export type UpgradeEffectKey =
  | 'shelfCapacity'
  | 'warehouseCapacity'
  | 'queueCapacity'
  | 'serviceSpeed'
  | 'patienceDecay'
  | 'compoundingLevel'
  | 'computerLevel'
  | 'reputationGain'
  | 'maxEmployees'
  | 'serviceCounters'
  | 'energyRecovery'
  | 'operationalCostMult'
  | 'spawnRate';

export interface UpgradeLevel {
  cost: number;
  effects: Partial<Record<UpgradeEffectKey, number>>;
  description: string;
}

export interface UpgradeDef {
  id: string;
  name: string;
  kind: 'upgrade' | 'expansion' | 'cosmetic';
  description: string;
  requiredLevel: number;
  levels: UpgradeLevel[];
  /** Ruangan yang terbuka pada dunia 3D (khusus ekspansi). */
  unlocksRoom?: RoomId;
}

export type RoomId = 'big-warehouse' | 'lab-2' | 'counter-2' | 'admin-plus' | 'staff-lounge';

// ---------------------------------------------------------------- Misi, Event, Pencapaian

export type MissionObjectiveType =
  | 'serve-patients'
  | 'complete-sales'
  | 'dispense-prescriptions'
  | 'receive-orders'
  | 'place-orders'
  | 'compound'
  | 'buy-upgrade'
  | 'hire-employee'
  | 'revenue-total'
  | 'stock-medicine'
  | 'dispose-expired'
  | 'reach-reputation'
  | 'answer-inquiries'
  | 'transfer-stock';

export interface MissionObjective {
  type: MissionObjectiveType;
  target: number;
  medicineId?: string;
}

export interface MissionReward {
  money: number;
  xp: number;
  reputation: number;
}

export interface MissionDef {
  id: string;
  name: string;
  description: string;
  objective: MissionObjective;
  requiredLevel: number;
  requiresMission?: string;
  reward: MissionReward;
  modes: GameMode[];
}

export type MissionStatus = 'locked' | 'active' | 'completed' | 'claimed';

export interface MissionState {
  id: string;
  status: MissionStatus;
  /** Nilai statistik saat misi diaktifkan (agar progres dihitung sejak aktif). */
  baseline: number;
  progress: number;
  completedAt?: AbsMinute;
}

export type EventKind = 'patient-surge' | 'delivery-delay' | 'demand-boost' | 'inspection' | 'service-day' | 'price-increase';

export interface EventDef {
  id: string;
  kind: EventKind;
  name: string;
  description: string;
  durationMinutes: number;
  /** Parameter dampak: arti tergantung jenis event. */
  magnitude: number;
  category?: MedicineCategory;
  minDay: number;
  weight: number;
}

export interface ActiveEvent {
  id: string;
  defId: string;
  kind: EventKind;
  name: string;
  description: string;
  narrative: string;
  startAt: AbsMinute;
  endAt: AbsMinute;
  magnitude: number;
  category?: MedicineCategory;
  resolved?: boolean;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  stat: keyof GameStats;
  threshold: number;
  rewardXp: number;
}

// ---------------------------------------------------------------- Progres & Statistik

export interface GameStats {
  patientsServed: number;
  patientsLeft: number;
  patientsTurnedAway: number;
  salesCompleted: number;
  salesCancelled: number;
  prescriptionsDispensed: number;
  prescriptionsRejected: number;
  refillsDispensed: number;
  inquiriesAnswered: number;
  infoAnswered: number;
  ordersPlaced: number;
  ordersReceived: number;
  compoundingCompleted: number;
  compoundingPerfect: number;
  upgradesBought: number;
  employeesHired: number;
  totalRevenue: number;
  totalExpenses: number;
  expiredDisposed: number;
  stockTransfers: number;
  dispenseErrors: number;
  fefoViolations: number;
  perfectPrescriptions: number;
  daysCompleted: number;
  totalWaitMinutes: number;
  issuesDetected: number;
}

export interface Progression {
  level: number;
  xp: number;
  reputation: number;
}

// ---------------------------------------------------------------- Tutorial, Pelajaran, Tantangan

export interface TutorialState {
  active: boolean;
  step: number;
  completed: boolean;
  skipped: boolean;
}

export interface LessonState {
  activeLessonId: string | null;
  baseline: Partial<Record<keyof GameStats, number>>;
  completed: string[];
  feedback: { lessonId: string; lines: string[]; score: number }[];
}

export type ChallengeGoalType = 'revenue' | 'profit' | 'serve' | 'serve-with-rep' | 'low-expiry-loss';

export interface ChallengeDef {
  id: string;
  name: string;
  description: string;
  startingMoney: number;
  dayLimit: number;
  goal: { type: ChallengeGoalType; target: number; secondary?: number };
  constraints: string[];
  modifiers: {
    spawnRateMult?: number;
    leadTimeMult?: number;
    stockMult?: number;
    nearExpiry?: boolean;
    noHiring?: boolean;
    patienceMult?: number;
  };
  rewardXp: number;
}

export interface ChallengeState {
  id: string;
  status: 'running' | 'won' | 'lost';
  startDay: number;
  baseline: { revenue: number; expenses: number; served: number; expiryLoss: number };
  resultText?: string;
}

// ---------------------------------------------------------------- Notifikasi & Event bus

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface GameNotification {
  id: string;
  at: AbsMinute;
  level: NotificationLevel;
  message: string;
}

export type GameEventType =
  | 'patient-arrived'
  | 'patient-left'
  | 'patient-served'
  | 'sale-completed'
  | 'sale-cancelled'
  | 'prescription-dispensed'
  | 'order-placed'
  | 'order-arrived'
  | 'order-received'
  | 'stock-transferred'
  | 'stock-disposed'
  | 'compounding-completed'
  | 'mission-completed'
  | 'achievement-unlocked'
  | 'level-up'
  | 'event-started'
  | 'event-ended'
  | 'day-opened'
  | 'day-closed'
  | 'upgrade-bought'
  | 'employee-hired'
  | 'error';

export interface GameEvent {
  type: GameEventType;
  refId?: string;
  message?: string;
}

// ---------------------------------------------------------------- State utama

export interface PharmacyState {
  name: string;
  upgrades: Record<string, number>;
  unlockedRooms: RoomId[];
  debtDays: number;
  /** Pemesanan ulang otomatis oleh manajer diizinkan. */
  autoReorder: boolean;
}

export interface PlayerProfile {
  name: string;
  pharmacyName: string;
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  rngState: number;
  idCounter: number;
  mode: GameMode;
  profile: PlayerProfile;
  time: { now: AbsMinute; phase: DayPhase; day: number };
  money: number;
  pharmacy: PharmacyState;
  progression: Progression;
  stats: GameStats;

  medicines: Medicine[];
  batches: MedicineBatch[];
  inventoryTx: InventoryTransaction[];

  patients: Patient[];
  queue: string[];
  /** Pasien yang sedang dilayani pemain di meja pelayanan. */
  activePatientId: string | null;
  nextPatientAt: AbsMinute;
  prescriptions: Prescription[];

  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];

  sales: SaleTransaction[];
  ledger: LedgerEntry[];
  reports: DailyReport[];
  dayStart: { reputation: number; money: number; stats: GameStats };

  compoundingOrders: CompoundingOrder[];

  employees: Employee[];
  candidates: Candidate[];

  missions: MissionState[];
  activeEvents: ActiveEvent[];
  eventHistory: { defId: string; at: AbsMinute }[];
  achievements: { id: string; at: AbsMinute }[];

  tutorial: TutorialState;
  lessons: LessonState;
  challenge: ChallengeState | null;

  notifications: GameNotification[];
  /** Antrean event untuk subsistem luar (audio, UI). Tidak disimpan. */
  outbox: GameEvent[];
  gameOver: { reason: string } | null;
}
