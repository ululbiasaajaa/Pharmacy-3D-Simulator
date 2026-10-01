/**
 * Tutorial interaktif (semua mode kecuali tantangan) dan pelajaran Learning Mode.
 */
import { TIME } from './config';
import { emit, fail, notify, ok, today, type Result } from './core';
import { receiveBatch, stockOf, adjustBatch } from './inventory';
import { spawnPatient } from './patients';
import { createCompoundingOrder } from './compounding';
import { addXp } from './progression';
import { LESSONS, type LessonDef } from '@/data/lessons';
import { TUTORIAL_STEPS, type TutorialSignal } from '@/data/tutorial';
import type { GameState, GameStats } from './types';

// ------------------------------------------------------------------ Tutorial

function enterTutorialStep(s: GameState) {
  const step = TUTORIAL_STEPS[s.tutorial.step];
  if (!step) return;
  if (step.id === 'serve' && s.time.phase === 'open') {
    const hasScripted = s.patients.some((p) => p.scripted && p.status !== 'done' && p.status !== 'left');
    if (!hasScripted) spawnPatient(s, { category: 'otc', scripted: true, symptom: 'sakit-kepala' });
  }
}

function advanceTutorial(s: GameState) {
  s.tutorial.step += 1;
  if (s.tutorial.step >= TUTORIAL_STEPS.length) {
    s.tutorial.active = false;
    s.tutorial.completed = true;
    addXp(s, 60);
    notify(s, 'success', 'Tutorial selesai! Apotek sekarang beroperasi normal.');
    return;
  }
  enterTutorialStep(s);
}

/** Apakah langkah tutorial saat ini menunggu sinyal tersebut. */
export function tutorialAwaits(s: GameState, signal: TutorialSignal) {
  return s.tutorial.active && TUTORIAL_STEPS[s.tutorial.step]?.signal === signal;
}

export function tutorialSignal(s: GameState, signal: TutorialSignal) {
  if (!s.tutorial.active) return;
  const step = TUTORIAL_STEPS[s.tutorial.step];
  if (step?.signal === signal) advanceTutorial(s);
}

export function evaluateTutorial(s: GameState) {
  // Apotek sudah dibuka: langkah pengantar (sambutan, bergerak) tidak relevan lagi.
  const openIdx = TUTORIAL_STEPS.findIndex((st) => st.id === 'open');
  if (s.tutorial.active && s.time.phase === 'open' && s.tutorial.step < openIdx) s.tutorial.step = openIdx;
  let guard = 0;
  while (s.tutorial.active && guard++ < TUTORIAL_STEPS.length) {
    const step = TUTORIAL_STEPS[s.tutorial.step];
    if (!step?.done || !step.done(s)) break;
    advanceTutorial(s);
  }
}

/** Melewati satu langkah tutorial (mis. pemain memakai akses cepat dan tidak berjalan). */
export function skipTutorialStep(s: GameState) {
  if (s.tutorial.active) advanceTutorial(s);
}

export function skipTutorial(s: GameState) {
  s.tutorial.active = false;
  s.tutorial.skipped = true;
}

// ------------------------------------------------------------------ Pelajaran

const TRACKED: (keyof GameStats)[] = [
  'salesCompleted',
  'prescriptionsDispensed',
  'issuesDetected',
  'expiredDisposed',
  'ordersReceived',
  'compoundingCompleted',
  'dispenseErrors',
  'fefoViolations',
  'perfectPrescriptions',
  'compoundingPerfect',
];

export function lessonDef(id: string): LessonDef | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function startLesson(s: GameState, lessonId: string): Result<LessonDef> {
  if (s.mode !== 'learning') return fail('Pelajaran hanya tersedia pada Learning Mode.');
  const def = lessonDef(lessonId);
  if (!def) return fail('Pelajaran tidak ditemukan.');
  if (s.lessons.activeLessonId) return fail('Selesaikan atau hentikan pelajaran aktif terlebih dahulu.');
  if (s.time.phase === 'closed') return fail('Mulai hari berikutnya terlebih dahulu.');
  if (s.time.phase === 'preopen') {
    s.time.phase = 'open';
    s.time.now = (today(s) - 1) * TIME.minutesPerDay + TIME.openMinute;
    s.nextPatientAt = s.time.now + 20;
    emit(s, { type: 'day-opened' });
  }
  s.lessons.activeLessonId = def.id;
  s.lessons.baseline = Object.fromEntries(TRACKED.map((k) => [k, s.stats[k]]));
  setupLesson(s, def);
  notify(s, 'info', `Pelajaran dimulai: ${def.title}`);
  return ok(def);
}

function ensureShelfStock(s: GameState, medicineId: string, qty: number) {
  const have = stockOf(s, medicineId, 'shelf');
  if (have >= qty) return;
  const med = s.medicines.find((m) => m.id === medicineId)!;
  receiveBatch(s, { medicineId, qty: qty - have + 2, expiryDay: today(s) + 180, unitCost: med.buyPrice, location: 'shelf', note: 'Persiapan pelajaran', skipCapacity: true });
}

