import { describe, expect, it } from 'vitest';
import { advanceTime, closeDay, openPharmacy, postProcess, startNextDay } from '@/domain/simulation';
import { hireCandidate, setShift } from '@/domain/employees';
import { addToPatientCart, arrivalInterval, callNextPatient, patienceDecayRate, sendToCheckout, spawnPatient } from '@/domain/patients';
import { stockOf } from '@/domain/inventory';
import { createNewGame } from '@/domain/newGame';
import { startEvent } from '@/domain/events';
import { EVENTS } from '@/data/events';
import { challengeProgress } from '@/domain/challenge';
import { buyUpgrade } from '@/domain/upgrades';
import { getEffects } from '@/domain/core';
import { addBatch, clearStock, newState } from '../helpers';
import type { Candidate } from '@/domain/types';

function hire(s: ReturnType<typeof newState>, role: Candidate['role'], skill = 0.95) {
  s.progression.level = Math.max(2, s.progression.level);
  s.candidates.push({ id: `CD-${role}`, name: `Uji ${role}`, role, salary: 100_000, speed: 1.2, skill, level: 1, appearance: 0 });
  const r = hireCandidate(s, `CD-${role}`);
  if (!r.ok) throw new Error(r.error);
  return r.value!;
}

describe('Hari operasional penuh', () => {
  it('berjalan dari buka hingga tutup tanpa error dan membuat laporan dari transaksi', () => {
    const s = newState('career', { seed: 7 });
    expect(openPharmacy(s).ok).toBe(true);
    let guard = 0;
    while (s.time.phase === 'open' && guard++ < 2000) {
      advanceTime(s, 1);
      // Pemain otomatis sederhana: layani pasien OTC dengan produk yang benar.
      const active = s.activePatientId ? s.patients.find((p) => p.id === s.activePatientId) : undefined;
      if (!active) callNextPatient(s);
      postProcess(s);
    }
    expect(s.time.phase).toBe('closed');
    expect(s.reports).toHaveLength(1);
    const report = s.reports[0];
    expect(report.day).toBe(1);
    expect(report.expenses).toBeGreaterThan(0); // biaya operasional
    expect(s.ledger.some((e) => e.category === 'operational')).toBe(true);
    expect(s.patients.every((p) => p.status === 'done' || p.status === 'left')).toBe(true);
    expect(startNextDay(s).ok).toBe(true);
    expect(s.time.day).toBe(2);
    expect(s.time.phase).toBe('preopen');
  });

  it('gaji pegawai dibayar saat tutup hari', () => {
    const s = newState('career', { open: true });
    const e = hire(s, 'warehouse');
    setShift(s, e.id, 'pagi');
    const money = s.money;
    closeDay(s);
    const salary = s.ledger.find((x) => x.category === 'salary');
    expect(salary?.amount).toBe(-60_000);
    expect(s.money).toBeLessThan(money);
  });
});

describe('Integrasi pegawai', () => {
  it('kasir otomatis menyelesaikan pembayaran pasien di kasir', () => {
    const s = newState('career', { open: true });
    hire(s, 'cashier');
    const p = spawnPatient(s, { category: 'otc', symptom: 'sakit-kepala' })!;
    p.money = 200_000;
    callNextPatient(s, p.id);
    addToPatientCart(s, p.id, 'pct-500', 1);
    sendToCheckout(s, p.id);
    const money = s.money;
    advanceTime(s, 10);
    expect(p.status).toBe('done');
    expect(s.money).toBeGreaterThan(money);
    expect(s.sales.find((x) => x.id === p.saleId)?.handledBy).not.toBe('player');
  });

  it('petugas gudang mengisi rak yang kosong dari gudang', () => {
    const s = newState('career', { open: true });
    clearStock(s, 'vitc-500');
    addBatch(s, 'vitc-500', 40, 100, 'warehouse');
    hire(s, 'warehouse');
    advanceTime(s, 15);
    expect(stockOf(s, 'vitc-500', 'shelf')).toBeGreaterThan(0);
  });

  it('asisten melayani pasien obat bebas dari antrean', () => {
    const s = newState('career', { open: true });
    hire(s, 'assistant');
    hire(s, 'cashier');
    s.nextPatientAt = Number.POSITIVE_INFINITY;
    const p = spawnPatient(s, { category: 'otc', symptom: 'batuk' })!;
    p.money = 200_000;
    advanceTime(s, 20);
    expect(p.status).toBe('done');
    expect(s.stats.salesCompleted).toBe(1);
  });
});

