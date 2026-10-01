import { ECONOMY, TIME } from './config';
import { addLedger, emit, fail, notify, ok, operationalCost, type Result } from './core';
import { evaluateChallenge } from './challenge';
import { dailySalary, generateCandidates, resetEmployeesForNewDay, tickEmployees } from './employees';
import { endEvent, maybeTriggerEvent, updateEvents } from './events';
import { buildDailyReport } from './finance';
import { evaluateLesson, evaluateTutorial } from './guidance';
import { expiryCheck } from './inventory';
import { evaluateAchievements, evaluateMissions } from './missions';
import { scheduleNextArrival, shouldSpawnRandom, spawnPatient, tickPatients } from './patients';
import { cancelSale, findSale } from './pos';
import { progressOrders } from './procurement';
import { finishPatient } from './progression';
import { absAt, minuteOfDay } from './time';
import type { GameState } from './types';

/** Evaluasi lintas sistem setelah setiap aksi atau langkah waktu. */
export function postProcess(s: GameState) {
  evaluateMissions(s);
  evaluateAchievements(s);
  evaluateTutorial(s);
  evaluateLesson(s);
  evaluateChallenge(s, false);
}

export function openPharmacy(s: GameState): Result {
  if (s.gameOver) return fail('Permainan telah berakhir.');
  if (s.time.phase === 'open') return fail('Apotek sudah buka.');
  if (s.time.phase === 'closed') return fail('Hari sudah berakhir. Mulai hari berikutnya.');
  s.time.phase = 'open';
  s.time.now = absAt(s.time.day, TIME.openMinute);
  s.nextPatientAt = s.time.now + 2;
  emit(s, { type: 'day-opened' });
  notify(s, 'info', 'Apotek dibuka. Pasien mulai berdatangan.');
  return ok();
}

/**
 * Memajukan waktu permainan (dalam menit). Hanya berjalan saat apotek buka.
 * Diproses per langkah ≤ 1 menit agar hasil konsisten pada kecepatan berapa pun.
 */
export function advanceTime(s: GameState, dt: number) {
  let remaining = dt;
  while (remaining > 1e-9 && s.time.phase === 'open' && !s.gameOver) {
    const step = Math.min(1, remaining);
    remaining -= step;
    const prevHour = Math.floor(minuteOfDay(s.time.now) / 60);
    s.time.now += step;
    if (shouldSpawnRandom(s)) {
      spawnPatient(s);
      scheduleNextArrival(s);
    }
    tickPatients(s, step);
    tickEmployees(s, step);
    progressOrders(s);
    updateEvents(s);
    if (Math.floor(minuteOfDay(s.time.now) / 60) !== prevHour) maybeTriggerEvent(s);
    if (minuteOfDay(s.time.now) >= TIME.closeMinute) closeDay(s);
  }
}

/** Menutup hari: membereskan pasien, membayar biaya harian, membuat laporan. */
export function closeDay(s: GameState): Result {
  if (s.time.phase !== 'open') return fail('Apotek belum dibuka.');
  const day = s.time.day;
  s.time.now = absAt(day, TIME.closeMinute);

  for (const p of s.patients) {
    if (p.status === 'done' || p.status === 'left') continue;
    if (p.saleId) {
      const sale = findSale(s, p.saleId);
      if (sale?.status === 'open') cancelSale(s, sale.id, 'Apotek tutup', { skipPatient: true });
    }
    finishPatient(s, p, 'cancelled');
  }
  for (const o of s.compoundingOrders) if (o.status === 'pending' || o.status === 'in-progress') o.status = 'cancelled';
  for (const rx of s.prescriptions) if (rx.status === 'received' || rx.status === 'in-review' || rx.status === 'on-hold') rx.status = 'rejected';
  s.queue = [];
  s.activePatientId = null;
  for (const ev of [...s.activeEvents]) endEvent(s, ev);

  for (const e of s.employees) {
    const pay = dailySalary(e);
    if (pay > 0) addLedger(s, 'salary', -pay, `Gaji ${e.name}`, e.id);
  }
  addLedger(s, 'operational', -operationalCost(s), `Biaya operasional hari ke-${day}`);

  const st = s.stats;
  const d0 = s.dayStart.stats;
  const served = st.patientsServed - d0.patientsServed;
  s.reports.push(
    buildDailyReport(s, day, {
      patientsServed: served,
      patientsLeft: st.patientsLeft - d0.patientsLeft + (st.patientsTurnedAway - d0.patientsTurnedAway),
      salesCount: st.salesCompleted - d0.salesCompleted,
      prescriptionsDispensed: st.prescriptionsDispensed - d0.prescriptionsDispensed,
      compoundingDone: st.compoundingCompleted - d0.compoundingCompleted,
      reputationStart: s.dayStart.reputation,
      reputationEnd: s.progression.reputation,
      avgWaitMinutes: served > 0 ? (st.totalWaitMinutes - d0.totalWaitMinutes) / Math.max(1, served) : 0,
      errors: st.dispenseErrors - d0.dispenseErrors + (st.fefoViolations - d0.fefoViolations),
    }),
  );
  if (s.reports.length > 120) s.reports.splice(0, s.reports.length - 120);

  s.stats.daysCompleted += 1;
  expiryCheck(s);
  generateCandidates(s);

  if (s.mode !== 'learning') {
    if (s.money < ECONOMY.emergencyCreditLimit) {
      s.pharmacy.debtDays += 1;
      const left = ECONOMY.bankruptcyDays - s.pharmacy.debtDays;
      if (left <= 0 && s.mode === 'career') {
        s.gameOver = { reason: `Kas di bawah batas kredit darurat selama ${ECONOMY.bankruptcyDays} hari berturut-turut. Apotek bangkrut.` };
      } else {
        notify(s, 'error', `Kas di bawah batas kredit darurat! ${left} hari lagi sebelum bangkrut.`);
      }
    } else {
      if (s.money < 0) notify(s, 'warning', 'Kas negatif — kamu memakai kredit darurat. Kurangi pengeluaran dan tingkatkan penjualan.');
      s.pharmacy.debtDays = 0;
    }
  }

  s.time.phase = 'closed';
  evaluateChallenge(s, true);
  if (s.challenge && s.challenge.status !== 'running' && !s.gameOver) {
    s.gameOver = { reason: s.challenge.resultText ?? 'Tantangan selesai.' };
  }
  emit(s, { type: 'day-closed', message: String(day) });
  return ok();
}

export function startNextDay(s: GameState): Result {
  if (s.time.phase !== 'closed') return fail('Hari ini belum ditutup.');
  if (s.gameOver) return fail('Permainan telah berakhir.');
  s.time.day += 1;
  s.time.now = absAt(s.time.day, TIME.preopenMinute);
  s.time.phase = 'preopen';
  s.dayStart = { reputation: s.progression.reputation, money: s.money, stats: { ...s.stats } };
  resetEmployeesForNewDay(s);
  progressOrders(s);
  scheduleNextArrival(s);
  notify(s, 'info', `Hari ke-${s.time.day} dimulai. Siapkan stok, lalu buka apotek.`);
  return ok();
}

