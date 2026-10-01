import { ECONOMY, XP } from './config';
import { emit, fail, getEffects, medicineById, notify, ok, today, type Result } from './core';
import { nextId } from './ids';
import { consumeBatch, selectFEFO, stockOf, usableBatches } from './inventory';
import { findPatient } from './patients';
import { openSale, recalcSale } from './pos';
import { addReputation, addXp, finishPatient, isFeatureUnlocked } from './progression';
import { RECIPES } from '@/data/recipes';
import type { CompoundingAttempt, CompoundingOrder, CompoundingRecipe, GameState } from './types';

export function findRecipe(id: string): CompoundingRecipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function recipeAvailable(s: GameState, r: CompoundingRecipe) {
  return r.requiredEquipmentLevel <= getEffects(s).compoundingLevel;
}

export function createCompoundingOrder(s: GameState, recipeId: string, patientId?: string): Result<CompoundingOrder> {
  const recipe = findRecipe(recipeId);
  if (!recipe) return fail('Resep racikan tidak ditemukan.');
  if (!recipeAvailable(s, recipe)) return fail('Peralatan racik belum memadai untuk racikan ini. Tingkatkan Peralatan Racik.');
  const order: CompoundingOrder = { id: nextId(s, 'RC'), recipeId, patientId, status: 'pending', createdAt: s.time.now, attempts: 0 };
  s.compoundingOrders.push(order);
  if (s.compoundingOrders.length > 200) s.compoundingOrders.splice(0, s.compoundingOrders.length - 200);
  return ok(order);
}

/** Pemain menerima pesanan racikan dari pasien di meja pelayanan. */
export function acceptCompoundingRequest(s: GameState, patientId: string): Result<CompoundingOrder> {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving' || p.category !== 'compounding') return fail('Pasien tidak sedang memesan racikan.');
  if (!isFeatureUnlocked(s, 'compounding')) return fail('Laboratorium peracikan belum terbuka.');
  const recipeId = p.compoundingOrderId?.startsWith('pending:') ? p.compoundingOrderId.slice(8) : null;
  if (!recipeId) return fail('Pesanan racikan sudah dibuat.');
  const r = createCompoundingOrder(s, recipeId, p.id);
  if (!r.ok) return r;
  p.compoundingOrderId = r.value!.id;
  p.status = 'awaiting';
  if (s.activePatientId === p.id) s.activePatientId = null;
  notify(s, 'info', `Pesanan racikan ${r.value!.id} dibuat. Kerjakan di Meja Peracikan.`);
  return r;
}

/** Menolak pesanan racikan (mis. bahan/peralatan tidak tersedia). */
export function declineCompoundingRequest(s: GameState, patientId: string): Result<{ justified: boolean }> {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving' || p.category !== 'compounding') return fail('Pasien tidak sedang memesan racikan.');
  const recipeId = p.compoundingOrderId?.startsWith('pending:') ? p.compoundingOrderId.slice(8) : '';
  const recipe = findRecipe(recipeId);
  const feasible = !!recipe && recipeAvailable(s, recipe) && isFeatureUnlocked(s, 'compounding') && missingIngredients(s, recipe).length === 0;
  if (feasible) addReputation(s, -1);
  finishPatient(s, p, 'cancelled');
  return ok({ justified: !feasible });
}

export function missingIngredients(s: GameState, recipe: CompoundingRecipe) {
  return recipe.ingredients.filter((ing) => stockOf(s, ing.medicineId, 'any') < Math.ceil(ing.amount * (1 + ing.tolerance)));
}

export function startCompounding(s: GameState, orderId: string): Result<CompoundingOrder> {
  const order = s.compoundingOrders.find((o) => o.id === orderId);
  if (!order) return fail('Pesanan tidak ditemukan.');
  if (order.status !== 'pending' && order.status !== 'in-progress') return fail('Pesanan tidak dapat dikerjakan.');
  const recipe = findRecipe(order.recipeId)!;
  if (!recipeAvailable(s, recipe)) return fail('Peralatan racik belum memadai.');
  const missing = missingIngredients(s, recipe);
  if (missing.length) return fail(`Bahan kurang: ${missing.map((m) => medicineById(s, m.medicineId)?.name).join(', ')}. Pesan ke pemasok bahan.`);
  order.status = 'in-progress';
  return ok(order);
}

