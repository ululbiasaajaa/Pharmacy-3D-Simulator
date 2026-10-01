import { ECONOMY, XP } from './config';
import { addLedger, challengeMods, emit, fail, getEffects, medicineById, notify, ok, today, type Result } from './core';
import { nextId } from './ids';
import { freeVolume, receiveBatch, stockOf } from './inventory';
import { addXp } from './progression';
import { chance, randInt } from './rng';
import type { GameState, PurchaseOrder, PurchaseOrderStatus, Supplier } from './types';

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Dipesan',
  processing: 'Diproses',
  shipping: 'Dalam perjalanan',
  arrived: 'Tiba',
  received: 'Diterima',
  cancelled: 'Dibatalkan',
};

export function findOrder(s: GameState, id: string) {
  return s.purchaseOrders.find((o) => o.id === id);
}

export function findSupplier(s: GameState, id: string) {
  return s.suppliers.find((x) => x.id === id);
}

/** Pengali harga pemasok (event kenaikan harga, status mitra). */
export function supplierPriceMult(s: GameState, sup: Supplier) {
  let m = 1;
  const inc = s.activeEvents.find((e) => e.kind === 'price-increase');
  if (inc) m *= 1 + inc.magnitude;
  if (sup.relationship === 'mitra') m *= 0.97;
  return m;
}

export function supplierUnitCost(s: GameState, sup: Supplier, medicineId: string): number | null {
  const p = sup.products.find((x) => x.medicineId === medicineId);
  if (!p) return null;
  return Math.round(p.unitCost * supplierPriceMult(s, sup));
}

/** Estimasi waktu kirim (menit) dengan pengaruh komputer & tantangan. */
export function leadTimeMinutes(s: GameState, sup: Supplier) {
  const e = getEffects(s);
  const computer = Math.max(0.4, 1 - 0.15 * e.computerLevel);
  const mods = challengeMods(s);
  return Math.round(sup.leadTimeHours * 60 * computer * (mods.leadTimeMult ?? 1));
}

export function createDraftOrder(s: GameState, supplierId: string): Result<PurchaseOrder> {
  const sup = findSupplier(s, supplierId);
  if (!sup) return fail('Pemasok tidak ditemukan.');
  const existing = s.purchaseOrders.find((o) => o.supplierId === supplierId && o.status === 'draft');
  if (existing) return ok(existing);
  const po: PurchaseOrder = { id: nextId(s, 'PO'), supplierId, items: [], status: 'draft', createdAt: s.time.now, total: 0 };
  s.purchaseOrders.push(po);
  return ok(po);
}

function recalcOrder(s: GameState, po: PurchaseOrder) {
  const sup = findSupplier(s, po.supplierId)!;
  for (const it of po.items) it.unitCost = supplierUnitCost(s, sup, it.medicineId) ?? it.unitCost;
  po.total = po.items.reduce((a, i) => a + i.qty * i.unitCost, 0);
}

export function setOrderItem(s: GameState, poId: string, medicineId: string, qty: number): Result<PurchaseOrder> {
  const po = findOrder(s, poId);
  if (!po || po.status !== 'draft') return fail('Hanya pesanan draft yang dapat diubah.');
  const sup = findSupplier(s, po.supplierId)!;
  const cost = supplierUnitCost(s, sup, medicineId);
  if (cost === null) return fail('Pemasok ini tidak menjual produk tersebut.');
  if (!Number.isInteger(qty) || qty < 0) return fail('Jumlah harus bilangan bulat ≥ 0.');
  if (qty > 5000) return fail('Jumlah terlalu besar untuk satu pesanan.');
  const line = po.items.find((i) => i.medicineId === medicineId);
  if (qty === 0) po.items = po.items.filter((i) => i.medicineId !== medicineId);
  else if (line) line.qty = qty;
  else po.items.push({ medicineId, qty, unitCost: cost });
  recalcOrder(s, po);
  return ok(po);
}

