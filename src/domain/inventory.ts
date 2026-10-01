import { TIME } from './config';
import { addLedger, emit, fail, getEffects, medicineById, notify, ok, today, type Result } from './core';
import { nextId } from './ids';
import { randInt } from './rng';
import type { GameState, InventoryTxType, MedicineBatch, StockLocation } from './types';

export const LOCATION_LABELS: Record<StockLocation, string> = { shelf: 'Rak Pelayanan', warehouse: 'Gudang' };

export const isExpired = (b: MedicineBatch, day: number) => b.expiryDay <= day;
export const daysToExpiry = (b: MedicineBatch, day: number) => b.expiryDay - day;
export const isNearExpiry = (b: MedicineBatch, day: number) =>
  !isExpired(b, day) && daysToExpiry(b, day) <= TIME.nearExpiryDays;

export type BatchState = 'ok' | 'near-expiry' | 'expired' | 'quarantined' | 'empty' | 'disposed';

export function batchState(b: MedicineBatch, day: number): BatchState {
  if (b.status === 'disposed') return 'disposed';
  if (b.status === 'quarantined') return 'quarantined';
  if (b.qty <= 0) return 'empty';
  if (isExpired(b, day)) return 'expired';
  if (isNearExpiry(b, day)) return 'near-expiry';
  return 'ok';
}

/** Batch yang layak digunakan: aktif, ada stok, belum kedaluwarsa. */
export const isUsable = (b: MedicineBatch, day: number) => b.status === 'active' && b.qty > 0 && !isExpired(b, day);

/** Urutan FEFO: kedaluwarsa paling dekat lebih dulu; seri → diterima lebih awal. */
export function fefoSort(a: MedicineBatch, b: MedicineBatch) {
  return a.expiryDay - b.expiryDay || a.receivedDay - b.receivedDay || a.id.localeCompare(b.id);
}

export function usableBatches(s: GameState, medicineId: string, location: StockLocation | 'any' = 'shelf'): MedicineBatch[] {
  const day = today(s);
  return s.batches
    .filter((b) => b.medicineId === medicineId && (location === 'any' || b.location === location) && isUsable(b, day))
    .sort(fefoSort);
}

export interface Allocation {
  batchId: string;
  qty: number;
}

/**
 * Pilih batch berdasarkan FEFO untuk jumlah tertentu.
 * Mengabaikan batch kedaluwarsa/karantina. `shortage` > 0 jika stok tidak cukup.
 */
export function selectFEFO(batches: MedicineBatch[], qty: number, day: number): { allocations: Allocation[]; shortage: number } {
  const sorted = batches.filter((b) => isUsable(b, day)).sort(fefoSort);
  const allocations: Allocation[] = [];
  let remaining = qty;
  for (const b of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(b.qty, remaining);
    allocations.push({ batchId: b.id, qty: take });
    remaining -= take;
  }
  return { allocations, shortage: Math.max(0, remaining) };
}

/** Rekomendasi batch tunggal FEFO beserta alasan (untuk UI pemilihan batch). */
export function recommendBatch(s: GameState, medicineId: string, qty: number): { batch?: MedicineBatch; reason: string } {
  const list = usableBatches(s, medicineId, 'shelf');
  if (list.length === 0) {
    const inWarehouse = stockOf(s, medicineId, 'warehouse');
    return { reason: inWarehouse > 0 ? `Tidak ada stok layak di rak. Gudang memiliki ${inWarehouse} — pindahkan ke rak.` : 'Stok layak tidak tersedia.' };
  }
  const enough = list.find((b) => b.qty >= qty);
  const first = list[0];
  if (first.qty >= qty) {
    return { batch: first, reason: `FEFO: batch ${first.batchNo} kedaluwarsa paling dekat (${daysToExpiry(first, today(s))} hari lagi) dan stoknya cukup.` };
  }
  if (enough) {
    return {
      batch: enough,
      reason: `Batch terdekat (${first.batchNo}) hanya berisi ${first.qty}. Batch ${enough.batchNo} adalah batch FEFO berikutnya yang stoknya cukup.`,
    };
  }
  return { batch: first, reason: `Tidak ada satu batch pun yang cukup; stok total rak ${stockOf(s, medicineId, 'shelf')}.` };
}

export function stockOf(s: GameState, medicineId: string, location: StockLocation | 'any' = 'any', usableOnly = true): number {
  const day = today(s);
  return s.batches
    .filter(
      (b) =>
        b.medicineId === medicineId &&
        (location === 'any' || b.location === location) &&
        (usableOnly ? isUsable(b, day) : b.status !== 'disposed'),
    )
    .reduce((a, b) => a + b.qty, 0);
}

