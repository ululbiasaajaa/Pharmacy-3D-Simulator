import { describe, expect, it } from 'vitest';
import { spawnPatient, callNextPatient } from '@/domain/patients';
import {
  autoDraft,
  confirmWithPrescriber,
  dispensePrescription,
  rejectPrescription,
  reportIssue,
  validateDispense,
} from '@/domain/prescriptions';
import { stockOf } from '@/domain/inventory';
import type { DispenseDraft } from '@/domain/types';
import { addBatch, clearStock, newState } from '../helpers';

function setupRx(issue: 'none' | 'missing-instructions' | 'missing-prescriber' = 'none') {
  const s = newState('career', { open: true });
  clearStock(s, 'amlo-5');
  const near = addBatch(s, 'amlo-5', 5, 10, 'shelf', 'NEAR');
  const far = addBatch(s, 'amlo-5', 5, 200, 'shelf', 'FAR');
  const p = spawnPatient(s, { category: 'prescription', templateId: 'rx-b', issue, scripted: true })!;
  callNextPatient(s, p.id);
  const rx = s.prescriptions.find((r) => r.id === p.prescriptionId)!;
  return { s, p, rx, near, far };
}

function draftFor(rxId: string, medicineId: string, batchId: string, qty: number, instructions: string): DispenseDraft {
  return {
    prescriptionId: rxId,
    completenessChecked: true,
    labelPrepared: true,
    reportedIssue: 'none',
    lines: [{ itemIndex: 0, medicineId, batchId, qty, instructions }],
  };
}

describe('Validasi resep', () => {
  it('draft FEFO yang benar tidak memiliki error', () => {
    const { s, rx } = setupRx();
    const d = autoDraft(s, rx.id)!;
    const issues = validateDispense(s, d);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('mendeteksi obat salah kekuatan, jumlah salah, dan aturan pakai salah', () => {
    const { s, rx } = setupRx();
    const b10 = addBatch(s, 'amlo-10', 5, 100);
    const d = draftFor(rx.id, 'amlo-10', b10.id, rx.items[0].qty + 1, 'asal');
    const codes = validateDispense(s, d).map((i) => i.code);
    expect(codes).toContain('wrong-medicine');
    expect(codes).toContain('wrong-qty');
    expect(codes).toContain('wrong-instructions');
    const wrong = validateDispense(s, d).find((i) => i.code === 'wrong-medicine')!;
    expect(wrong.message).toContain('kekuatan berbeda');
  });

  it('memberi peringatan FEFO bila memilih batch yang kedaluwarsa lebih lama', () => {
    const { s, rx, far } = setupRx();
    const d = draftFor(rx.id, 'amlo-5', far.id, rx.items[0].qty, rx.items[0].instructions);
    const issues = validateDispense(s, d);
    expect(issues.find((i) => i.code === 'fefo')?.severity).toBe('warning');
  });

  it('menolak batch kedaluwarsa', () => {
    const { s, rx } = setupRx();
    const exp = addBatch(s, 'amlo-5', 5, -1);
    const d = draftFor(rx.id, 'amlo-5', exp.id, rx.items[0].qty, rx.items[0].instructions);
    expect(validateDispense(s, d).map((i) => i.code)).toContain('expired-batch');
  });

  it('mewajibkan pemeriksaan kelengkapan dan etiket', () => {
    const { s, rx } = setupRx();
    const d = { ...autoDraft(s, rx.id)!, completenessChecked: false, labelPrepared: false };
    const codes = validateDispense(s, d).map((i) => i.code);
    expect(codes).toContain('no-check');
    expect(codes).toContain('no-label');
  });
});

describe('Penyerahan resep', () => {
  it('mengurangi stok batch terpilih, membuat transaksi, dan idempoten', () => {
    const { s, rx, near, p } = setupRx();
    const qty = rx.items[0].qty;
    const before = stockOf(s, 'amlo-5', 'shelf');
    const d = draftFor(rx.id, 'amlo-5', near.id, qty, rx.items[0].instructions);
    const r = dispensePrescription(s, d);
    expect(r.ok).toBe(true);
    expect(stockOf(s, 'amlo-5', 'shelf')).toBe(before - qty);
    expect(s.batches.find((b) => b.id === near.id)!.qty).toBe(5 - qty);
    expect(rx.status).toBe('dispensed');
    expect(p.status).toBe('checkout');
    const sale = s.sales.find((x) => x.id === rx.saleId)!;
    expect(sale.stockCommitted).toBe(true);
    expect(sale.items.some((i) => i.medicineId === 'fee:rx')).toBe(true);

    const again = dispensePrescription(s, d);
    expect(again.ok).toBe(false);
    expect(stockOf(s, 'amlo-5', 'shelf')).toBe(before - qty);
  });

  it('tidak mengubah stok bila validasi gagal dan mencatat kesalahan', () => {
    const { s, rx, near } = setupRx();
    const before = stockOf(s, 'amlo-5', 'shelf');
    const r = dispensePrescription(s, draftFor(rx.id, 'amlo-5', near.id, 99, 'x'));
    expect(r.ok).toBe(true);
    expect(r.ok && r.value!.issues.some((i) => i.severity === 'error')).toBe(true);
    expect(stockOf(s, 'amlo-5', 'shelf')).toBe(before);
    expect(s.stats.dispenseErrors).toBe(1);
    expect(rx.status).not.toBe('dispensed');
  });
});

describe('Masalah kelengkapan resep', () => {
  it('laporan benar + konfirmasi menyelesaikan masalah aturan pakai kosong', () => {
    const { s, rx } = setupRx('missing-instructions');
    expect(rx.items[0].instructions).toBe('');
    expect(validateDispense(s, autoDraft(s, rx.id)!).map((i) => i.code)).toContain('unresolved-issue');
    const r = reportIssue(s, rx.id, 'missing-instructions');
    expect(r.ok && r.value!.correct).toBe(true);
    expect(confirmWithPrescriber(s, rx.id).ok).toBe(true);
    expect(rx.items[0].instructions.length).toBeGreaterThan(0);
    expect(validateDispense(s, autoDraft(s, rx.id)!).filter((i) => i.severity === 'error')).toEqual([]);
    expect(s.stats.issuesDetected).toBe(1);
  });

  it('resep tanpa penulis harus ditolak; penolakan benar tidak menurunkan reputasi', () => {
    const { s, rx, p } = setupRx('missing-prescriber');
    const rep = s.progression.reputation;
    expect(confirmWithPrescriber(s, rx.id).ok).toBe(false);
    const r = rejectPrescription(s, rx.id);
    expect(r.ok && r.value!.correct).toBe(true);
    expect(s.progression.reputation).toBeGreaterThanOrEqual(rep);
    expect(p.status).toBe('left');
  });

  it('penolakan resep yang sah menurunkan reputasi', () => {
    const { s, rx } = setupRx('none');
    const rep = s.progression.reputation;
    const r = rejectPrescription(s, rx.id);
    expect(r.ok && r.value!.correct).toBe(false);
    expect(s.progression.reputation).toBeLessThan(rep);
  });
});
