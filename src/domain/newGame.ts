import { ECONOMY, PROGRESSION, TIME } from './config';
import { challengeMods } from './core';
import { generateCandidates } from './employees';
import { initMissions } from './missions';
import { receiveBatch } from './inventory';
import { postProcess } from './simulation';
import { randInt } from './rng';
import { absAt } from './time';
import { CHALLENGES } from '@/data/challenges';
import { MEDICINES } from '@/data/medicines';
import { SUPPLIERS } from '@/data/suppliers';
import type { GameMode, GameState, GameStats } from './types';

export const SCHEMA_VERSION = 1;

export function emptyStats(): GameStats {
  return {
    patientsServed: 0,
    patientsLeft: 0,
    patientsTurnedAway: 0,
    salesCompleted: 0,
    salesCancelled: 0,
    prescriptionsDispensed: 0,
    prescriptionsRejected: 0,
    refillsDispensed: 0,
    inquiriesAnswered: 0,
    infoAnswered: 0,
    ordersPlaced: 0,
    ordersReceived: 0,
    compoundingCompleted: 0,
    compoundingPerfect: 0,
    upgradesBought: 0,
    employeesHired: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    expiredDisposed: 0,
    stockTransfers: 0,
    dispenseErrors: 0,
    fefoViolations: 0,
    perfectPrescriptions: 0,
    daysCompleted: 0,
    totalWaitMinutes: 0,
    issuesDetected: 0,
  };
}

export interface NewGameOptions {
  mode: GameMode;
  playerName: string;
  pharmacyName: string;
  challengeId?: string;
  seed?: number;
  /** Lewati tutorial (misalnya untuk pemain berpengalaman). */
  skipTutorial?: boolean;
}

/** Membuat GameState awal: apotek kecil, modal awal, stok awal, misi, dan tutorial. */
export function createNewGame(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const challenge = opts.mode === 'challenge' ? CHALLENGES.find((c) => c.id === opts.challengeId) ?? CHALLENGES[0] : undefined;
  const money = challenge ? challenge.startingMoney : ECONOMY.startingMoney[opts.mode === 'learning' ? 'learning' : 'career'];

  const s: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    rngState: seed,
    idCounter: 0,
    mode: opts.mode,
    profile: { name: opts.playerName.trim() || 'Apoteker', pharmacyName: opts.pharmacyName.trim() || 'Apotek Sehat' },
    time: { now: absAt(1, TIME.preopenMinute), phase: 'preopen', day: 1 },
    money,
    pharmacy: { name: opts.pharmacyName.trim() || 'Apotek Sehat', upgrades: {}, unlockedRooms: [], debtDays: 0, autoReorder: false },
    progression: { level: 1, xp: 0, reputation: PROGRESSION.startReputation },
    stats: emptyStats(),
    medicines: MEDICINES.map((m) => ({ ...m })),
    batches: [],
    inventoryTx: [],
    patients: [],
    queue: [],
    activePatientId: null,
    nextPatientAt: 0,
    prescriptions: [],
    suppliers: SUPPLIERS.map((x) => ({ ...x, products: x.products.map((p) => ({ ...p })) })),
    purchaseOrders: [],
    sales: [],
    ledger: [],
    reports: [],
    dayStart: { reputation: PROGRESSION.startReputation, money, stats: emptyStats() },
    compoundingOrders: [],
    employees: [],
    candidates: [],
    missions: [],
    activeEvents: [],
    eventHistory: [],
    achievements: [],
    tutorial: { active: opts.mode !== 'challenge' && !opts.skipTutorial, step: 0, completed: false, skipped: !!opts.skipTutorial },
    lessons: { activeLessonId: null, baseline: {}, completed: [], feedback: [] },
    challenge: challenge
      ? { id: challenge.id, status: 'running', startDay: 1, baseline: { revenue: 0, expenses: 0, served: 0, expiryLoss: 0 } }
      : null,
    notifications: [],
    outbox: [],
    gameOver: null,
  };

  seedInventory(s);
  initMissions(s);
  generateCandidates(s);
  postProcess(s);
  s.outbox = [];
  s.notifications = [];
  return s;
}

/** Stok awal: sebagian di rak, sebagian di gudang, dengan variasi tanggal kedaluwarsa. */
function seedInventory(s: GameState) {
  const mods = challengeMods(s);
  const stockMult = mods.stockMult ?? 1;
  for (const m of s.medicines) {
    const isBahan = m.category === 'bahan-racik';
    if (isBahan) {
      const qty = Math.round(m.minStock * 2.5 * stockMult);
      if (qty > 0) receiveBatch(s, { medicineId: m.id, qty, expiryDay: 1 + randInt(s, 200, 500), unitCost: m.buyPrice, location: 'shelf', skipCapacity: true, note: 'Stok awal' });
      continue;
    }
    const shelfQty = Math.max(0, Math.round(m.minStock * (1.2 + randInt(s, 0, 8) / 10) * stockMult));
    const whQty = Math.max(0, Math.round(m.minStock * (1.5 + randInt(s, 0, 10) / 10) * stockMult));
    const near = mods.nearExpiry && randInt(s, 0, 9) < 7;
    const expShelf = near ? 1 + randInt(s, 1, 5) : 1 + randInt(s, 60, 300);
    const expWh = near ? 1 + randInt(s, 2, 6) : 1 + randInt(s, 90, 360);
    if (shelfQty > 0) receiveBatch(s, { medicineId: m.id, qty: shelfQty, expiryDay: expShelf, unitCost: m.buyPrice, location: 'shelf', skipCapacity: true, note: 'Stok awal' });
    if (whQty > 0) receiveBatch(s, { medicineId: m.id, qty: whQty, expiryDay: expWh, unitCost: m.buyPrice, location: 'warehouse', skipCapacity: true, note: 'Stok awal' });
  }
  // Satu batch parasetamol yang segera kedaluwarsa untuk memperkenalkan FEFO secara alami.
  if (s.mode === 'career') {
    const pct = s.medicines.find((m) => m.id === 'pct-500')!;
    receiveBatch(s, { medicineId: pct.id, qty: 6, expiryDay: 1 + 12, unitCost: pct.buyPrice, location: 'shelf', skipCapacity: true, note: 'Stok awal (segera kedaluwarsa)' });
  }
}