export function usedVolume(s: GameState, location: StockLocation): number {
  let v = 0;
  for (const b of s.batches) {
    if (b.location !== location || b.status === 'disposed' || b.qty <= 0) continue;
    v += b.qty * (medicineById(s, b.medicineId)?.volume ?? 1);
  }
  return Math.round(v * 10) / 10;
}

export function capacityOf(s: GameState, location: StockLocation): number {
  const e = getEffects(s);
  return location === 'shelf' ? e.shelfCapacity : e.warehouseCapacity;
}

export function freeVolume(s: GameState, location: StockLocation) {
  return capacityOf(s, location) - usedVolume(s, location);
}

function logTx(
  s: GameState,
  type: InventoryTxType,
  b: MedicineBatch,
  qtyDelta: number,
  note: string,
  refId?: string,
  location: StockLocation = b.location,
) {
  s.inventoryTx.push({
    id: nextId(s, 'IT'),
    at: s.time.now,
    type,
    medicineId: b.medicineId,
    batchId: b.id,
    qtyDelta,
    location,
    note,
    refId,
    valueDelta: Math.round(qtyDelta * b.unitCost),
  });
  if (s.inventoryTx.length > 3000) s.inventoryTx.splice(0, s.inventoryTx.length - 3000);
}

export function makeBatchNo(s: GameState) {
  return `LOT${randInt(s, 10000, 99999)}`;
}

/** Penerimaan stok (dari pesanan, skenario, atau penyesuaian awal). */
export function receiveBatch(
  s: GameState,
  input: { medicineId: string; qty: number; expiryDay: number; unitCost: number; location: StockLocation; batchNo?: string; note?: string; refId?: string; skipCapacity?: boolean },
): Result<MedicineBatch> {
  const med = medicineById(s, input.medicineId);
  if (!med) return fail('Obat tidak ditemukan di katalog.');
  if (input.qty <= 0 || !Number.isInteger(input.qty)) return fail('Jumlah harus bilangan bulat positif.');
  if (!input.skipCapacity && input.qty * med.volume > freeVolume(s, input.location)) {
    return fail(`${LOCATION_LABELS[input.location]} tidak memiliki ruang cukup untuk ${med.name}.`);
  }
  const batch: MedicineBatch = {
    id: nextId(s, 'BT'),
    medicineId: med.id,
    batchNo: input.batchNo ?? makeBatchNo(s),
    qty: input.qty,
    expiryDay: input.expiryDay,
    unitCost: input.unitCost,
    receivedDay: today(s),
    location: input.location,
    status: 'active',
  };
  s.batches.push(batch);
  logTx(s, 'receive', batch, input.qty, input.note ?? 'Penerimaan stok', input.refId);
  return ok(batch);
}

/** Mengurangi stok dari batch tertentu (dengan pencatatan). */
export function consumeBatch(
  s: GameState,
  batchId: string,
  qty: number,
  type: InventoryTxType,
  note: string,
  refId?: string,
  opts: { allowExpired?: boolean } = {},
): Result<MedicineBatch> {
  const b = s.batches.find((x) => x.id === batchId);
  if (!b) return fail('Batch tidak ditemukan.');
  if (b.status !== 'active') return fail(`Batch ${b.batchNo} tidak aktif.`);
  if (!opts.allowExpired && isExpired(b, today(s))) return fail(`Batch ${b.batchNo} sudah kedaluwarsa dan tidak boleh digunakan.`);
  if (qty <= 0) return fail('Jumlah harus positif.');
  if (b.qty < qty) return fail(`Stok batch ${b.batchNo} tidak cukup (tersedia ${b.qty}).`);
  b.qty -= qty;
  logTx(s, type, b, -qty, note, refId);
  return ok(b);
}

/** Mengembalikan stok ke batch (mis. transaksi resep dibatalkan). */
export function returnToBatch(s: GameState, batchId: string, qty: number, note: string, refId?: string) {
  const b = s.batches.find((x) => x.id === batchId);
  if (!b || qty <= 0) return;
  b.qty += qty;
  if (b.status === 'disposed') b.status = 'active';
  logTx(s, 'return', b, qty, note, refId);
}

