import { PATIENTS, TIME, XP } from './config';
import { challengeMods, emit, fail, getEffects, medicineById, notify, ok, type Result } from './core';
import { nextId } from './ids';
import { stockOf } from './inventory';
import { addSaleItem, cancelSale, findSale, openSale } from './pos';
import { abandonPrescription, generatePrescription } from './prescriptions';
import { addReputation, addXp, finishPatient, isFeatureUnlocked } from './progression';
import { chance, pick, rand, randInt, weightedPick } from './rng';
import { minuteOfDay } from './time';
import { INFO_TOPICS, MEDICINES, SYMPTOM_PRODUCTS } from '@/data/medicines';
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES } from '@/data/names';
import { RECIPES } from '@/data/recipes';
import type { GameState, Patient, PatientCategory, PaymentMethod, PrescriptionIssueKind, SymptomKey } from './types';

export const CATEGORY_LABELS: Record<PatientCategory, string> = {
  otc: 'Obat bebas',
  prescription: 'Resep',
  refill: 'Tebus ulang',
  inquiry: 'Tanya ketersediaan',
  compounding: 'Racikan',
  canceller: 'Obat bebas',
  info: 'Informasi umum',
};

export const STATUS_LABELS: Record<Patient['status'], string> = {
  entering: 'Masuk',
  waiting: 'Menunggu',
  serving: 'Sedang dilayani',
  awaiting: 'Menunggu racikan',
  checkout: 'Menunggu di kasir',
  done: 'Selesai',
  left: 'Pergi',
};

export function findPatient(s: GameState, id: string | null | undefined) {
  return id ? s.patients.find((p) => p.id === id) : undefined;
}

/** Bobot kategori pasien berdasarkan progres & event. */
function categoryWeights(s: GameState): Record<PatientCategory, number> {
  const w: Record<PatientCategory, number> = { otc: 38, prescription: 22, refill: 8, inquiry: 12, info: 8, canceller: 5, compounding: 0 };
  if (isFeatureUnlocked(s, 'compounding')) w.compounding = 8;
  return w;
}

function makeName(s: GameState, gender: 'L' | 'P') {
  return `${pick(s, gender === 'L' ? FIRST_NAMES_M : FIRST_NAMES_F)} ${pick(s, LAST_NAMES)}`;
}

export interface SpawnOptions {
  category?: PatientCategory;
  scripted?: boolean;
  symptom?: SymptomKey;
  issue?: PrescriptionIssueKind | 'none' | 'random';
  templateId?: string;
  recipeId?: string;
  inquiryMedicineId?: string;
}

