import { ECONOMY, XP } from './config';
import { emit, fail, medicineById, notify, ok, today, type Result } from './core';
import { nextId } from './ids';
import { consumeBatch, isExpired, recommendBatch, usableBatches } from './inventory';
import { openSale, recalcSale } from './pos';
import { addReputation, addXp, finishPatient } from './progression';
import { chance, pick, randInt } from './rng';
import { CLINICS, PRESCRIBERS } from '@/data/names';
import { RX_TEMPLATES, UNAVAILABLE_STRENGTHS, type RxTemplate } from '@/data/prescriptionTemplates';
import type {
  DispenseDraft,
  GameState,
  Patient,
  Prescription,
  PrescriptionIssueKind,
  ValidationIssue,
} from './types';

export const ISSUE_LABELS: Record<PrescriptionIssueKind, string> = {
  'missing-instructions': 'Aturan pakai tidak tertulis',
  'missing-patient-age': 'Umur pasien tidak tertulis',
  'missing-prescriber': 'Identitas/paraf penulis resep tidak ada',
  'unavailable-strength': 'Kekuatan obat tidak tersedia di katalog',
  'iter-exhausted': 'Jatah pengulangan (iter) resep sudah habis',
};

/** Masalah yang dapat diselesaikan dengan konfirmasi ke penulis resep (simulasi). */
export const RESOLVABLE_ISSUES: PrescriptionIssueKind[] = ['missing-instructions', 'missing-patient-age', 'unavailable-strength'];

export function findPrescription(s: GameState, id: string) {
  return s.prescriptions.find((r) => r.id === id);
}

/** Membuat resep fiktif dari templat. */
export function generatePrescription(
  s: GameState,
  patient: Patient,
  opts: { refill?: boolean; issue?: PrescriptionIssueKind | 'none' | 'random'; templateId?: string } = {},
): Prescription {
  const pool = opts.refill ? RX_TEMPLATES.filter((t) => t.refillable) : RX_TEMPLATES;
  const tpl: RxTemplate = (opts.templateId && RX_TEMPLATES.find((t) => t.id === opts.templateId)) || pick(s, pool);
  const items = tpl.items.map((it) => ({
    writtenName: it.writtenName,
    medicineId: it.medicineId,
    strength: it.strength,
    form: it.form,
    qty: randInt(s, it.qty[0], it.qty[1]),
    instructions: it.instructions,
  }));
  const rx: Prescription = {
    id: nextId(s, 'RX'),
    patientId: patient.id,
    patientName: patient.name,
    patientAge: patient.age,
    prescriber: pick(s, PRESCRIBERS),
    clinic: pick(s, CLINICS),
    writtenDay: Math.max(1, today(s) - randInt(s, 0, opts.refill ? 20 : 2)),
    items,
    notes: tpl.notes,
    status: 'received',
    receivedAt: s.time.now,
    isRefill: !!opts.refill,
    iterRemaining: opts.refill ? randInt(s, 0, 2) : 0,
  };

  let issue: PrescriptionIssueKind | undefined;
  if (opts.issue && opts.issue !== 'random' && opts.issue !== 'none') issue = opts.issue;
  else if (opts.issue !== 'none') {
    if (rx.isRefill && rx.iterRemaining === 0) issue = 'iter-exhausted';
    else if (chance(s, s.progression.level >= 2 || s.mode === 'learning' ? 0.22 : 0.08)) {
      issue = pick(s, ['missing-instructions', 'missing-patient-age', 'missing-prescriber', 'unavailable-strength'] as const);
    }
  }
  if (issue === 'iter-exhausted') rx.iterRemaining = 0;
  if (rx.isRefill && issue !== 'iter-exhausted' && rx.iterRemaining === 0) rx.iterRemaining = 1;
  if (issue) applyIssue(rx, issue);
  s.prescriptions.push(rx);
  if (s.prescriptions.length > 400) s.prescriptions.splice(0, s.prescriptions.length - 400);
  return rx;
}

