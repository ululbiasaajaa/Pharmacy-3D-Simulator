import { FEATURE_UNLOCKS, PATIENTS, PROGRESSION, type FeatureKey } from './config';
import { emit, getEffects, notify } from './core';
import type { GameState, Patient, PatientVisit } from './types';

export function addXp(s: GameState, amount: number) {
  if (amount <= 0) return;
  s.progression.xp += Math.round(amount);
  while (s.progression.level < PROGRESSION.maxLevel && s.progression.xp >= PROGRESSION.xpPerLevel(s.progression.level)) {
    s.progression.xp -= PROGRESSION.xpPerLevel(s.progression.level);
    s.progression.level += 1;
    const unlocked = (Object.keys(FEATURE_UNLOCKS) as FeatureKey[]).filter((k) => FEATURE_UNLOCKS[k] === s.progression.level);
    const names = unlocked.map((k) => FEATURE_NAMES[k]).join(', ');
    notify(s, 'success', `Naik ke Level ${s.progression.level}!${names ? ` Fitur baru: ${names}.` : ''}`);
    emit(s, { type: 'level-up', message: String(s.progression.level) });
  }
}

export const FEATURE_NAMES: Record<FeatureKey, string> = {
  service: 'Pelayanan',
  pos: 'Kasir',
  inventory: 'Inventaris',
  catalog: 'Katalog',
  procurement: 'Pengadaan',
  missions: 'Misi',
  finance: 'Keuangan',
  employees: 'Pegawai',
  upgrades: 'Peningkatan',
  compounding: 'Peracikan',
  events: 'Event',
  expansions: 'Perluasan',
};

/** Pada Learning Mode seluruh fitur terbuka; pada mode lain dibuka bertahap per level. */
export function isFeatureUnlocked(s: GameState, key: FeatureKey): boolean {
  if (s.mode === 'learning') return true;
  if (s.mode === 'challenge') return key !== 'expansions' || s.progression.level >= FEATURE_UNLOCKS[key];
  return s.progression.level >= FEATURE_UNLOCKS[key];
}

export function requiredLevel(key: FeatureKey) {
  return FEATURE_UNLOCKS[key];
}

/** Perubahan reputasi. Nilai positif dipengaruhi dekorasi dan event hari pelayanan. */
export function addReputation(s: GameState, delta: number) {
  let d = delta;
  if (d > 0) {
    d *= getEffects(s).reputationGain;
    const special = s.activeEvents.find((e) => e.kind === 'service-day');
    if (special) d *= special.magnitude;
  }
  s.progression.reputation = Math.max(0, Math.min(100, s.progression.reputation + d));
}

/**
 * Menutup kunjungan pasien: memperbarui status, statistik, reputasi, dan riwayat.
 * Idempoten — pasien yang sudah selesai/pergi tidak diproses ulang.
 */
export function finishPatient(s: GameState, p: Patient, outcome: PatientVisit['outcome'], spent = 0) {
  if (p.status === 'done' || p.status === 'left') return;
  p.visits.push({ at: s.time.now, outcome, spent });
  p.leftAt = s.time.now;
  s.queue = s.queue.filter((id) => id !== p.id);
  if (s.activePatientId === p.id) s.activePatientId = null;
  const wait = Math.max(0, (p.servedAt ?? s.time.now) - p.arrivedAt);
  s.stats.totalWaitMinutes += wait;

  if (outcome === 'served') {
    p.status = 'done';
    s.stats.patientsServed += 1;
    const patienceFactor = p.maxPatience > 0 ? p.patience / p.maxPatience : 1;
    p.satisfaction = Math.round(Math.max(0, Math.min(100, 40 + patienceFactor * 60 - p.wrongAttempts * 10)));
    addReputation(s, PATIENTS.reputationGainOnServe * (0.5 + p.satisfaction / 100));
    emit(s, { type: 'patient-served', refId: p.id });
  } else {
    p.status = 'left';
    if (outcome === 'left') {
      s.stats.patientsLeft += 1;
      addReputation(s, -PATIENTS.reputationLossOnLeave);
      notify(s, 'warning', `${p.name} pergi karena terlalu lama menunggu.`);
    } else if (outcome === 'turned-away') {
      s.stats.patientsTurnedAway += 1;
      addReputation(s, -PATIENTS.reputationLossOnTurnAway);
    }
    emit(s, { type: 'patient-left', refId: p.id });
  }
}
