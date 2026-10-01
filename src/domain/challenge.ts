import { addLedger, notify, today } from './core';
import { financeSummary } from './finance';
import { expiredBatches } from './inventory';
import { addXp } from './progression';
import { CHALLENGES } from '@/data/challenges';
import type { ChallengeDef, GameState } from './types';

export function challengeDef(s: GameState): ChallengeDef | undefined {
  return s.challenge ? CHALLENGES.find((c) => c.id === s.challenge!.id) : undefined;
}

export interface ChallengeProgress {
  label: string;
  current: number;
  target: number;
  secondaryLabel?: string;
  secondaryOk?: boolean;
  daysLeft: number;
  met: boolean;
}

/** Kerugian kedaluwarsa = batch yang sudah dimusnahkan + nilai batch kedaluwarsa yang masih disimpan. */
function expiryLossSince(s: GameState, startDay: number) {
  const disposed = s.ledger.filter((e) => e.category === 'expiry-loss' && e.at >= (startDay - 1) * 1440).reduce((a, e) => a - e.amount, 0);
  const pending = expiredBatches(s).reduce((a, b) => a + b.qty * b.unitCost, 0);
  return disposed + pending;
}

export function challengeProgress(s: GameState): ChallengeProgress | null {
  const def = challengeDef(s);
  const ch = s.challenge;
  if (!def || !ch) return null;
  const daysLeft = Math.max(0, ch.startDay + def.dayLimit - 1 - today(s) + (s.time.phase === 'closed' ? 0 : 1));
  switch (def.goal.type) {
    case 'revenue': {
      const cur = s.stats.totalRevenue - ch.baseline.revenue;
      return { label: 'Pendapatan penjualan', current: cur, target: def.goal.target, daysLeft, met: cur >= def.goal.target };
    }
    case 'serve': {
      const cur = s.stats.patientsServed - ch.baseline.served;
      return { label: 'Pasien dilayani', current: cur, target: def.goal.target, daysLeft, met: cur >= def.goal.target };
    }
    case 'serve-with-rep': {
      const cur = s.stats.patientsServed - ch.baseline.served;
      const repOk = s.progression.reputation >= (def.goal.secondary ?? 0);
      return {
        label: 'Pasien dilayani',
        current: cur,
        target: def.goal.target,
        secondaryLabel: `Reputasi ≥ ${def.goal.secondary} (saat ini ${Math.round(s.progression.reputation)})`,
        secondaryOk: repOk,
        daysLeft,
        met: cur >= def.goal.target && repOk,
      };
    }
    case 'profit':
    case 'low-expiry-loss': {
      const profit = financeSummary(s, ch.startDay, today(s)).profit;
      const loss = expiryLossSince(s, ch.startDay);
      const secOk = def.goal.secondary === undefined || loss <= def.goal.secondary;
      return {
        label: 'Laba sejak awal tantangan',
        current: profit,
        target: def.goal.target,
        secondaryLabel: def.goal.secondary !== undefined ? `Kerugian kedaluwarsa ≤ Rp ${def.goal.secondary.toLocaleString('id-ID')} (saat ini Rp ${Math.round(loss).toLocaleString('id-ID')})` : undefined,
        secondaryOk: secOk,
        daysLeft,
        met: profit >= def.goal.target && secOk,
      };
    }
  }
}

/**
 * Evaluasi tantangan. Target berbasis jumlah dapat dimenangkan kapan saja;
 * target laba dievaluasi di akhir hari. Kalah bila batas hari habis.
 */
export function evaluateChallenge(s: GameState, atDayEnd: boolean) {
  const ch = s.challenge;
  const def = challengeDef(s);
  if (!ch || !def || ch.status !== 'running') return;
  const prog = challengeProgress(s)!;
  const profitGoal = def.goal.type === 'profit' || def.goal.type === 'low-expiry-loss';
  if (prog.met && (!profitGoal || atDayEnd)) {
    ch.status = 'won';
    ch.resultText = `Tantangan "${def.name}" berhasil diselesaikan pada hari ke-${today(s) - ch.startDay + 1}!`;
    addXp(s, def.rewardXp);
    addLedger(s, 'challenge-reward', 500_000, `Hadiah tantangan ${def.name}`, def.id);
    notify(s, 'success', ch.resultText);
    return;
  }
  if (atDayEnd && today(s) >= ch.startDay + def.dayLimit - 1) {
    ch.status = 'lost';
    ch.resultText = `Batas waktu habis. ${prog.label}: ${Math.round(prog.current).toLocaleString('id-ID')} dari target ${prog.target.toLocaleString('id-ID')}.${prog.secondaryLabel && !prog.secondaryOk ? ` Syarat tambahan tidak terpenuhi: ${prog.secondaryLabel}.` : ''}`;
    notify(s, 'error', ch.resultText);
  }
}