function applyIssue(rx: Prescription, issue: PrescriptionIssueKind) {
  rx.hiddenIssue = issue;
  switch (issue) {
    case 'missing-instructions':
      rx.items[0].instructions = '';
      break;
    case 'missing-patient-age':
      rx.patientAge = null;
      break;
    case 'missing-prescriber':
      rx.prescriber = null;
      break;
    case 'unavailable-strength': {
      const idx = rx.items.findIndex((i) => UNAVAILABLE_STRENGTHS[i.medicineId]);
      if (idx < 0) {
        rx.hiddenIssue = 'missing-instructions';
        rx.items[0].instructions = '';
      } else {
        const it = rx.items[idx];
        it.strength = UNAVAILABLE_STRENGTHS[it.medicineId];
        it.writtenName = it.writtenName.replace(/\d+([.,]\d+)?\s*mg/, it.strength);
      }
      break;
    }
    case 'iter-exhausted':
      rx.iterRemaining = 0;
      break;
  }
}

function patientOf(s: GameState, rx: Prescription) {
  return s.patients.find((p) => p.id === rx.patientId);
}

function penalizeWait(s: GameState, rx: Prescription, amount: number) {
  const p = patientOf(s, rx);
  if (p && !p.scripted) p.patience = Math.max(1, p.patience - amount);
}

/**
 * Pemain melaporkan masalah kelengkapan resep.
 * Benar → dihitung sebagai temuan; salah → pasien menunggu lebih lama.
 */
export function reportIssue(s: GameState, rxId: string, kind: PrescriptionIssueKind): Result<{ correct: boolean; resolvable: boolean }> {
  const rx = findPrescription(s, rxId);
  if (!rx) return fail('Resep tidak ditemukan.');
  if (rx.status === 'dispensed' || rx.status === 'rejected') return fail('Resep sudah diproses.');
  if (rx.hiddenIssue && !rx.issueResolved && rx.hiddenIssue === kind) {
    rx.status = 'on-hold';
    s.stats.issuesDetected += 1;
    addXp(s, 15);
    const resolvable = RESOLVABLE_ISSUES.includes(kind);
    notify(s, 'success', resolvable ? `Masalah ditemukan: ${ISSUE_LABELS[kind]}. Lakukan konfirmasi ke penulis resep.` : `Masalah ditemukan: ${ISSUE_LABELS[kind]}. Resep tidak dapat dilayani — tolak dengan penjelasan.`);
    return ok({ correct: true, resolvable });
  }
  penalizeWait(s, rx, 8);
  addReputation(s, -0.5);
  notify(s, 'warning', `Laporan "${ISSUE_LABELS[kind]}" tidak tepat untuk resep ini.`);
  return ok({ correct: false, resolvable: false });
}

/** Konfirmasi ke penulis resep (simulasi): menyelesaikan masalah yang dapat diselesaikan. */
export function confirmWithPrescriber(s: GameState, rxId: string): Result<Prescription> {
  const rx = findPrescription(s, rxId);
  if (!rx) return fail('Resep tidak ditemukan.');
  if (rx.status !== 'on-hold' || !rx.hiddenIssue) return fail('Tidak ada masalah yang menunggu konfirmasi.');
  if (!RESOLVABLE_ISSUES.includes(rx.hiddenIssue)) return fail('Masalah ini tidak dapat diselesaikan dengan konfirmasi.');
  switch (rx.hiddenIssue) {
    case 'missing-instructions': {
      const tpl = RX_TEMPLATES.flatMap((t) => t.items).find((i) => i.medicineId === rx.items[0].medicineId);
      rx.items[0].instructions = tpl?.instructions ?? 'Sesuai petunjuk dokter';
      break;
    }
    case 'missing-patient-age': {
      rx.patientAge = patientOf(s, rx)?.age ?? 30;
      break;
    }
    case 'unavailable-strength': {
      for (const it of rx.items) {
        const med = medicineById(s, it.medicineId);
        if (med && it.strength !== med.strength) {
          it.strength = med.strength;
          it.writtenName = `${med.name} (disesuaikan setelah konfirmasi)`;
        }
      }
      break;
    }
  }
  rx.issueResolved = true;
  rx.status = 'in-review';
  penalizeWait(s, rx, 10);
  notify(s, 'info', 'Penulis resep telah mengonfirmasi (simulasi). Resep dapat dilanjutkan.');
  return ok(rx);
}