export interface CompoundingEvaluation {
  score: number;
  passed: boolean;
  feedback: string[];
  weighingAccuracy: Record<string, number>;
}

/** Penilaian murni atas percobaan peracikan (tanpa mengubah state). */
export function evaluateCompounding(recipe: CompoundingRecipe, attempt: CompoundingAttempt): CompoundingEvaluation {
  const feedback: string[] = [];
  let score = 100;
  let critical = false;
  const weighingAccuracy: Record<string, number> = {};

  for (const ing of recipe.ingredients) {
    const w = attempt.weighed[ing.medicineId] ?? 0;
    const dev = Math.abs(w - ing.amount) / ing.amount;
    weighingAccuracy[ing.medicineId] = Math.round((1 - Math.min(1, dev)) * 100);
    if (w <= 0) {
      critical = true;
      feedback.push(`Bahan ${ing.medicineId} belum ditimbang.`);
    } else if (dev > ing.tolerance) {
      critical = true;
      feedback.push(`Penimbangan ${ing.medicineId}: ${w.toFixed(2)} g, target ${ing.amount} g (±${Math.round(ing.tolerance * 100)}%). Di luar toleransi.`);
    } else if (dev > ing.tolerance / 2) {
      score -= 5;
      feedback.push(`Penimbangan ${ing.medicineId} masih dalam toleransi namun kurang presisi (${(dev * 100).toFixed(1)}%).`);
    }
  }
  const extras = Object.keys(attempt.weighed).filter((k) => attempt.weighed[k] > 0 && !recipe.ingredients.some((i) => i.medicineId === k));
  if (extras.length) {
    critical = true;
    feedback.push('Ada bahan yang tidak termasuk dalam instruksi racikan.');
  }

  const expected = recipe.steps;
  const done = attempt.stepsDone;
  const orderOk = expected.every((st, i) => done[i] === st) && done.length === expected.length;
  if (!orderOk) {
    const missing = expected.filter((st) => !done.includes(st));
    if (missing.length) {
      critical = true;
      feedback.push(`Langkah belum dilakukan: ${missing.join(', ')}.`);
    } else {
      score -= 20;
      feedback.push('Urutan kerja tidak sesuai instruksi.');
    }
  }
  if (expected.includes('grind')) {
    if (attempt.grindQuality < 0.5) {
      score -= 20;
      feedback.push('Penggerusan kurang halus.');
    } else if (attempt.grindQuality < 0.8) score -= 8;
  }
  if (expected.includes('mix')) {
    if (attempt.mixQuality < 0.5) {
      score -= 20;
      feedback.push('Campuran belum homogen.');
    } else if (attempt.mixQuality < 0.8) score -= 8;
  }
  if (recipe.divideInto) {
    if (attempt.divideCount !== recipe.divideInto) {
      critical = true;
      feedback.push(`Serbuk harus dibagi menjadi ${recipe.divideInto} bungkus.`);
    }
  }
  if (attempt.container !== recipe.container) {
    critical = true;
    feedback.push(`Wadah tidak sesuai. Gunakan: ${recipe.container}.`);
  }
  if (attempt.labelText.trim() !== recipe.labelInstructions) {
    score -= 15;
    feedback.push('Etiket tidak sesuai instruksi skenario.');
  }
  score = Math.max(0, Math.min(100, score));
  const passed = !critical && score >= 60;
  if (passed && feedback.length === 0) feedback.push('Racikan sempurna!');
  return { score: critical ? Math.min(score, 40) : score, passed, feedback, weighingAccuracy };
}

/**
 * Menyerahkan hasil peracikan. Bahan yang ditimbang selalu terpakai (termasuk saat gagal),
 * sehingga ketelitian berdampak ekonomi.
 */