/** Membuat pasien baru dan memasukkannya ke antrean (atau menolak jika antrean penuh). */
export function spawnPatient(s: GameState, opts: SpawnOptions = {}): Patient | null {
  const effects = getEffects(s);
  const category = opts.category ?? weightedPick(s, Object.entries(categoryWeights(s)) as [PatientCategory, number][], ([, w]) => w)![0];
  const gender = chance(s, 0.5) ? 'L' : 'P';
  const age = category === 'otc' && chance(s, 0.2) ? randInt(s, 18, 30) : randInt(s, 18, 78);
  const maxPatience = Math.round(PATIENTS.basePatience * (0.85 + rand(s) * 0.3));
  const p: Patient = {
    id: nextId(s, 'PS'),
    name: makeName(s, gender),
    age,
    gender,
    category,
    need: '',
    status: 'entering',
    patience: maxPatience,
    maxPatience,
    money: 0,
    paymentMethod: pick(s, ['cash', 'cash', 'card', 'digital'] as PaymentMethod[]),
    requestedItems: [],
    arrivedAt: s.time.now,
    satisfaction: 50,
    scripted: opts.scripted,
    visits: [],
    wrongAttempts: 0,
    appearance: randInt(s, 0, 7),
  };

  switch (category) {
    case 'otc':
    case 'canceller': {
      const demand = s.activeEvents.find((e) => e.kind === 'demand-boost');
      if (!opts.symptom && chance(s, 0.4)) {
        // Meminta produk tertentu berdasarkan nama.
        const pool = MEDICINES.filter((m) => !m.prescriptionOnly && m.category !== 'bahan-racik' && (!demand || m.category === demand.category || chance(s, 0.3)));
        const med = pick(s, pool);
        const qty = randInt(s, 1, med.sellPrice > 20_000 ? 1 : 3);
        p.requestedItems = [{ medicineId: med.id, qty }];
        p.need = `Membeli ${qty} ${med.unit} ${med.name}`;
      } else {
        let symptom = opts.symptom;
        if (!symptom) {
          const keys = Object.keys(SYMPTOM_PRODUCTS) as SymptomKey[];
          const boosted = demand ? keys.filter((k) => SYMPTOM_PRODUCTS[k].products.some((id) => MEDICINES.find((m) => m.id === id)?.category === demand.category)) : [];
          symptom = boosted.length && chance(s, 0.6) ? pick(s, boosted) : pick(s, keys);
        }
        p.symptom = symptom;
        p.need = `Keluhan: ${SYMPTOM_PRODUCTS[symptom].label.toLowerCase()}`;
      }
      p.money = randInt(s, 30, 120) * 1000;
      break;
    }
    case 'prescription':
    case 'refill': {
      const rx = generatePrescription(s, p, { refill: category === 'refill', issue: opts.issue ?? 'random', templateId: opts.templateId });
      p.prescriptionId = rx.id;
      p.need = category === 'refill' ? 'Menebus ulang resep (iter)' : 'Menebus resep dokter';
      p.money = 400_000;
      break;
    }
    case 'inquiry': {
      const pool = MEDICINES.filter((m) => m.category !== 'bahan-racik');
      const med = opts.inquiryMedicineId ? MEDICINES.find((m) => m.id === opts.inquiryMedicineId)! : pick(s, pool);
      p.inquiryMedicineId = med.id;
      p.need = `Bertanya apakah ${med.name} tersedia`;
      p.money = randInt(s, 20, 80) * 1000;
      break;
    }
    case 'info': {
      const topic = pick(s, INFO_TOPICS);
      p.infoTopicId = topic.id;
      p.need = 'Meminta informasi umum';
      break;
    }
    case 'compounding': {
      const available = RECIPES.filter((r) => r.requiredEquipmentLevel <= effects.compoundingLevel);
      const recipe = (opts.recipeId && RECIPES.find((r) => r.id === opts.recipeId)) || pick(s, available.length ? available : RECIPES);
      p.need = `Memesan racikan: ${recipe.name}`;
      p.money = 200_000;
      p.compoundingOrderId = `pending:${recipe.id}`;
      p.maxPatience = Math.round(p.maxPatience * 1.3);
      p.patience = p.maxPatience;
      break;
    }
  }

  if (s.queue.length >= effects.queueCapacity && !opts.scripted) {
    s.patients.push(p);
    finishPatient(s, p, 'turned-away');
    notify(s, 'warning', 'Antrean penuh — seorang pasien batal masuk. Tingkatkan ruang tunggu atau percepat pelayanan.');
    return null;
  }
  s.patients.push(p);
  s.queue.push(p.id);
  emit(s, { type: 'patient-arrived', refId: p.id });
  return p;
}

/** Interval kedatangan (menit) dipengaruhi reputasi, event, tantangan, dan peningkatan. */
export function arrivalInterval(s: GameState): number {
  const rep = s.progression.reputation;
  const repMult = 1.5 - rep / 100; // rep 50 → 1.0, rep 100 → 0.5, rep 0 → 1.5
  let mult = repMult / getEffects(s).spawnRate;
  const surge = s.activeEvents.find((e) => e.kind === 'patient-surge');
  if (surge) mult *= surge.magnitude;
  mult *= challengeMods(s).spawnRateMult ?? 1;
  if (s.mode === 'learning') mult *= 1.8;
  const base = PATIENTS.baseArrivalIntervalMin + rand(s) * (PATIENTS.baseArrivalIntervalMax - PATIENTS.baseArrivalIntervalMin);
  return Math.max(3, base * mult);
}