/** Menolak resep. Benar jika resep memang tidak dapat dilayani. */
export function rejectPrescription(s: GameState, rxId: string): Result<{ correct: boolean }> {
  const rx = findPrescription(s, rxId);
  if (!rx) return fail('Resep tidak ditemukan.');
  if (rx.status === 'dispensed' || rx.status === 'rejected') return fail('Resep sudah diproses.');
  const correct = !!rx.hiddenIssue && !RESOLVABLE_ISSUES.includes(rx.hiddenIssue);
  rx.status = 'rejected';
  s.stats.prescriptionsRejected += 1;
  const p = patientOf(s, rx);
  if (correct) {
    addXp(s, XP.prescription);
    addReputation(s, 0.5);
    notify(s, 'success', 'Penolakan tepat: resep tidak memenuhi syarat untuk dilayani (simulasi).');
  } else {
    addReputation(s, -2);
    s.stats.dispenseErrors += 1;
    notify(s, 'error', 'Resep sebenarnya dapat dilayani. Penolakan yang tidak perlu menurunkan reputasi.');
  }
  if (p) finishPatient(s, p, 'rejected');
  return ok({ correct });
}

/**
 * Validasi penyiapan resep. Mengembalikan daftar masalah yang mudah dipahami beserta tindakan
 * yang dapat dilakukan pemain. Tidak mengubah state.
 */