function setupLesson(s: GameState, def: LessonDef) {
  switch (def.setup) {
    case 'otc':
      ensureShelfStock(s, 'pct-500', 3);
      spawnPatient(s, { category: 'otc', scripted: true, symptom: 'sakit-kepala' });
      break;
    case 'rx-basic':
      ensureShelfStock(s, 'amox-500', 3);
      ensureShelfStock(s, 'pct-500', 3);
      spawnPatient(s, { category: 'prescription', scripted: true, issue: 'none', templateId: 'rx-a' });
      break;
    case 'rx-issue':
      ensureShelfStock(s, 'amlo-5', 4);
      spawnPatient(s, { category: 'prescription', scripted: true, issue: 'missing-instructions', templateId: 'rx-b' });
      break;
    case 'fefo': {
      const d = today(s);
      const med = s.medicines.find((m) => m.id === 'pct-500')!;
      receiveBatch(s, { medicineId: 'pct-500', qty: 4, expiryDay: d - 2, unitCost: med.buyPrice, location: 'shelf', batchNo: 'LOT-EXP01', note: 'Skenario FEFO', skipCapacity: true });
      receiveBatch(s, { medicineId: 'pct-500', qty: 5, expiryDay: d + 12, unitCost: med.buyPrice, location: 'shelf', batchNo: 'LOT-DEKAT', note: 'Skenario FEFO', skipCapacity: true });
      receiveBatch(s, { medicineId: 'pct-500', qty: 10, expiryDay: d + 300, unitCost: med.buyPrice, location: 'shelf', batchNo: 'LOT-JAUH', note: 'Skenario FEFO', skipCapacity: true });
      ensureShelfStock(s, 'amox-500', 3);
      spawnPatient(s, { category: 'prescription', scripted: true, issue: 'none', templateId: 'rx-a' });
      break;
    }
    case 'procure': {
      for (const b of s.batches.filter((x) => x.medicineId === 'vitc-500' && x.status === 'active' && x.qty > 0)) {
        adjustBatch(s, b.id, 0, 'Skenario pelajaran: stok habis');
      }
      notify(s, 'warning', 'Vitamin C 500 mg habis! Pesan ke pemasok melalui Komputer.');
      break;
    }
    case 'compound': {
      for (const [id, g] of [['zno', 20], ['vas-alb', 120]] as const) {
        const med = s.medicines.find((m) => m.id === id)!;
        if (stockOf(s, id, 'any') < g) receiveBatch(s, { medicineId: id, qty: g, expiryDay: today(s) + 300, unitCost: med.buyPrice, location: 'shelf', note: 'Persiapan pelajaran', skipCapacity: true });
      }
      const p = spawnPatient(s, { category: 'compounding', scripted: true, recipeId: 'rcp-zno-salep' });
      if (!p) createCompoundingOrder(s, 'rcp-zno-salep');
      break;
    }
  }
}

export function lessonProgress(s: GameState) {
  const def = s.lessons.activeLessonId ? lessonDef(s.lessons.activeLessonId) : undefined;
  if (!def) return null;
  return def.objectives.map((o) => {
    const v = s.stats[o.stat] - (s.lessons.baseline[o.stat] ?? 0);
    return { ...o, value: Math.min(o.target, v), done: v >= o.target };
  });
}

export function evaluateLesson(s: GameState) {
  const def = s.lessons.activeLessonId ? lessonDef(s.lessons.activeLessonId) : undefined;
  if (!def) return;
  const prog = lessonProgress(s)!;
  if (!prog.every((p) => p.done)) return;
  const delta = (k: keyof GameStats) => s.stats[k] - (s.lessons.baseline[k] ?? 0);
  const lines: string[] = [];
  const errors = delta('dispenseErrors');
  const fefo = delta('fefoViolations');
  lines.push(`Tujuan tercapai: ${def.objectives.map((o) => o.label).join(', ')}.`);
  if (errors === 0) lines.push('Tidak ada kesalahan penyiapan/rekomendasi — kerja yang teliti!');
  else lines.push(`${errors} percobaan mengandung kesalahan. Tinjau pesan validasi untuk memahami penyebabnya.`);
  if (def.setup === 'fefo' || fefo > 0) lines.push(fefo === 0 ? 'FEFO diterapkan dengan benar.' : `FEFO tidak diterapkan pada ${fefo} item. Pilih batch yang kedaluwarsa paling dekat.`);
  if (delta('perfectPrescriptions') > 0) lines.push('Resep dilayani dengan skor sempurna.');
  if (delta('compoundingPerfect') > 0) lines.push('Racikan bernilai sempurna.');
  lines.push(`Sumber: ${def.source}`);
  const score = Math.max(0, 100 - errors * 20 - fefo * 10);
  s.lessons.completed = [...new Set([...s.lessons.completed, def.id])];
  s.lessons.feedback.push({ lessonId: def.id, lines, score });
  s.lessons.activeLessonId = null;
  addXp(s, 50);
  notify(s, 'success', `Pelajaran selesai: ${def.title} (nilai ${score}).`);
}

export function abortLesson(s: GameState) {
  s.lessons.activeLessonId = null;
}