export function patienceDecayRate(s: GameState, p: Patient): number {
  if (p.scripted) return 0;
  let rate = p.status === 'waiting' || p.status === 'entering' ? PATIENTS.patienceDecayPerMinute : PATIENTS.servingDecayPerMinute;
  if (p.status === 'awaiting') rate = PATIENTS.servingDecayPerMinute * 0.8;
  if (p.status === 'checkout') rate = PATIENTS.patienceDecayPerMinute * 0.5;
  rate *= getEffects(s).patienceDecay;
  if (s.activeEvents.some((e) => e.kind === 'service-day')) rate *= 0.7;
  rate /= challengeMods(s).patienceMult ?? 1;
  if (s.mode === 'learning') rate *= 0.3;
  return rate;
}

/** Simulasi pasien per menit: masuk → antre, kesabaran berkurang, pergi bila habis. */
export function tickPatients(s: GameState, dt: number) {
  for (const p of s.patients) {
    if (p.status === 'done' || p.status === 'left') continue;
    if (p.status === 'entering' && s.time.now - p.arrivedAt >= 1) p.status = 'waiting';
    p.patience -= patienceDecayRate(s, p) * dt;
    if (p.patience <= 0) {
      p.patience = 0;
      patientLeaves(s, p);
    }
  }
  // Bersihkan pasien yang sudah lama pergi agar data simpanan tetap ringkas.
  s.patients = s.patients.filter((p) => !((p.status === 'done' || p.status === 'left') && s.time.now - (p.leftAt ?? 0) > 30));
}

/** Pasien pergi karena kehabisan kesabaran — membersihkan transaksi, resep, dan racikan terkait. */
export function patientLeaves(s: GameState, p: Patient) {
  if (p.saleId) {
    const sale = findSale(s, p.saleId);
    if (sale && sale.status === 'open') cancelSale(s, sale.id, 'Pasien pergi', { skipPatient: true });
  }
  if (p.prescriptionId) abandonPrescription(s, p.prescriptionId);
  if (p.compoundingOrderId && !p.compoundingOrderId.startsWith('pending:')) {
    const order = s.compoundingOrders.find((o) => o.id === p.compoundingOrderId);
    if (order && (order.status === 'pending' || order.status === 'in-progress')) order.status = 'cancelled';
  }
  finishPatient(s, p, 'left');
}

/** Memanggil pasien berikutnya ke Meja Pelayanan (pemain). */
export function callNextPatient(s: GameState, patientId?: string): Result<Patient> {
  if (s.time.phase !== 'open') return fail('Apotek belum dibuka.');
  const current = findPatient(s, s.activePatientId);
  if (current && current.status === 'serving') return fail(`Masih melayani ${current.name}.`);
  const id = patientId ?? s.queue.find((qid) => {
    const p = findPatient(s, qid);
    return p && (p.status === 'waiting' || p.status === 'entering') && !isBeingServedByEmployee(s, qid);
  });
  if (!id) return fail('Tidak ada pasien dalam antrean.');
  const p = findPatient(s, id);
  if (!p || (p.status !== 'waiting' && p.status !== 'entering')) return fail('Pasien tidak tersedia.');
  if (isBeingServedByEmployee(s, id)) return fail('Pasien sedang dilayani pegawai.');
  p.status = 'serving';
  p.servedAt = s.time.now;
  p.servedBy = 'player';
  s.queue = s.queue.filter((q) => q !== id);
  s.activePatientId = id;
  if (p.category === 'prescription' || p.category === 'refill') {
    const rx = s.prescriptions.find((r) => r.id === p.prescriptionId);
    if (rx && rx.status === 'received') rx.status = 'in-review';
  }
  return ok(p);
}

export function isBeingServedByEmployee(s: GameState, patientId: string) {
  return s.employees.some((e) => e.task?.targetId === patientId && (e.task.kind === 'serve' || e.task.kind === 'checkout'));
}

