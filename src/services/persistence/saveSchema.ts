import { z } from 'zod';

/**
 * Skema validasi data simpanan. Memakai looseObject agar field tambahan tidak hilang,
 * namun field inti wajib ada dengan tipe yang benar.
 */
const num = z.number().refine((n) => Number.isFinite(n), 'Angka tidak valid');
const id = z.string().min(1);

const medicine = z.looseObject({
  id,
  name: z.string(),
  category: z.string(),
  sellPrice: num,
  buyPrice: num,
  unit: z.string(),
  minStock: num,
  volume: num,
  active: z.boolean(),
});

const batch = z.looseObject({
  id,
  medicineId: id,
  batchNo: z.string(),
  qty: num.refine((n) => n >= 0, 'Stok negatif'),
  expiryDay: num,
  unitCost: num,
  receivedDay: num,
  location: z.enum(['shelf', 'warehouse']),
  status: z.enum(['active', 'quarantined', 'disposed']),
});

const patient = z.looseObject({
  id,
  name: z.string(),
  category: z.enum(['otc', 'prescription', 'refill', 'inquiry', 'compounding', 'canceller', 'info']),
  status: z.enum(['entering', 'waiting', 'serving', 'awaiting', 'checkout', 'done', 'left']),
  patience: num,
  maxPatience: num,
  money: num,
  requestedItems: z.array(z.looseObject({ medicineId: id, qty: num })),
  arrivedAt: num,
  visits: z.array(z.unknown()),
  wrongAttempts: num,
});

const sale = z.looseObject({
  id,
  items: z.array(z.looseObject({ medicineId: z.string(), qty: num, unitPrice: num, allocations: z.array(z.looseObject({ batchId: z.string(), qty: num, unitCost: num })) })),
  total: num,
  status: z.enum(['open', 'completed', 'cancelled']),
  stockCommitted: z.boolean(),
});

const ledger = z.looseObject({ id, at: num, category: z.string(), amount: num, description: z.string() });

const purchaseOrder = z.looseObject({
  id,
  supplierId: id,
  items: z.array(z.looseObject({ medicineId: id, qty: num, unitCost: num })),
  status: z.enum(['draft', 'ordered', 'processing', 'shipping', 'arrived', 'received', 'cancelled']),
  total: num,
});

const employee = z.looseObject({
  id,
  name: z.string(),
  role: z.enum(['cashier', 'warehouse', 'assistant', 'pharmacist', 'manager']),
  salary: num,
  speed: num,
  skill: num,
  shift: z.enum(['pagi', 'siang', 'penuh', 'libur']),
  energy: num,
});

const stats = z.record(z.string(), num);

export const gameStateSchema = z.looseObject({
  schemaVersion: num,
  seed: num,
  rngState: num,
  idCounter: num,
  mode: z.enum(['career', 'learning', 'challenge']),
  profile: z.looseObject({ name: z.string(), pharmacyName: z.string() }),
  time: z.looseObject({ now: num, phase: z.enum(['preopen', 'open', 'closed']), day: num }),
  money: num,
  pharmacy: z.looseObject({
    name: z.string(),
    upgrades: z.record(z.string(), num),
    unlockedRooms: z.array(z.string()),
    debtDays: num,
    autoReorder: z.boolean(),
  }),
  progression: z.looseObject({ level: num, xp: num, reputation: num }),
  stats,
  medicines: z.array(medicine).min(1),
  batches: z.array(batch),
  inventoryTx: z.array(z.unknown()),
  patients: z.array(patient),
  queue: z.array(z.string()),
  activePatientId: z.string().nullable(),
  nextPatientAt: num,
  prescriptions: z.array(z.looseObject({ id, patientId: z.string(), items: z.array(z.unknown()), status: z.string() })),
  suppliers: z.array(z.looseObject({ id, name: z.string(), products: z.array(z.unknown()) })).min(1),
  purchaseOrders: z.array(purchaseOrder),
  sales: z.array(sale),
  ledger: z.array(ledger),
  reports: z.array(z.looseObject({ day: num })),
  dayStart: z.looseObject({ reputation: num, money: num, stats }),
  compoundingOrders: z.array(z.looseObject({ id, recipeId: z.string(), status: z.string() })),
  employees: z.array(employee),
  candidates: z.array(z.unknown()),
  missions: z.array(z.looseObject({ id, status: z.enum(['locked', 'active', 'completed', 'claimed']), baseline: num, progress: num })),
  activeEvents: z.array(z.looseObject({ id, kind: z.string(), endAt: num })),
  eventHistory: z.array(z.unknown()),
  achievements: z.array(z.looseObject({ id, at: num })),
  tutorial: z.looseObject({ active: z.boolean(), step: num, completed: z.boolean(), skipped: z.boolean() }),
  lessons: z.looseObject({ activeLessonId: z.string().nullable(), completed: z.array(z.string()) }),
  challenge: z.looseObject({ id, status: z.enum(['running', 'won', 'lost']), startDay: num }).nullable(),
  notifications: z.array(z.unknown()),
  outbox: z.array(z.unknown()).optional(),
  gameOver: z.looseObject({ reason: z.string() }).nullable(),
});

export const saveRecordSchema = z.object({
  slot: z.string(),
  schemaVersion: num,
  savedAt: z.string(),
  label: z.string(),
  summary: z.object({
    playerName: z.string(),
    pharmacyName: z.string(),
    mode: z.string(),
    day: num,
    money: num,
    level: num,
    reputation: num,
  }),
  state: z.unknown(),
});

export type SaveRecord = z.infer<typeof saveRecordSchema>;