describe('Event & peningkatan', () => {
  it('lonjakan pasien memperpendek interval kedatangan lalu berakhir', () => {
    const s = newState('career', { open: true, seed: 3 });
    const rng = s.rngState;
    const avg = () => Array.from({ length: 200 }, () => arrivalInterval(s)).reduce((a, b) => a + b, 0) / 200;
    const normal = avg();
    s.rngState = rng;
    startEvent(s, EVENTS.find((e) => e.id === 'ev-surge')!);
    const surge = avg();
    expect(surge).toBeCloseTo(normal * 0.5, 5);
    advanceTime(s, 200);
    expect(s.activeEvents).toHaveLength(0);
  });

  it('pemeriksaan inventaris mendenda batch kedaluwarsa di rak', () => {
    const s = newState('career', { open: true });
    addBatch(s, 'pct-500', 3, -1);
    const money = s.money;
    startEvent(s, EVENTS.find((e) => e.id === 'ev-inspection')!);
    advanceTime(s, 241);
    expect(s.ledger.some((e) => e.category === 'fine')).toBe(true);
    expect(s.money).toBeLessThan(money);
  });

  it('ruang tunggu meningkatkan kapasitas antrean', () => {
    const s = newState('career', { open: true });
    s.progression.level = 3;
    const cap = getEffects(s).queueCapacity;
    buyUpgrade(s, 'waiting-room');
    expect(getEffects(s).queueCapacity).toBe(cap + 2);
  });
});

describe('Mode permainan', () => {
  it('Challenge Mode memakai modal, pengubah, dan target tantangan', () => {
    const s = createNewGame({ mode: 'challenge', playerName: 'A', pharmacyName: 'B', challengeId: 'ch-modal-tipis', seed: 1 });
    expect(s.money).toBe(700_000);
    expect(s.tutorial.active).toBe(false);
    const prog = challengeProgress(s)!;
    expect(prog.target).toBe(1_500_000);
    expect(prog.daysLeft).toBe(3);
  });

  it('Challenge Mode berakhir kalah bila batas hari terlewati', () => {
    const s = createNewGame({ mode: 'challenge', playerName: 'A', pharmacyName: 'B', challengeId: 'ch-modal-tipis', seed: 1 });
    for (let d = 0; d < 3; d++) {
      openPharmacy(s);
      closeDay(s);
      if (s.gameOver) break;
      startNextDay(s);
    }
    expect(s.challenge?.status).toBe('lost');
    expect(s.gameOver).not.toBeNull();
  });

  it('Learning Mode tidak pernah bangkrut dan kesabaran turun lebih lambat', () => {
    const s = newState('learning', { open: true });
    const career = newState('career', { open: true });
    const pl = spawnPatient(s, { category: 'otc' })!;
    const pc = spawnPatient(career, { category: 'otc' })!;
    pl.status = 'waiting';
    pc.status = 'waiting';
    expect(patienceDecayRate(s, pl)).toBeLessThan(patienceDecayRate(career, pc));
    s.money = -99_000_000;
    closeDay(s);
    expect(s.gameOver).toBeNull();
  });

  it('Career Mode bangkrut setelah beberapa hari di bawah batas kredit', () => {
    const s = newState('career');
    for (let d = 0; d < 3; d++) {
      s.money = -5_000_000;
      openPharmacy(s);
      closeDay(s);
      if (s.gameOver) break;
      startNextDay(s);
    }
    expect(s.gameOver).not.toBeNull();
  });
});
