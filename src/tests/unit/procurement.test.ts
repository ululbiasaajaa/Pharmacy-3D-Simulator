import { describe, expect, it } from 'vitest';
import {
  cancelOrder,
  createDraftOrder,
  placeOrder,
  procurementRecommendations,
  receiveOrder,
  setOrderItem,
} from '@/domain/procurement';
import { advanceTime } from '@/domain/simulation';
import { stockOf } from '@/domain/inventory';
import { clearStock, newState } from '../helpers';

describe('Pengadaan', () => {
  it('alur pesan → kirim → tiba → terima menambah inventaris dan mengurangi kas', () => {
    const s = newState('career', { open: true });
    s.suppliers.forEach((x) => (x.reliability = 1));
    const draft = createDraftOrder(s, 'sup-cepat');
    expect(draft.ok).toBe(true);
    const po = draft.ok ? draft.value! : null!;
    setOrderItem(s, po.id, 'vitc-500', 30);
    const before = stockOf(s, 'vitc-500', 'warehouse');
    const money = s.money;
    expect(placeOrder(s, po.id).ok).toBe(true);
    expect(s.money).toBe(money - po.total);
    expect(po.status).toBe('ordered');
    expect(receiveOrder(s, po.id).ok).toBe(false);
    advanceTime(s, 60 * 2);
    expect(['processing', 'shipping']).toContain(po.status);
    advanceTime(s, 60 * 3);
    expect(po.status).toBe('arrived');
    expect(receiveOrder(s, po.id).ok).toBe(true);
    expect(stockOf(s, 'vitc-500', 'warehouse')).toBe(before + 30);
    expect(receiveOrder(s, po.id).ok).toBe(false);
    expect(s.stats.ordersReceived).toBe(1);
  });

  it('menolak pesanan di bawah minimum pemesanan atau melebihi kas', () => {
    const s = newState('career', { open: true });
    const po = createDraftOrder(s, 'sup-hemat');
    const id = po.ok ? po.value!.id : '';
    setOrderItem(s, id, 'pct-500', 1);
    expect(placeOrder(s, id).ok).toBe(false);
    setOrderItem(s, id, 'termo', 2000);
    s.money = 1000;
    expect(placeOrder(s, id).ok).toBe(false);
  });

  it('pembatalan sebelum dikirim mengembalikan dana penuh', () => {
    const s = newState('career', { open: true });
    const po = createDraftOrder(s, 'sup-cepat');
    const id = po.ok ? po.value!.id : '';
    setOrderItem(s, id, 'masker', 10);
    placeOrder(s, id);
    const afterPay = s.money;
    expect(cancelOrder(s, id).ok).toBe(true);
    expect(s.money).toBeGreaterThan(afterPay);
    expect(cancelOrder(s, id).ok).toBe(false);
  });

  it('rekomendasi pengadaan menyarankan produk yang habis', () => {
    const s = newState('career', { open: true });
    clearStock(s, 'vitc-500');
    const rec = procurementRecommendations(s).find((r) => r.medicineId === 'vitc-500');
    expect(rec).toBeDefined();
    expect(rec!.suggestedQty).toBeGreaterThan(0);
    expect(rec!.supplierId).not.toBeNull();
  });
});
