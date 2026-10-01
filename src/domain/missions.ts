import { addLedger, emit, fail, notify, ok, type Result } from './core';
import { stockOf } from './inventory';
import { addReputation, addXp } from './progression';
import { ACHIEVEMENTS } from '@/data/achievements';
import { MISSIONS } from '@/data/missions';
import type { GameState, MissionDef, MissionObjectiveType, GameStats } from './types';

const STAT_FOR: Partial<Record<MissionObjectiveType, keyof GameStats>> = {
  'serve-patients': 'patientsServed',
  'complete-sales': 'salesCompleted',
  'dispense-prescriptions': 'prescriptionsDispensed',
  'receive-orders': 'ordersReceived',
  'place-orders': 'ordersPlaced',
  compound: 'compoundingCompleted',
  'buy-upgrade': 'upgradesBought',
  'hire-employee': 'employeesHired',
  'revenue-total': 'totalRevenue',
  'dispose-expired': 'expiredDisposed',
  'answer-inquiries': 'inquiriesAnswered',
  'transfer-stock': 'stockTransfers',
};

export function missionDef(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** Nilai saat ini untuk tujuan misi (kumulatif sejak aktif, atau absolut). */
function currentValue(s: GameState, def: MissionDef): number {
  const stat = STAT_FOR[def.objective.type];
  if (stat) return s.stats[stat];
  if (def.objective.type === 'reach-reputation') return s.progression.reputation;
  if (def.objective.type === 'stock-medicine') return stockOf(s, def.objective.medicineId!, 'any');
  return 0;
}

const isAbsolute = (def: MissionDef) => def.objective.type === 'reach-reputation' || def.objective.type === 'stock-medicine';

export function initMissions(s: GameState) {
  s.missions = MISSIONS.filter((m) => m.modes.includes(s.mode)).map((m) => ({ id: m.id, status: 'locked', baseline: 0, progress: 0 }));
}

/** Aktivasi, pembaruan progres, dan penyelesaian misi. Dipanggil setelah setiap aksi/tick. */
export function evaluateMissions(s: GameState) {
  for (const ms of s.missions) {
    const def = missionDef(ms.id);
    if (!def) continue;
    if (ms.status === 'locked') {
      const prereq = def.requiresMission ? s.missions.find((m) => m.id === def.requiresMission) : null;
      const prereqOk = !def.requiresMission || (prereq && (prereq.status === 'completed' || prereq.status === 'claimed'));
      const levelOk = s.mode === 'learning' || s.progression.level >= def.requiredLevel;
      if (prereqOk && levelOk) {
        ms.status = 'active';
        ms.baseline = isAbsolute(def) ? 0 : currentValue(s, def);
      } else continue;
    }
    if (ms.status === 'active') {
      const v = currentValue(s, def);
      ms.progress = Math.max(0, Math.min(def.objective.target, isAbsolute(def) ? v : v - ms.baseline));
      if (ms.progress >= def.objective.target) {
        ms.status = 'completed';
        ms.completedAt = s.time.now;
        notify(s, 'success', `Misi selesai: ${def.name}. Klaim hadiah di Papan Misi.`);
        emit(s, { type: 'mission-completed', refId: def.id });
      }
    }
  }
}

/** Klaim hadiah misi — hanya sekali. */
export function claimMission(s: GameState, id: string): Result<MissionDef> {
  const ms = s.missions.find((m) => m.id === id);
  const def = missionDef(id);
  if (!ms || !def) return fail('Misi tidak ditemukan.');
  if (ms.status === 'claimed') return fail('Hadiah sudah diklaim.');
  if (ms.status !== 'completed') return fail('Misi belum selesai.');
  ms.status = 'claimed';
  if (def.reward.money) addLedger(s, 'mission-reward', def.reward.money, `Hadiah misi: ${def.name}`, def.id);
  addXp(s, def.reward.xp);
  if (def.reward.reputation) addReputation(s, def.reward.reputation);
  return ok(def);
}

export function evaluateAchievements(s: GameState) {
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.some((x) => x.id === a.id)) continue;
    if (s.stats[a.stat] >= a.threshold) {
      s.achievements.push({ id: a.id, at: s.time.now });
      addXp(s, a.rewardXp);
      notify(s, 'success', `🏆 Pencapaian: ${a.name}`);
      emit(s, { type: 'achievement-unlocked', refId: a.id });
    }
  }
}
