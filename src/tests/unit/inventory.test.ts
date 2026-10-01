import { describe, expect, it } from 'vitest';
import {
  adjustBatch,
  disposeBatch,
  inventoryDashboard,
  recommendBatch,
  restockShelf,
  selectFEFO,
  stockOf,
  transferBatch,
  usableBatches,
} from '@/domain/inventory';
import { buyUpgrade } from '@/domain/upgrades';
import { getEffects } from '@/domain/core';
import { addBatch, clearStock, newState } from '../helpers';

describe('FEFO', () => {
  it('memilih batch dengan kedaluwarsa terdekat dan melewati batch kedaluwarsa', () => {
    const s = newState();
    clearStock(s, 'pct-500');
    const expired = addBatch(s, 'pct-500', 10, -1, 'shelf', 'EXP');
    const near = addBatch(s, 'pct-500', 3, 10, 'shelf', 'NEAR');
    const far = addBatch(s, 'pct-500', 20, 200, 'shelf', 'FAR');
    const { allocations, shortage } = selectFEFO(usableBatches(s, 'pct-500'), 5, s.time.day);
    expect(shortage).toBe(0);
    expect(allocations).toEqual([
      { batchId: near.id, qty: 3 },
      { batchId: far.id, qty: 2 },
    ]);
    expect(allocations.some((a) => a.batchId === expired.id)).toBe(false);
  });

  it('melaporkan kekurangan bila stok layak tidak cukup', () => {
    const s = newState();
    clearStock(s, 'pct-500');
    addBatch(s, 'pct-500', 2, 30);
    addBatch(s, 'pct-500', 50, -3);
    const r = selectFEFO(usableBatches(s, 'pct-500'), 5, s.time.day);
    expect(r.shortage).toBe(3);
  });

  it('rekomendasi batch menjelaskan alasan FEFO', () => {
    const s = newState();
    clearStock(s, 'pct-500');
    addBatch(s, 'pct-500', 1, 5, 'shelf', 'SMALL');
    const big = addBatch(s, 'pct-500', 10, 50, 'shelf', 'BIG');
    const rec = recommendBatch(s, 'pct-500', 2);
    expect(rec.batch?.id).toBe(big.id);
    expect(rec.reason).toContain('SMALL');
  });

  it('rekomendasi menyarankan memindahkan stok bila hanya ada di gudang', () => {
    const s = newState();
    clearStock(s, 'pct-500');
    addBatch(s, 'pct-500', 10, 50, 'warehouse');
    expect(recommendBatch(s, 'pct-500', 1).reason).toMatch(/pindahkan ke rak/i);
  });
});

describe('Operasi stok', () => {
  it('memindahkan stok gudang → rak dengan catatan transaksi', () => {
    const s = newState();
    clearStock(s, 'vitc-500');
    const b = addBatch(s, 'vitc-500', 10, 100, 'warehouse');
    const txBefore = s.inventoryTx.length;
    const r = transferBatch(s, b.id, 4, 'shelf');
    expect(r.ok).toBe(true);
    expect(stockOf(s, 'vitc-500', 'shelf')).toBe(4);
    expect(stockOf(s, 'vitc-500', 'warehouse')).toBe(6);
    expect(s.inventoryTx.length).toBe(txBefore + 2);
    expect(s.stats.stockTransfers).toBe(1);
  });

  it('restockShelf mengisi rak hingga target dari gudang', () => {
    const s = newState();
    clearStock(s, 'vitc-500');
    addBatch(s, 'vitc-500', 30, 100, 'warehouse');
    const r = restockShelf(s, 'vitc-500', 12);
    expect(r.ok).toBe(true);
    expect(stockOf(s, 'vitc-500', 'shelf')).toBe(12);
  });

  it('pemusnahan kedaluwarsa dicatat sebagai kerugian nonkas tanpa mengubah kas', () => {
    const s = newState();
    const b = addBatch(s, 'pct-500', 4, -1);
    const money = s.money;
    const r = disposeBatch(s, b.id, 'expired');
    expect(r.ok).toBe(true);
    expect(s.money).toBe(money);
    const loss = s.ledger.find((e) => e.category === 'expiry-loss');
    expect(loss?.amount).toBe(-4 * b.unitCost);
    expect(loss?.nonCash).toBe(true);
    expect(s.stats.expiredDisposed).toBe(1);
    expect(s.batches.find((x) => x.id === b.id)?.status).toBe('disposed');
  });

  it('menolak memusnahkan batch yang belum kedaluwarsa sebagai "expired"', () => {
    const s = newState();
    const b = addBatch(s, 'pct-500', 4, 20);
    expect(disposeBatch(s, b.id, 'expired').ok).toBe(false);
    expect(disposeBatch(s, b.id, 'damaged', 1).ok).toBe(true);
    expect(s.batches.find((x) => x.id === b.id)?.qty).toBe(3);
  });

  it('penyesuaian stok wajib beralasan dan mencatat selisih', () => {
    const s = newState();
    const b = addBatch(s, 'pct-500', 10, 20);
    expect(adjustBatch(s, b.id, 8, '').ok).toBe(false);
    expect(adjustBatch(s, b.id, 8, 'Rusak saat opname').ok).toBe(true);
    expect(s.inventoryTx.at(-1)?.qtyDelta).toBe(-2);
  });

  it('kapasitas rak membatasi pemindahan dan dapat ditingkatkan', () => {
    const s = newState();
    s.progression.level = 5;
    s.money = 50_000_000;
    const baseCap = getEffects(s).shelfCapacity;
    const b = addBatch(s, 'pct-500', baseCap * 2, 100, 'warehouse');
    const r = transferBatch(s, b.id, baseCap * 2, 'shelf');
    expect(r.ok).toBe(false);
    expect(buyUpgrade(s, 'shelf').ok).toBe(true);
    expect(getEffects(s).shelfCapacity).toBe(baseCap + 350);
  });

  it('dashboard menghitung stok rendah & kedaluwarsa dari data batch', () => {
    const s = newState();
    clearStock(s, 'termo');
    addBatch(s, 'pct-500', 3, -2);
    const d = inventoryDashboard(s);
    expect(d.outOfStock).toContain('termo');
    expect(d.expired).toBeGreaterThanOrEqual(1);
    expect(d.expiredValue).toBeGreaterThan(0);
  });
});