/** Memindahkan sebagian/seluruh batch ke lokasi lain. */
export function transferBatch(s: GameState, batchId: string, qty: number, to: StockLocation): Result<MedicineBatch> {
  const b = s.batches.find((x) => x.id === batchId);
  if (!b) return fail('Batch tidak ditemukan.');
  if (b.location === to) return fail('Batch sudah berada di lokasi tujuan.');
  if (b.status !== 'active') return fail('Hanya batch aktif yang dapat dipindahkan.');
  if (qty <= 0 || qty > b.qty || !Number.isInteger(qty)) return fail('Jumlah pemindahan tidak valid.');
  const med = medicineById(s, b.medicineId)!;
  if (qty * med.volume > freeVolume(s, to)) return fail(`${LOCATION_LABELS[to]} penuh. Tingkatkan kapasitas atau kosongkan ruang.`);

  // Gabungkan dengan batch yang sama (nomor batch identik) di lokasi tujuan bila ada.
  let target = s.batches.find(
    (x) => x.location === to && x.batchNo === b.batchNo && x.medicineId === b.medicineId && x.status === 'active' && x.expiryDay === b.expiryDay,
  );
  const from = b.location;
  b.qty -= qty;
  logTx(s, 'transfer', b, -qty, `Pindah ke ${LOCATION_LABELS[to]}`, undefined, from);
  if (!target) {
    target = { ...b, id: nextId(s, 'BT'), qty: 0, location: to };
    s.batches.push(target);
  }
  target.qty += qty;
  logTx(s, 'transfer', target, qty, `Dari ${LOCATION_LABELS[from]}`, undefined, to);
  s.stats.stockTransfers += 1;
  emit(s, { type: 'stock-transferred', refId: target.id });
  return ok(target);
}

/** Memindahkan stok suatu obat (FEFO) hingga jumlah tertentu. */
export function transferMedicine(s: GameState, medicineId: string, qty: number, from: StockLocation, to: StockLocation): Result<number> {
  const { allocations, shortage } = selectFEFO(usableBatches(s, medicineId, from), qty, today(s));
  if (allocations.length === 0) return fail('Tidak ada stok layak di lokasi asal.');
  let moved = 0;
  let count = 0;
  for (const a of allocations) {
    const r = transferBatch(s, a.batchId, a.qty, to);
    if (!r.ok) {
      if (moved === 0) return r;
      break;
    }
    moved += a.qty;
    count += 1;
  }
  // Satu pemindahan logis dihitung satu kali dalam statistik.
  s.stats.stockTransfers -= Math.max(0, count - 1);
  return ok(moved, shortage > 0 ? `Hanya ${moved} yang dapat dipindahkan.` : undefined);
}

/** Isi ulang rak hingga target (dipakai pemain & petugas gudang). */
export function restockShelf(s: GameState, medicineId: string, targetQty?: number): Result<number> {
  const med = medicineById(s, medicineId);
  if (!med) return fail('Obat tidak ditemukan.');
  const target = targetQty ?? med.minStock * 2;
  const need = target - stockOf(s, medicineId, 'shelf');
  if (need <= 0) return fail('Stok rak sudah mencukupi target.');
  const avail = stockOf(s, medicineId, 'warehouse');
  if (avail <= 0) return fail('Gudang tidak memiliki stok layak untuk obat ini.');
  const room = Math.floor(freeVolume(s, 'shelf') / med.volume);
  const qty = Math.min(need, avail, room);
  if (qty <= 0) return fail('Rak pelayanan penuh.');
  return transferMedicine(s, medicineId, qty, 'warehouse', 'shelf');
}

/** Stock opname: menyesuaikan jumlah fisik batch. Selisih kurang dicatat sebagai kerugian. */
export function adjustBatch(s: GameState, batchId: string, newQty: number, reason: string): Result<MedicineBatch> {
  const b = s.batches.find((x) => x.id === batchId);
  if (!b) return fail('Batch tidak ditemukan.');
  if (!Number.isInteger(newQty) || newQty < 0) return fail('Jumlah fisik harus bilangan bulat ≥ 0.');
  if (!reason.trim()) return fail('Alasan penyesuaian wajib diisi.');
  const delta = newQty - b.qty;
  if (delta === 0) return fail('Tidak ada perubahan jumlah.');
  b.qty = newQty;
  logTx(s, 'adjust', b, delta, `Penyesuaian: ${reason}`);
  if (delta < 0) addLedger(s, 'damage-loss', delta * b.unitCost, `Selisih stock opname ${b.batchNo}: ${reason}`, b.id, true);
  return ok(b);
}

