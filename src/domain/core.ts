import { CAPACITY, ECONOMY, PATIENTS, TIME } from './config';
import { nextId } from './ids';
import { dayOf } from './time';
import { UPGRADES } from '@/data/upgrades';
import { CHALLENGES } from '@/data/challenges';
import type {
  ChallengeDef,
  GameEvent,
  GameState,
  LedgerCategory,
  Medicine,
  NotificationLevel,
  UpgradeEffectKey,
} from './types';

/** Hasil operasi domain. `ok=false` berarti state tidak berubah secara bermakna. */
export type Result<T = undefined> = { ok: true; value?: T; message?: string } | { ok: false; error: string };

export const ok = <T>(value?: T, message?: string): Result<T> => ({ ok: true, value, message });
export const fail = (error: string): Result<never> => ({ ok: false, error });

export const today = (s: GameState) => dayOf(s.time.now);

export function notify(s: GameState, level: NotificationLevel, message: string) {
  s.notifications.push({ id: nextId(s, 'NT'), at: s.time.now, level, message });
  if (s.notifications.length > 60) s.notifications.splice(0, s.notifications.length - 60);
}

export function emit(s: GameState, event: GameEvent) {
  s.outbox.push(event);
}

export function medicineById(s: GameState, id: string): Medicine | undefined {
  return s.medicines.find((m) => m.id === id);
}

const INCOME_REVENUE: LedgerCategory[] = ['sales', 'service-fee'];

/**
 * Satu-satunya jalur perubahan uang. Semua pemasukan/pengeluaran tercatat di buku besar.
 * Entri `nonCash` (mis. kerugian kedaluwarsa) dicatat tanpa mengubah kas.
 */
export function addLedger(
  s: GameState,
  category: LedgerCategory,
  amount: number,
  description: string,
  refId?: string,
  nonCash = false,
) {
  const rounded = Math.round(amount);
  if (rounded === 0) return;
  s.ledger.push({ id: nextId(s, 'LG'), at: s.time.now, category, amount: rounded, description, refId, nonCash: nonCash || undefined });
  if (!nonCash) s.money += rounded;
  if (INCOME_REVENUE.includes(category) && rounded > 0) s.stats.totalRevenue += rounded;
  if (rounded < 0) s.stats.totalExpenses += -rounded;
}

export type Effects = Record<UpgradeEffectKey, number>;

/** Agregasi efek seluruh peningkatan yang dimiliki. */
export function getEffects(s: GameState): Effects {
  const e: Effects = {
    shelfCapacity: CAPACITY.baseShelf,
    warehouseCapacity: CAPACITY.baseWarehouse,
    queueCapacity: PATIENTS.baseQueueCapacity,
    serviceSpeed: 1,
    patienceDecay: 1,
    compoundingLevel: 0,
    computerLevel: 0,
    reputationGain: 1,
    maxEmployees: CAPACITY.baseMaxEmployees,
    serviceCounters: CAPACITY.baseCounters,
    energyRecovery: 1,
    operationalCostMult: 1,
    spawnRate: 1,
  };
  for (const def of UPGRADES) {
    const level = s.pharmacy.upgrades[def.id] ?? 0;
    for (let i = 0; i < level && i < def.levels.length; i++) {
      for (const [k, v] of Object.entries(def.levels[i].effects)) {
        e[k as UpgradeEffectKey] += v ?? 0;
      }
    }
  }
  if (s.employees.some((x) => x.role === 'manager' && x.shift !== 'libur')) e.operationalCostMult -= 0.05;
  e.patienceDecay = Math.max(0.3, e.patienceDecay);
  e.operationalCostMult = Math.max(0.5, e.operationalCostMult);
  return e;
}

export function operationalCost(s: GameState): number {
  const e = getEffects(s);
  const grace = s.time.day <= ECONOMY.graceDays ? ECONOMY.graceCostMult : 1;
  const rooms = 1 + s.pharmacy.unlockedRooms.length * 0.1;
  return Math.round(ECONOMY.baseOperationalCost * e.operationalCostMult * grace * rooms);
}

export const isOpenHours = (minute: number) => minute >= TIME.openMinute && minute < TIME.closeMinute;

/** Pengubah aturan dari tantangan aktif (kosong di luar Challenge Mode). */
export function challengeMods(s: GameState): ChallengeDef['modifiers'] {
  if (s.mode !== 'challenge' || !s.challenge) return {};
  return CHALLENGES.find((c) => c.id === s.challenge!.id)?.modifiers ?? {};
}