/** Konfirmasi pesanan: uang dibayar di muka, ETA ditentukan oleh pemasok & event. */
export function placeOrder(s: GameState, poId: string): Result<PurchaseOrder> {
  const po = findOrder(s, poId);
  if (!po) return fail('Pesanan tidak ditemukan.');
  if (po.status !== 'draft') return fail('Pesanan sudah dikonfirmasi sebelumnya.');
  if (po.items.length === 0) return fail('Pesanan masih kosong.');
  const sup = findSupplier(s, po.supplierId)!;
  recalcOrder(s, po);
  if (po.total < sup.minOrder) return fail(`Minimal pemesanan ke ${sup.name} adalah Rp ${sup.minOrder.toLocaleString('id-ID')}.`);
  if (po.total > s.money) return fail('Uang tidak cukup untuk pesanan ini.');
  const volume = po.items.reduce((a, i) => a + i.qty * (medicineById(s, i.medicineId)?.volume ?? 1), 0);
  const incoming = s.purchaseOrders
    .filter((o) => ['ordered', 'processing', 'shipping', 'arrived'].includes(o.status))
    .reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty * (medicineById(s, i.medicineId)?.volume ?? 1), 0), 0);
  if (volume + incoming > freeVolume(s, 'warehouse') * 1.5) {
    return fail('Volume pesanan jauh melebihi ruang gudang yang tersedia. Kurangi jumlah atau tambah kapasitas.');
  }
  let lead = leadTimeMinutes(s, sup);
  if (!chance(s, sup.reliability)) {
    lead = Math.round(lead * (1.25 + randInt(s, 0, 75) / 100));
    po.delayed = true;
  }
  const delay = s.activeEvents.find((e) => e.kind === 'delivery-delay');
  if (delay) {
    lead += delay.magnitude;
    po.delayed = true;
  }
  po.status = 'ordered';
  po.orderedAt = s.time.now;
  po.eta = s.time.now + lead;
  addLedger(s, 'stock-purchase', -po.total, `Pembelian ${po.id} ke ${sup.name}`, po.id);
  s.stats.ordersPlaced += 1;
  emit(s, { type: 'order-placed', refId: po.id });
  return ok(po, `Pesanan dikonfirmasi. Estimasi tiba dalam ${Math.round(lead / 60)} jam.`);
}

/** Pembatalan hanya sebelum barang dikirim; dana dikembalikan penuh. */
export function cancelOrder(s: GameState, poId: string): Result<PurchaseOrder> {
  const po = findOrder(s, poId);
  if (!po) return fail('Pesanan tidak ditemukan.');
  if (po.status === 'draft') {
    po.status = 'cancelled';
    return ok(po);
  }
  if (po.status !== 'ordered' && po.status !== 'processing') return fail('Pesanan yang sudah dikirim tidak dapat dibatalkan.');
  po.status = 'cancelled';
  addLedger(s, 'refund', Math.round(po.total * ECONOMY.cancelOrderRefundRate), `Refund pembatalan ${po.id}`, po.id);
  const sup = findSupplier(s, po.supplierId);
  if (sup) sup.reputation = Math.max(0, sup.reputation - 2);
  return ok(po);
}

/** Memajukan status pengiriman berdasarkan waktu. */
export function progressOrders(s: GameState) {
  for (const po of s.purchaseOrders) {
    if (!po.eta || !po.orderedAt) continue;
    if (po.status !== 'ordered' && po.status !== 'processing' && po.status !== 'shipping') continue;
    const span = Math.max(1, po.eta - po.orderedAt);
    const frac = (s.time.now - po.orderedAt) / span;
    let next: PurchaseOrderStatus = po.status;
    if (frac >= 1) next = 'arrived';
    else if (frac >= 0.4) next = 'shipping';
    else if (frac >= 0.15) next = 'processing';
    if (next !== po.status) {
      po.status = next;
      if (next === 'arrived') {
        po.arrivedAt = s.time.now;
        const sup = findSupplier(s, po.supplierId);
        notify(s, 'success', `Pesanan ${po.id} dari ${sup?.name ?? 'pemasok'} telah tiba. Terima barang di Lemari Gudang/Komputer.`);
        emit(s, { type: 'order-arrived', refId: po.id });
      }
    }
  }
}

/** Menerima barang yang telah tiba ke gudang (membuat batch baru). */
export function receiveOrder(s: GameState, poId: string, by = 'player'): Result<PurchaseOrder> {
  const po = findOrder(s, poId);
  if (!po) return fail('Pesanan tidak ditemukan.');
  if (po.status === 'received') return fail('Pesanan sudah diterima sebelumnya.');
  if (po.status !== 'arrived') return fail('Barang belum tiba.');
  const sup = findSupplier(s, po.supplierId)!;
  const volume = po.items.reduce((a, i) => a + i.qty * (medicineById(s, i.medicineId)?.volume ?? 1), 0);
  if (volume > freeVolume(s, 'warehouse')) return fail('Gudang tidak memiliki ruang cukup. Pindahkan stok ke rak atau musnahkan stok rusak/kedaluwarsa.');
  const mods = challengeMods(s);
  for (const it of po.items) {
    const life = randInt(s, sup.shelfLifeDays[0], sup.shelfLifeDays[1]);
    const r = receiveBatch(s, {
      medicineId: it.medicineId,
      qty: it.qty,
      expiryDay: today(s) + (mods.nearExpiry ? Math.min(life, 60) : life),
      unitCost: it.unitCost,
      location: 'warehouse',
      note: `Penerimaan ${po.id}`,
      refId: po.id,
      skipCapacity: true,
    });
    if (!r.ok) return r;
  }
  po.status = 'received';
  po.receivedAt = s.time.now;
  po.receivedBy = by;
  s.stats.ordersReceived += 1;
  sup.ordersCompleted += 1;
  sup.reputation = Math.min(100, sup.reputation + 1);
  if (sup.ordersCompleted >= 10) sup.relationship = 'mitra';
  else if (sup.ordersCompleted >= 3) sup.relationship = 'baik';
  addXp(s, XP.orderReceived);
  emit(s, { type: 'order-received', refId: po.id });
  return ok(po);
}