/** Memusnahkan stok rusak atau kedaluwarsa. Nilainya dicatat sebagai kerugian nonkas. */
export function disposeBatch(s: GameState, batchId: string, reason: 'expired' | 'damaged', qty?: number): Result<MedicineBatch> {
  const b = s.batches.find((x) => x.id === batchId);
  if (!b) return fail('Batch tidak ditemukan.');
  if (b.status === 'disposed' || b.qty <= 0) return fail('Batch sudah kosong/dimusnahkan.');
  const day = today(s);
  if (reason === 'expired' && !isExpired(b, day)) return fail(`Batch ${b.batchNo} belum kedaluwarsa (${daysToExpiry(b, day)} hari lagi).`);
  const amount = qty ?? b.qty;
  if (amount <= 0 || amount > b.qty || !Number.isInteger(amount)) return fail('Jumlah pemusnahan tidak valid.');
  const med = medicineById(s, b.medicineId);
  b.qty -= amount;
  logTx(s, reason === 'expired' ? 'dispose-expired' : 'dispose-damaged', b, -amount, reason === 'expired' ? 'Pemusnahan kedaluwarsa' : 'Pemusnahan stok rusak');
  addLedger(
    s,
    reason === 'expired' ? 'expiry-loss' : 'damage-loss',
    -amount * b.unitCost,
    `${reason === 'expired' ? 'Kedaluwarsa' : 'Rusak'}: ${med?.name ?? b.medicineId} (${b.batchNo}) × ${amount}`,
    b.id,
    true,
  );
  if (b.qty === 0) b.status = 'disposed';
  if (reason === 'expired') s.stats.expiredDisposed += 1;
  emit(s, { type: 'stock-disposed', refId: b.id });
  return ok(b);
}

/** Karantina batch kedaluwarsa (dipindahkan dari penggunaan, menunggu pemusnahan). */
export function quarantineBatch(s: GameState, batchId: string): Result<MedicineBatch> {
  const b = s.batches.find((x) => x.id === batchId);
  if (!b || b.status !== 'active') return fail('Batch tidak dapat dikarantina.');
  b.status = 'quarantined';
  return ok(b);
}

export function expiredBatches(s: GameState, location?: StockLocation) {
  const day = today(s);
  return s.batches.filter((b) => b.status !== 'disposed' && b.qty > 0 && isExpired(b, day) && (!location || b.location === location));
}

export function nearExpiryBatches(s: GameState) {
  const day = today(s);
  return s.batches.filter((b) => b.status === 'active' && b.qty > 0 && isNearExpiry(b, day));
}

export interface InventoryDashboard {
  medicineTypes: number;
  totalUnits: number;
  lowStock: { medicineId: string; qty: number; min: number }[];
  outOfStock: string[];
  nearExpiry: number;
  expired: number;
  expiredValue: number;
  stockValue: number;
  shelfUsed: number;
  shelfCapacity: number;
  warehouseUsed: number;
  warehouseCapacity: number;
}

export function inventoryDashboard(s: GameState): InventoryDashboard {
  const day = today(s);
  const active = s.medicines.filter((m) => m.active);
  const lowStock: InventoryDashboard['lowStock'] = [];
  const outOfStock: string[] = [];
  let totalUnits = 0;
  for (const m of active) {
    const q = stockOf(s, m.id, 'any');
    totalUnits += q;
    if (q === 0) outOfStock.push(m.id);
    else if (q < m.minStock) lowStock.push({ medicineId: m.id, qty: q, min: m.minStock });
  }
  const live = s.batches.filter((b) => b.status !== 'disposed' && b.qty > 0);
  const expired = live.filter((b) => isExpired(b, day));
  return {
    medicineTypes: active.length,
    totalUnits,
    lowStock,
    outOfStock,
    nearExpiry: live.filter((b) => b.status === 'active' && isNearExpiry(b, day)).length,
    expired: expired.length,
    expiredValue: expired.reduce((a, b) => a + b.qty * b.unitCost, 0),
    stockValue: live.filter((b) => !isExpired(b, day)).reduce((a, b) => a + b.qty * b.unitCost, 0),
    shelfUsed: usedVolume(s, 'shelf'),
    shelfCapacity: capacityOf(s, 'shelf'),
    warehouseUsed: usedVolume(s, 'warehouse'),
    warehouseCapacity: capacityOf(s, 'warehouse'),
  };
}

/** Peringatan harian terkait kedaluwarsa. */
export function expiryCheck(s: GameState) {
  const exp = expiredBatches(s);
  const near = nearExpiryBatches(s).filter((b) => daysToExpiry(b, today(s)) <= 7);
  if (exp.length) notify(s, 'warning', `${exp.length} batch sudah kedaluwarsa. Musnahkan melalui Inventaris agar tidak terkena denda pemeriksaan.`);
  if (near.length) notify(s, 'info', `${near.length} batch akan kedaluwarsa dalam 7 hari. Prioritaskan penggunaannya (FEFO).`);
}