export function submitCompounding(s: GameState, attempt: CompoundingAttempt): Result<CompoundingEvaluation> {
  const order = s.compoundingOrders.find((o) => o.id === attempt.orderId);
  if (!order) return fail('Pesanan tidak ditemukan.');
  if (order.status === 'completed') return fail('Pesanan sudah selesai.');
  if (order.status !== 'in-progress') return fail('Mulai pesanan terlebih dahulu.');
  const recipe = findRecipe(order.recipeId)!;
  const day = today(s);

  // Pastikan bahan tersedia sebelum mengurangi stok apa pun.
  const plans: { medicineId: string; allocations: { batchId: string; qty: number }[] }[] = [];
  for (const [medicineId, grams] of Object.entries(attempt.weighed)) {
    const qty = Math.ceil(grams);
    if (qty <= 0) continue;
    const plan = selectFEFO(usableBatches(s, medicineId, 'any'), qty, day);
    if (plan.shortage > 0) return fail(`Bahan ${medicineById(s, medicineId)?.name ?? medicineId} tidak cukup.`);
    plans.push({ medicineId, allocations: plan.allocations });
  }
  const allocs: { batchId: string; qty: number; unitCost: number }[] = [];
  for (const p of plans) {
    for (const a of p.allocations) {
      const b = s.batches.find((x) => x.id === a.batchId)!;
      consumeBatch(s, a.batchId, a.qty, 'compounding', `Racikan ${order.id}`, order.id);
      allocs.push({ batchId: a.batchId, qty: a.qty, unitCost: b.unitCost });
    }
  }

  const ev = evaluateCompounding(recipe, attempt);
  order.attempts += 1;
  order.feedback = ev.feedback;
  const patient = order.patientId ? findPatient(s, order.patientId) : undefined;
  if (!ev.passed) {
    if (patient && !patient.scripted) patient.patience = Math.max(1, patient.patience - 15);
    notify(s, 'warning', 'Racikan tidak memenuhi syarat. Ulangi pekerjaan (bahan yang terpakai tidak kembali).');
    return ok(ev);
  }
  order.status = 'completed';
  order.completedAt = s.time.now;
  order.score = ev.score;
  s.stats.compoundingCompleted += 1;
  if (ev.score >= 95) s.stats.compoundingPerfect += 1;
  addXp(s, XP.compounding + Math.round(ev.score / 10));
  emit(s, { type: 'compounding-completed', refId: order.id });

  if (patient && patient.status === 'awaiting') {
    const sale = openSale(s, { patientId: patient.id, source: 'compounding', refId: order.id });
    sale.items = [
      { medicineId: `recipe:${recipe.id}`, qty: 1, unitPrice: recipe.price, allocations: allocs },
      { medicineId: 'fee:compounding', qty: 1, unitPrice: ECONOMY.compoundingServiceFee, allocations: [] },
    ];
    sale.stockCommitted = true;
    recalcSale(sale);
    patient.status = 'checkout';
    if (patient.money < sale.total) patient.money = sale.total;
    notify(s, 'success', `Racikan untuk ${patient.name} selesai (nilai ${ev.score}). Pasien menuju kasir.`);
  } else if (!patient) {
    notify(s, 'success', `Racikan latihan selesai (nilai ${ev.score}).`);
  }
  return ok(ev);
}

/** Nama tampilan item transaksi (obat, racikan, atau jasa). */
export function itemDisplayName(s: GameState, id: string): string {
  if (id === 'fee:rx') return 'Jasa pelayanan resep';
  if (id === 'fee:compounding') return 'Jasa peracikan';
  if (id.startsWith('recipe:')) return findRecipe(id.slice(7))?.name ?? 'Racikan';
  return medicineById(s, id)?.name ?? id;
}

/** Pesanan racikan yang masih terbuka. */
export function openCompoundingOrders(s: GameState) {
  return s.compoundingOrders.filter((o) => o.status === 'pending' || o.status === 'in-progress');
}