/** Pemain menanyakan detail keluhan (dialog). */
export function askDetails(s: GameState, patientId: string): Result<string> {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving') return fail('Pasien tidak sedang dilayani.');
  p.askedDetails = true;
  if (p.symptom) {
    const extra = ['Sudah sejak kemarin.', 'Baru tadi pagi.', 'Sudah dua hari ini.'][p.appearance % 3];
    return ok(`${extra} Budget saya sekitar Rp ${p.money.toLocaleString('id-ID')}. Saya tidak sedang mengonsumsi obat lain.`);
  }
  return ok(`Budget saya sekitar Rp ${p.money.toLocaleString('id-ID')}.`);
}

/** Apakah daftar produk sesuai kebutuhan pasien OTC (aturan permainan). */
export function evaluateOtcSelection(p: Patient, items: { medicineId: string; qty: number }[]): { ok: boolean; reason: string } {
  if (items.length === 0) return { ok: false, reason: 'Keranjang masih kosong.' };
  if (p.symptom) {
    const allowed = SYMPTOM_PRODUCTS[p.symptom].products;
    const wrong = items.filter((i) => !allowed.includes(i.medicineId));
    if (wrong.length) return { ok: false, reason: 'Ada produk yang tidak sesuai dengan keluhan pasien (menurut aturan simulasi).' };
    if (items.reduce((a, i) => a + i.qty, 0) > 3) return { ok: false, reason: 'Jumlah berlebihan untuk kebutuhan pasien.' };
    return { ok: true, reason: 'Produk sesuai keluhan.' };
  }
  for (const req of p.requestedItems) {
    const got = items.find((i) => i.medicineId === req.medicineId);
    if (!got) return { ok: false, reason: 'Produk yang diminta pasien belum ada di keranjang.' };
    if (got.qty > req.qty) return { ok: false, reason: 'Jumlah melebihi permintaan pasien.' };
  }
  if (items.some((i) => !p.requestedItems.some((r) => r.medicineId === i.medicineId))) {
    return { ok: false, reason: 'Pasien tidak meminta produk tambahan tersebut.' };
  }
  return { ok: true, reason: 'Sesuai permintaan.' };
}

/** Membuka keranjang untuk pasien OTC yang sedang dilayani. */
export function addToPatientCart(s: GameState, patientId: string, medicineId: string, qty = 1): Result {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving') return fail('Pasien tidak sedang dilayani.');
  if (!['otc', 'canceller', 'inquiry'].includes(p.category)) return fail('Pasien ini tidak membeli obat bebas.');
  const sale = openSale(s, { patientId, source: 'pos' });
  const r = addSaleItem(s, sale.id, medicineId, qty);
  return r.ok ? ok() : r;
}

/** Mengirim pasien OTC ke kasir setelah produk dipilih. Pasien menilai kesesuaian produk. */
export function sendToCheckout(s: GameState, patientId: string): Result {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving') return fail('Pasien tidak sedang dilayani.');
  const sale = p.saleId ? findSale(s, p.saleId) : undefined;
  if (!sale || sale.status !== 'open' || sale.items.length === 0) return fail('Keranjang masih kosong.');
  const verdict = evaluateOtcSelection(p, sale.items);
  if (!verdict.ok) {
    p.wrongAttempts += 1;
    s.stats.dispenseErrors += 1;
    if (!p.scripted) p.patience = Math.max(1, p.patience - 12);
    addReputation(s, -0.5);
    return fail(`Pasien menolak: ${verdict.reason}`);
  }
  if (sale.total > p.money) return fail(`Total melebihi budget pasien (Rp ${p.money.toLocaleString('id-ID')}). Kurangi jumlah.`);
  p.status = 'checkout';
  if (s.activePatientId === p.id) s.activePatientId = null;
  addXp(s, XP.serve);
  if (p.category === 'canceller') p.cancelRequested = true;
  return ok(undefined, `${p.name} menuju kasir.`);
}

