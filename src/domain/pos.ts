import { XP } from './config';
import { addLedger, emit, fail, medicineById, notify, ok, today, type Result } from './core';
import { nextId } from './ids';
import { consumeBatch, returnToBatch, selectFEFO, stockOf, usableBatches } from './inventory';
import { addReputation, addXp, finishPatient } from './progression';
import type { GameState, PaymentMethod, SaleSource, SaleTransaction } from './types';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = { cash: 'Tunai', card: 'Kartu', digital: 'Pembayaran Digital' };

/** Promo sederhana: potongan 5% untuk belanja obat bebas ≥ Rp100.000. */
export const PROMO = { threshold: 100_000, rate: 0.05, label: 'Promo belanja ≥ Rp100.000 (5%)' };

export function recalcSale(sale: SaleTransaction) {
  sale.subtotal = sale.items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
  sale.discount = sale.source === 'pos' && sale.subtotal >= PROMO.threshold ? Math.round(sale.subtotal * PROMO.rate) : 0;
  sale.total = sale.subtotal - sale.discount;
}

export function findSale(s: GameState, id: string) {
  return s.sales.find((x) => x.id === id);
}

export function openSale(s: GameState, input: { patientId?: string; source: SaleSource; handledBy?: string; refId?: string }): SaleTransaction {
  if (input.patientId) {
    const existing = s.sales.find((x) => x.patientId === input.patientId && x.status === 'open');
    if (existing) return existing;
  }
  const sale: SaleTransaction = {
    id: nextId(s, 'TRX'),
    patientId: input.patientId,
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    method: null,
    status: 'open',
    source: input.source,
    createdAt: s.time.now,
    cogs: 0,
    handledBy: input.handledBy ?? 'player',
    refId: input.refId,
    stockCommitted: false,
  };
  s.sales.push(sale);
  if (input.patientId) {
    const p = s.patients.find((x) => x.id === input.patientId);
    if (p) p.saleId = sale.id;
  }
  return sale;
}

/** Menambah produk ke transaksi kasir (obat bebas). */
export function addSaleItem(s: GameState, saleId: string, medicineId: string, qty = 1): Result<SaleTransaction> {
  const sale = findSale(s, saleId);
  if (!sale || sale.status !== 'open') return fail('Transaksi tidak aktif.');
  if (sale.stockCommitted) return fail('Transaksi resep/racikan tidak dapat diubah di kasir.');
  const med = medicineById(s, medicineId);
  if (!med || !med.active) return fail('Produk tidak ditemukan atau tidak aktif.');
  if (med.category === 'bahan-racik') return fail('Bahan racik tidak dijual langsung.');
  if (med.prescriptionOnly) return fail(`${med.name} hanya dapat diserahkan melalui pelayanan resep.`);
  if (!Number.isInteger(qty) || qty <= 0) return fail('Jumlah harus bilangan bulat positif.');
  const line = sale.items.find((i) => i.medicineId === medicineId);
  const newQty = (line?.qty ?? 0) + qty;
  const available = stockOf(s, medicineId, 'shelf');
  if (newQty > available) return fail(`Stok ${med.name} di rak tidak cukup (tersedia ${available}).`);
  if (line) line.qty = newQty;
  else sale.items.push({ medicineId, qty, unitPrice: med.sellPrice, allocations: [] });
  recalcSale(sale);
  return ok(sale);
}

export function setSaleItemQty(s: GameState, saleId: string, medicineId: string, qty: number): Result<SaleTransaction> {
  const sale = findSale(s, saleId);
  if (!sale || sale.status !== 'open') return fail('Transaksi tidak aktif.');
  if (sale.stockCommitted) return fail('Transaksi resep/racikan tidak dapat diubah di kasir.');
  const line = sale.items.find((i) => i.medicineId === medicineId);
  if (!line) return fail('Item tidak ada di transaksi.');
  if (qty <= 0) return removeSaleItem(s, saleId, medicineId);
  if (!Number.isInteger(qty)) return fail('Jumlah harus bilangan bulat.');
  const available = stockOf(s, medicineId, 'shelf');
  if (qty > available) return fail(`Stok rak tidak cukup (tersedia ${available}).`);
  line.qty = qty;
  recalcSale(sale);
  return ok(sale);
}

export function removeSaleItem(s: GameState, saleId: string, medicineId: string): Result<SaleTransaction> {
  const sale = findSale(s, saleId);
  if (!sale || sale.status !== 'open') return fail('Transaksi tidak aktif.');
  if (sale.stockCommitted) return fail('Transaksi resep/racikan tidak dapat diubah di kasir.');
  sale.items = sale.items.filter((i) => i.medicineId !== medicineId);
  recalcSale(sale);
  return ok(sale);
}