export interface Recommendation {
  medicineId: string;
  current: number;
  incoming: number;
  dailyDemand: number;
  suggestedQty: number;
  supplierId: string | null;
  reason: string;
}

/** Perkiraan permintaan harian dari transaksi 3 hari terakhir. */
export function dailyDemand(s: GameState, medicineId: string) {
  const since = s.time.now - 3 * 1440;
  const used = s.inventoryTx
    .filter((t) => t.medicineId === medicineId && t.at >= since && (t.type === 'sale' || t.type === 'dispense' || t.type === 'compounding'))
    .reduce((a, t) => a - t.qtyDelta, 0);
  const days = Math.min(3, Math.max(1, s.stats.daysCompleted || 1));
  return used / days;
}

export function incomingQty(s: GameState, medicineId: string) {
  return s.purchaseOrders
    .filter((o) => ['ordered', 'processing', 'shipping', 'arrived'].includes(o.status))
    .reduce((a, o) => a + o.items.filter((i) => i.medicineId === medicineId).reduce((x, i) => x + i.qty, 0), 0);
}

/** Rekomendasi pengadaan berbasis aturan sederhana (stok, permintaan, waktu kirim, harga). */
export function procurementRecommendations(s: GameState): Recommendation[] {
  const out: Recommendation[] = [];
  for (const m of s.medicines.filter((x) => x.active)) {
    const current = stockOf(s, m.id, 'any');
    const incoming = incomingQty(s, m.id);
    const demand = Math.max(dailyDemand(s, m.id), m.minStock / 4);
    const candidates = s.suppliers
      .map((sup) => ({ sup, cost: supplierUnitCost(s, sup, m.id) }))
      .filter((c): c is { sup: Supplier; cost: number } => c.cost !== null);
    if (!candidates.length) continue;
    // Skor: harga + penalti waktu kirim bila stok kritis.
    const urgent = current < m.minStock / 2;
    candidates.sort((a, b) => {
      const la = leadTimeMinutes(s, a.sup) / 60;
      const lb = leadTimeMinutes(s, b.sup) / 60;
      return a.cost * (urgent ? 1 + la / 24 : 1) - b.cost * (urgent ? 1 + lb / 24 : 1);
    });
    const best = candidates[0];
    const leadDays = leadTimeMinutes(s, best.sup) / 1440;
    const reorderPoint = m.minStock + demand * leadDays;
    if (current + incoming >= reorderPoint) continue;
    const target = Math.max(m.minStock * 2, Math.ceil(demand * 5));
    const qty = Math.max(1, Math.ceil(target - current - incoming));
    out.push({
      medicineId: m.id,
      current,
      incoming,
      dailyDemand: Math.round(demand * 10) / 10,
      suggestedQty: qty,
      supplierId: best.sup.id,
      reason: `Stok ${current}${incoming ? ` (+${incoming} dalam perjalanan)` : ''} di bawah titik pesan ulang ${Math.ceil(reorderPoint)}. ${urgent ? 'Mendesak: memilih pemasok yang cepat & murah.' : 'Memilih pemasok dengan harga terbaik.'}`,
    });
  }
  return out.sort((a, b) => a.current - b.current);
}

/** Pemesanan otomatis oleh manajer: satu pesanan per pemasok untuk item yang direkomendasikan. */
export function autoReorder(s: GameState, by: string): number {
  const recs = procurementRecommendations(s).filter((r) => r.supplierId);
  const bySupplier = new Map<string, typeof recs>();
  for (const r of recs) bySupplier.set(r.supplierId!, [...(bySupplier.get(r.supplierId!) ?? []), r]);
  let placed = 0;
  for (const [supplierId, list] of bySupplier) {
    const reserve = 500_000;
    const draft = createDraftOrder(s, supplierId);
    if (!draft.ok || !draft.value) continue;
    for (const r of list) setOrderItem(s, draft.value.id, r.medicineId, r.suggestedQty);
    const sup = findSupplier(s, supplierId)!;
    if (draft.value.total < sup.minOrder || draft.value.total > s.money - reserve) {
      // Tidak memenuhi syarat — biarkan sebagai draft untuk ditinjau pemain.
      continue;
    }
    const r = placeOrder(s, draft.value.id);
    if (r.ok) {
      placed += 1;
      notify(s, 'info', `Manajer ${by} memesan ulang stok ke ${sup.name} (${draft.value.id}).`);
    }
  }
  return placed;
}

export function setAutoReorder(s: GameState, enabled: boolean): Result {
  if (enabled && !s.employees.some((e) => e.role === 'manager')) return fail('Pemesanan otomatis membutuhkan pegawai Manajer.');
  s.pharmacy.autoReorder = enabled;
  return ok();
}