/** Pemain menyatakan produk tidak tersedia / tidak dapat melayani permintaan OTC. */
export function declineOtc(s: GameState, patientId: string): Result<{ justified: boolean }> {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving') return fail('Pasien tidak sedang dilayani.');
  const products = p.symptom ? SYMPTOM_PRODUCTS[p.symptom].products : p.requestedItems.map((r) => r.medicineId);
  const available = products.some((id) => stockOf(s, id, 'any') > 0);
  if (p.saleId) {
    const sale = findSale(s, p.saleId);
    if (sale?.status === 'open') cancelSale(s, sale.id, 'Tidak jadi membeli', { skipPatient: true });
  }
  if (available) {
    addReputation(s, -1.5);
    notify(s, 'warning', 'Sebenarnya produk yang sesuai tersedia. Pasien kecewa.');
  } else {
    addReputation(s, 0.2);
    notify(s, 'info', 'Stok memang kosong. Segera lakukan pengadaan.');
  }
  finishPatient(s, p, 'cancelled');
  return ok({ justified: !available });
}

/** Menjawab pertanyaan ketersediaan. Benar bila jawaban cocok dengan stok layak (rak + gudang). */
export function answerInquiry(s: GameState, patientId: string, answerAvailable: boolean): Result<{ correct: boolean; buys: boolean }> {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving' || p.category !== 'inquiry' || !p.inquiryMedicineId) return fail('Pasien tidak sedang bertanya ketersediaan.');
  const med = medicineById(s, p.inquiryMedicineId)!;
  const actual = stockOf(s, med.id, 'any') > 0;
  const correct = actual === answerAvailable;
  if (correct) {
    s.stats.inquiriesAnswered += 1;
    addXp(s, XP.inquiry);
    addReputation(s, 0.5);
  } else {
    p.wrongAttempts += 1;
    addReputation(s, -1.5);
    notify(s, 'warning', `Jawaban kurang tepat: ${med.name} ${actual ? 'sebenarnya tersedia' : 'sebenarnya tidak tersedia'}.`);
  }
  const canBuy = actual && answerAvailable && !med.prescriptionOnly && stockOf(s, med.id, 'shelf') > 0 && chance(s, 0.6);
  if (canBuy) {
    p.category = 'otc';
    p.requestedItems = [{ medicineId: med.id, qty: 1 }];
    p.need = `Membeli 1 ${med.unit} ${med.name}`;
    return ok({ correct, buys: true });
  }
  finishPatient(s, p, correct ? 'served' : 'cancelled');
  return ok({ correct, buys: false });
}

/** Menjawab pertanyaan informasi umum. */
export function answerInfo(s: GameState, patientId: string, optionIndex: number): Result<{ correct: boolean; explanation: string }> {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving' || p.category !== 'info') return fail('Pasien tidak sedang meminta informasi.');
  const topic = INFO_TOPICS.find((t) => t.id === p.infoTopicId);
  if (!topic) return fail('Topik tidak ditemukan.');
  const correct = optionIndex === topic.correct;
  if (correct) {
    s.stats.infoAnswered += 1;
    addXp(s, XP.inquiry);
    finishPatient(s, p, 'served');
  } else {
    p.wrongAttempts += 1;
    addReputation(s, -1);
    finishPatient(s, p, 'cancelled');
  }
  return ok({ correct, explanation: topic.explanation });
}

/** Pemain mempersilakan pasien kembali ke antrean (mis. saat perlu mengisi rak dulu). */
export function returnToQueue(s: GameState, patientId: string): Result {
  const p = findPatient(s, patientId);
  if (!p || p.status !== 'serving') return fail('Pasien tidak sedang dilayani.');
  p.status = 'waiting';
  s.queue.unshift(p.id);
  if (s.activePatientId === p.id) s.activePatientId = null;
  if (!p.scripted) p.patience = Math.max(1, p.patience - 5);
  return ok();
}

/** Penjadwalan kedatangan berikutnya. */
export function scheduleNextArrival(s: GameState) {
  s.nextPatientAt = s.time.now + arrivalInterval(s);
}

export function shouldSpawnRandom(s: GameState) {
  const m = minuteOfDay(s.time.now);
  if (s.time.phase !== 'open' || m >= TIME.lastArrivalMinute) return false;
  // Selama tutorial, pasien acak hanya ditahan selama pasien tutorial masih dilayani.
  if (s.tutorial.active && s.patients.some((p) => p.scripted && p.status !== 'done' && p.status !== 'left')) return false;
  return s.time.now >= s.nextPatientAt;
}