/**
 * Menyelesaikan pembayaran. Idempoten: transaksi yang sudah selesai/dibatalkan ditolak,
 * sehingga stok dan uang tidak pernah diproses dua kali.
 */
export function completeSale(s: GameState, saleId: string, method: PaymentMethod, handledBy = 'player'): Result<SaleTransaction> {
  const sale = findSale(s, saleId);
  if (!sale) return fail('Transaksi tidak ditemukan.');
  if (sale.status !== 'open') return fail('Transaksi sudah diproses sebelumnya.');
  if (sale.items.length === 0) return fail('Transaksi masih kosong.');
  const patient = sale.patientId ? s.patients.find((p) => p.id === sale.patientId) : undefined;
  if (patient?.cancelRequested) return fail(`${patient.name} ingin membatalkan pembelian. Batalkan transaksi.`);
  if (patient && patient.money < sale.total) return fail(`Uang ${patient.name} tidak cukup (${patient.money.toLocaleString('id-ID')}). Kurangi item.`);

  if (!sale.stockCommitted) {
    // Validasi seluruh item terlebih dahulu agar tidak ada pengurangan stok parsial.
    const day = today(s);
    const plans = sale.items.map((item) => ({ item, plan: selectFEFO(usableBatches(s, item.medicineId, 'shelf'), item.qty, day) }));
    const short = plans.find((p) => p.plan.shortage > 0);
    if (short) return fail(`Stok ${medicineById(s, short.item.medicineId)?.name} di rak tidak cukup.`);
    for (const { item, plan } of plans) {
      item.allocations = [];
      for (const a of plan.allocations) {
        const b = s.batches.find((x) => x.id === a.batchId)!;
        consumeBatch(s, a.batchId, a.qty, 'sale', `Penjualan ${sale.id}`, sale.id);
        item.allocations.push({ batchId: a.batchId, qty: a.qty, unitCost: b.unitCost });
      }
    }
  }
  sale.cogs = sale.items.reduce((a, i) => a + i.allocations.reduce((x, al) => x + al.qty * al.unitCost, 0), 0);
  sale.method = method;
  sale.status = 'completed';
  sale.completedAt = s.time.now;
  sale.handledBy = handledBy;

  const serviceFee = sale.items.filter((i) => i.medicineId.startsWith('fee:')).reduce((a, i) => a + i.qty * i.unitPrice, 0);
  const goods = sale.total - serviceFee;
  addLedger(s, 'sales', goods, `Penjualan ${sale.id} (${PAYMENT_LABELS[method]})`, sale.id);
  if (serviceFee > 0) addLedger(s, 'service-fee', serviceFee, `Jasa pelayanan ${sale.id}`, sale.id);
  s.stats.salesCompleted += 1;
  addXp(s, XP.sale);
  emit(s, { type: 'sale-completed', refId: sale.id });

  if (patient) {
    patient.money -= sale.total;
    finishPatient(s, patient, 'served', sale.total);
  }
  return ok(sale);
}

/**
 * Membatalkan transaksi yang belum dibayar. Stok yang sudah disiapkan (resep/racikan)
 * dikembalikan ke batch asal.
 */
export function cancelSale(s: GameState, saleId: string, reason = 'Dibatalkan', opts: { skipPatient?: boolean } = {}): Result<SaleTransaction> {
  const sale = findSale(s, saleId);
  if (!sale) return fail('Transaksi tidak ditemukan.');
  if (sale.status !== 'open') return fail('Hanya transaksi yang belum dibayar yang dapat dibatalkan.');
  if (sale.stockCommitted) {
    for (const item of sale.items) {
      for (const a of item.allocations) returnToBatch(s, a.batchId, a.qty, `Retur pembatalan ${sale.id}`, sale.id);
    }
  }
  sale.status = 'cancelled';
  sale.completedAt = s.time.now;
  s.stats.salesCancelled += 1;
  emit(s, { type: 'sale-cancelled', refId: sale.id });

  const patient = sale.patientId ? s.patients.find((p) => p.id === sale.patientId) : undefined;
  if (patient && !opts.skipPatient && patient.status !== 'done' && patient.status !== 'left') {
    if (patient.cancelRequested) {
      // Pembatalan ditangani dengan benar: pasien pergi tanpa kecewa.
      addXp(s, XP.inquiry);
      notify(s, 'info', `Transaksi ${patient.name} dibatalkan dengan baik.`);
      finishPatient(s, patient, 'cancelled');
    } else {
      addReputation(s, -1);
      notify(s, 'warning', `${reason}: ${patient.name} pergi tanpa membeli.`);
      finishPatient(s, patient, 'cancelled');
    }
  }
  return ok(sale);
}

/** Kembalian pembayaran tunai (untuk tampilan kasir). */
export function cashChange(total: number, paid: number) {
  return paid - total;
}