export function validateDispense(s: GameState, draft: DispenseDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rx = findPrescription(s, draft.prescriptionId);
  if (!rx) return [{ code: 'no-rx', severity: 'error', message: 'Resep tidak ditemukan.', action: 'Tutup dan terima resep kembali.' }];
  if (rx.status === 'dispensed' || rx.status === 'rejected') {
    return [{ code: 'processed', severity: 'error', message: 'Resep sudah diproses.', action: 'Tidak ada tindakan.' }];
  }
  const day = today(s);

  if (!draft.completenessChecked) {
    issues.push({ code: 'no-check', severity: 'error', message: 'Pemeriksaan kelengkapan resep belum dilakukan.', action: 'Lengkapi daftar periksa kelengkapan pada langkah 2.' });
  }
  if (rx.hiddenIssue && !rx.issueResolved) {
    issues.push({
      code: 'unresolved-issue',
      severity: 'error',
      message: 'Resep memiliki masalah kelengkapan/keabsahan yang belum ditangani.',
      action: 'Periksa kembali resep, laporkan masalahnya, lalu konfirmasi atau tolak.',
    });
  }

  rx.items.forEach((item, idx) => {
    const lines = draft.lines.filter((l) => l.itemIndex === idx);
    if (lines.length === 0) {
      issues.push({ code: 'missing-item', severity: 'error', message: `Item ${idx + 1} (${item.writtenName}) belum disiapkan.`, action: 'Pilih produk dan batch untuk item ini.', itemIndex: idx });
      return;
    }
    const line = lines[0];
    const med = medicineById(s, line.medicineId);
    const expected = medicineById(s, item.medicineId);
    if (!med) {
      issues.push({ code: 'unknown-med', severity: 'error', message: `Produk untuk item ${idx + 1} tidak dikenal.`, action: 'Pilih produk dari katalog.', itemIndex: idx });
      return;
    }
    if (line.medicineId !== item.medicineId) {
      let why = 'produk berbeda';
      if (expected && med.genericName === expected.genericName && med.strength !== expected.strength) why = `kekuatan berbeda (${med.strength} vs ${item.strength})`;
      else if (expected && med.genericName === expected.genericName && med.form !== expected.form) why = `bentuk sediaan berbeda (${med.form} vs ${item.form})`;
      issues.push({
        code: 'wrong-medicine',
        severity: 'error',
        message: `Item ${idx + 1}: diresepkan "${item.writtenName}", disiapkan "${med.name}" — ${why}.`,
        action: 'Ganti dengan produk yang sesuai nama, kekuatan, dan bentuk sediaan pada resep.',
        itemIndex: idx,
      });
    }
    const totalQty = lines.reduce((a, l) => a + l.qty, 0);
    if (totalQty !== item.qty) {
      issues.push({
        code: 'wrong-qty',
        severity: 'error',
        message: `Item ${idx + 1}: jumlah ${totalQty}, seharusnya ${item.qty} ${expected?.unit ?? ''}.`,
        action: 'Sesuaikan jumlah dengan resep.',
        itemIndex: idx,
      });
    }
    for (const l of lines) {
      const b = s.batches.find((x) => x.id === l.batchId);
      if (!b || b.medicineId !== l.medicineId) {
        issues.push({ code: 'no-batch', severity: 'error', message: `Item ${idx + 1}: batch belum dipilih atau tidak sesuai produk.`, action: 'Pilih batch dari rak.', itemIndex: idx });
        continue;
      }
      if (b.location !== 'shelf') {
        issues.push({ code: 'batch-location', severity: 'error', message: `Item ${idx + 1}: batch ${b.batchNo} berada di gudang.`, action: 'Pindahkan stok ke rak terlebih dahulu.', itemIndex: idx });
      }
      if (b.status !== 'active' || isExpired(b, day)) {
        issues.push({ code: 'expired-batch', severity: 'error', message: `Item ${idx + 1}: batch ${b.batchNo} kedaluwarsa/tidak aktif dan tidak boleh diserahkan.`, action: 'Pilih batch lain yang masih layak dan musnahkan batch kedaluwarsa.', itemIndex: idx });
      } else if (b.qty < l.qty) {
        issues.push({ code: 'insufficient', severity: 'error', message: `Item ${idx + 1}: stok batch ${b.batchNo} hanya ${b.qty}.`, action: 'Pilih batch lain atau isi ulang rak.', itemIndex: idx });
      } else {
        const earlier = usableBatches(s, l.medicineId, 'shelf').find((x) => x.expiryDay < b.expiryDay && x.qty >= l.qty);
        if (earlier) {
          issues.push({
            code: 'fefo',
            severity: 'warning',
            message: `Item ${idx + 1}: batch ${earlier.batchNo} kedaluwarsa lebih dulu (${earlier.expiryDay - day} hari) daripada ${b.batchNo}.`,
            action: 'Terapkan FEFO: gunakan batch yang kedaluwarsa paling dekat.',
            itemIndex: idx,
          });
        }
      }
    }
    if (!line.instructions.trim()) {
      issues.push({ code: 'no-instructions', severity: 'error', message: `Item ${idx + 1}: aturan pakai pada etiket kosong.`, action: 'Pilih aturan pakai sesuai resep.', itemIndex: idx });
    } else if (item.instructions && line.instructions.trim() !== item.instructions.trim()) {
      issues.push({ code: 'wrong-instructions', severity: 'error', message: `Item ${idx + 1}: aturan pakai etiket tidak sesuai resep.`, action: `Resep menulis: "${item.instructions}".`, itemIndex: idx });
    }
    if (med.refrigerated) {
      issues.push({ code: 'cold-chain', severity: 'info', message: `${med.name} adalah produk rantai dingin.`, action: 'Serahkan dengan kemasan pendingin dan informasikan cara penyimpanan (simulasi).', itemIndex: idx });
    }
  });

  const extra = draft.lines.filter((l) => l.itemIndex < 0 || l.itemIndex >= rx.items.length);
  if (extra.length) issues.push({ code: 'extra-item', severity: 'error', message: 'Ada item yang tidak tercantum di resep.', action: 'Hapus item tambahan.' });
  if (!draft.labelPrepared) issues.push({ code: 'no-label', severity: 'error', message: 'Etiket belum disiapkan.', action: 'Buat dan periksa pratinjau etiket.' });
  return issues;
}

export function scoreFromIssues(issues: ValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  return Math.max(0, 100 - errors * 25 - warnings * 10);
}

/** Draft awal berbasis rekomendasi FEFO (dipakai pegawai & sebagai bantuan pada Learning Mode). */
export function autoDraft(s: GameState, rxId: string): DispenseDraft | null {
  const rx = findPrescription(s, rxId);
  if (!rx) return null;
  return {
    prescriptionId: rx.id,
    completenessChecked: true,
    labelPrepared: true,
    reportedIssue: rx.hiddenIssue ?? 'none',
    lines: rx.items.map((it, idx) => ({
      itemIndex: idx,
      medicineId: it.medicineId,
      batchId: recommendBatch(s, it.medicineId, it.qty).batch?.id ?? '',
      qty: it.qty,
      instructions: it.instructions,
    })),
  };
}

