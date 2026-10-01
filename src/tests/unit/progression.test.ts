import { describe, expect, it } from 'vitest';
import { claimMission, evaluateMissions } from '@/domain/missions';
import { addXp, isFeatureUnlocked } from '@/domain/progression';
import { financeSummary } from '@/domain/finance';
import { addLedger } from '@/domain/core';
import { buyUpgrade } from '@/domain/upgrades';
import { postProcess } from '@/domain/simulation';
import { newState } from '../helpers';

describe('Misi', () => {
  it('progres dihitung sejak misi aktif dan hadiah hanya diklaim sekali', () => {
    const s = newState();
    const m = s.missions.find((x) => x.id === 'm-first-serve')!;
    expect(m.status).toBe('active');
    s.stats.patientsServed += 1;
    evaluateMissions(s);
    expect(m.status).toBe('completed');
    const money = s.money;
    expect(claimMission(s, m.id).ok).toBe(true);
    expect(s.money).toBe(money + 100_000);
    expect(claimMission(s, m.id).ok).toBe(false);
    expect(s.money).toBe(money + 100_000);
  });

  it('misi berantai terbuka setelah prasyarat selesai', () => {
    const s = newState();
    const chained = s.missions.find((x) => x.id === 'm-sales-5')!;
    expect(chained.status).toBe('locked');
    s.stats.patientsServed = 1;
    s.stats.salesCompleted = 3;
    evaluateMissions(s);
    evaluateMissions(s);
    expect(chained.status).toBe('active');
    expect(chained.baseline).toBe(3);
  });
});

describe('Level & fitur', () => {
  it('naik level membuka fitur secara bertahap', () => {
    const s = newState();
    expect(isFeatureUnlocked(s, 'employees')).toBe(false);
    addXp(s, 10_000);
    expect(s.progression.level).toBeGreaterThan(3);
    expect(isFeatureUnlocked(s, 'employees')).toBe(true);
    expect(isFeatureUnlocked(s, 'compounding')).toBe(true);
  });

  it('Learning Mode membuka semua fitur', () => {
    const s = newState('learning');
    expect(isFeatureUnlocked(s, 'compounding')).toBe(true);
    expect(isFeatureUnlocked(s, 'expansions')).toBe(true);
  });

  it('pencapaian diberikan berdasarkan statistik', () => {
    const s = newState();
    s.stats.patientsServed = 1;
    postProcess(s);
    expect(s.achievements.some((a) => a.id === 'a-serve-1')).toBe(true);
  });
});

describe('Keuangan', () => {
  it('laba = pemasukan − pengeluaran − kerugian nonkas', () => {
    const s = newState();
    addLedger(s, 'sales', 100_000, 'jual');
    addLedger(s, 'stock-purchase', -30_000, 'beli');
    addLedger(s, 'expiry-loss', -5_000, 'exp', undefined, true);
    const f = financeSummary(s, 1, 1);
    expect(f.income).toBe(100_000);
    expect(f.expenses).toBe(30_000);
    expect(f.nonCashLosses).toBe(5_000);
    expect(f.profit).toBe(65_000);
    expect(f.salesRevenue).toBe(100_000);
  });

  it('peningkatan mengurangi uang dan tercatat', () => {
    const s = newState();
    s.progression.level = 3;
    const money = s.money;
    expect(buyUpgrade(s, 'waiting-room').ok).toBe(true);
    expect(s.money).toBe(money - 600_000);
    expect(s.ledger.at(-1)?.category).toBe('upgrade');
  });

  it('peningkatan terkunci sebelum level cukup', () => {
    const s = newState();
    expect(buyUpgrade(s, 'shelf').ok).toBe(false);
  });
});