/**
 * Menyerahkan obat resep. Jika validasi menemukan error, tidak ada perubahan stok dan
 * pemain mendapat penalti kecil. Idempoten terhadap klik berulang.
 */
export function dispensePrescription(
  s: GameState,
  draft: DispenseDraft,
  handledBy = 'player',
): Result<{ issues: ValidationIssue[]; score: number; saleId?: string }> {
  const rx = findPrescription(s, draft.prescriptionId);
  if (!rx) return fail('Resep tidak ditemukan.');
  if (rx.status === 'dispensed') return fail('Resep sudah diserahkan sebelumnya.');
  if (rx.status === 'rejected') return fail('Resep sudah ditolak.');
  const issues = validateDispense(s, draft);
  const errors = issues.filter((i) => i.severity === 'error');
  const patient = patientOf(s, rx);
  if (errors.length > 0) {
    s.stats.dispenseErrors += 1;
    if (patient) {
      patient.wrongAttempts += 1;
      if (!patient.scripted) patient.patience = Math.max(1, patient.patience - 6);
    }
    return ok({ issues, score: scoreFromIssues(issues) }, 'Validasi menemukan kesalahan. Perbaiki sebelum menyerahkan obat.');
  }

  const sale = openSale(s, { patientId: rx.patientId, source: 'prescription', handledBy, refId: rx.id });
  sale.items = [];
  for (const l of draft.lines) {
    const b = s.batches.find((x) => x.id === l.batchId)!;
    const r = consumeBatch(s, l.batchId, l.qty, 'dispense', `Resep ${rx.id}`, rx.id);
    if (!r.ok) return r;
    const med = medicineById(s, l.medicineId)!;
    const line = sale.items.find((i) => i.medicineId === l.medicineId);
    if (line) {
      line.qty += l.qty;
      line.allocations.push({ batchId: b.id, qty: l.qty, unitCost: b.unitCost });
    } else {
      sale.items.push({ medicineId: l.medicineId, qty: l.qty, unitPrice: med.sellPrice, allocations: [{ batchId: b.id, qty: l.qty, unitCost: b.unitCost }] });
    }
  }
  sale.items.push({ medicineId: 'fee:rx', qty: 1, unitPrice: ECONOMY.prescriptionServiceFee, allocations: [] });
  sale.stockCommitted = true;
  recalcSale(sale);

  const fefo = issues.filter((i) => i.code === 'fefo').length;
  s.stats.fefoViolations += fefo;
  const score = scoreFromIssues(issues);
  rx.status = 'dispensed';
  rx.dispensedAt = s.time.now;
  rx.saleId = sale.id;
  rx.score = score;
  s.stats.prescriptionsDispensed += 1;
  if (rx.isRefill) s.stats.refillsDispensed += 1;
  if (score === 100 && (patient?.wrongAttempts ?? 0) === 0) {
    s.stats.perfectPrescriptions += 1;
    addXp(s, XP.perfectPrescription);
  }
  addXp(s, XP.prescription);
  emit(s, { type: 'prescription-dispensed', refId: rx.id });

  if (patient) {
    patient.status = 'checkout';
    if (s.activePatientId === patient.id) s.activePatientId = null;
    if (patient.money < sale.total) patient.money = sale.total + 10_000; // pasien resep membawa dana cukup
  }
  return ok({ issues, score, saleId: sale.id }, fefo ? 'Obat diserahkan, tetapi FEFO tidak diterapkan.' : 'Obat diserahkan. Pasien menuju kasir.');
}

/** Dipakai ketika pasien resep pergi sebelum dilayani. */
export function abandonPrescription(s: GameState, rxId: string) {
  const rx = findPrescription(s, rxId);
  if (rx && rx.status !== 'dispensed' && rx.status !== 'rejected') rx.status = 'rejected';
}

/**
 * Pemeriksaan ulang sebelum penyerahan. Di luar Learning Mode, pemeriksaan memakan waktu
 * (kesabaran pasien berkurang sedikit) agar ketelitian tetap bernilai.
 */
export function precheckDispense(s: GameState, draft: DispenseDraft): ValidationIssue[] {
  const rx = findPrescription(s, draft.prescriptionId);
  if (rx && s.mode !== 'learning') penalizeWait(s, rx, 3);
  return validateDispense(s, draft);
}
