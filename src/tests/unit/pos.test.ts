import { describe, expect, it } from 'vitest';
import { addSaleItem, cancelSale, completeSale, openSale, PROMO } from '@/domain/pos';
import { addToPatientCart, callNextPatient, sendToCheckout, spawnPatient } from '@/domain/patients';
import { stockOf } from '@/domain/inventory';
import { addBatch, clearStock, newState } from '../helpers';

function otcPatient(symptom: 'sakit-kepala' | 'maag' = 'sakit-kepala', category: 'otc' | 'canceller' = 'otc') {
  const s = newState('career', { open: true });
  const p = spawnPatient(s, { category, symptom, scripted: true })!;
  p.money = 500_000;
  callNextPatient(s, p.id);
  return { s, p };
}

describe('Kasir', () => {
  it('menyelesaikan transaksi: stok berkurang (FEFO), kas bertambah, tercatat di buku besar', () => {
    const { s, p } = otcPatient();
    clearStock(s, 'pct-500');
    const near = addBatch(s, 'pct-500', 2, 10);
    addBatch(s, 'pct-500', 10, 100);
    expect(addToPatientCart(s, p.id, 'pct-500', 3).ok).toBe(true);
    expect(sendToCheckout(s, p.id).ok).toBe(true);
    const money = s.money;
    const r = completeSale(s, p.saleId!, 'cash');
    expect(r.ok).toBe(true);
    const sale = r.ok ? r.value! : null!;
    expect(s.money).toBe(money + sale.total);
    expect(stockOf(s, 'pct-500', 'shelf')).toBe(9);
    expect(s.batches.find((b) => b.id === near.id)!.qty).toBe(0);
    expect(sale.cogs).toBeGreaterThan(0);
    expect(s.ledger.at(-1)?.category).toBe('sales');
    expect(p.status).toBe('done');
    expect(s.stats.patientsServed).toBe(1);
  });

  it('transaksi yang selesai tidak dapat diproses dua kali', () => {
    const { s, p } = otcPatient();
    addToPatientCart(s, p.id, 'pct-500', 1);
    sendToCheckout(s, p.id);
    completeSale(s, p.saleId!, 'card');
    const money = s.money;
    const stock = stockOf(s, 'pct-500', 'shelf');
    expect(completeSale(s, p.saleId!, 'card').ok).toBe(false);
    expect(cancelSale(s, p.saleId!).ok).toBe(false);
    expect(s.money).toBe(money);
    expect(stockOf(s, 'pct-500', 'shelf')).toBe(stock);
  });

  it('obat resep tidak dapat dijual bebas dan bahan racik tidak dijual', () => {
    const s = newState('career', { open: true });
    const sale = openSale(s, { source: 'pos' });
    expect(addSaleItem(s, sale.id, 'amox-500', 1).ok).toBe(false);
    expect(addSaleItem(s, sale.id, 'zno', 1).ok).toBe(false);
  });

  it('menolak jumlah melebihi stok rak', () => {
    const s = newState('career', { open: true });
    clearStock(s, 'vitc-500');
    addBatch(s, 'vitc-500', 2, 100);
    addBatch(s, 'vitc-500', 50, 100, 'warehouse');
    const sale = openSale(s, { source: 'pos' });
    expect(addSaleItem(s, sale.id, 'vitc-500', 3).ok).toBe(false);
  });

  it('pasien menolak produk yang tidak sesuai keluhan', () => {
    const { s, p } = otcPatient('maag');
    addToPatientCart(s, p.id, 'pct-500', 1);
    const r = sendToCheckout(s, p.id);
    expect(r.ok).toBe(false);
    expect(p.wrongAttempts).toBe(1);
    expect(p.status).toBe('serving');
  });

  it('pasien pembatal: transaksi harus dibatalkan, stok tidak berubah', () => {
    const { s, p } = otcPatient('sakit-kepala', 'canceller');
    addToPatientCart(s, p.id, 'pct-500', 1);
    sendToCheckout(s, p.id);
    const stock = stockOf(s, 'pct-500', 'shelf');
    expect(completeSale(s, p.saleId!, 'cash').ok).toBe(false);
    expect(cancelSale(s, p.saleId!).ok).toBe(true);
    expect(stockOf(s, 'pct-500', 'shelf')).toBe(stock);
    expect(p.status).toBe('left');
    expect(s.stats.salesCancelled).toBe(1);
  });

  it('menerapkan promo diskon untuk belanja besar', () => {
    const s = newState('career', { open: true });
    addBatch(s, 'termo', 10, 300);
    const sale = openSale(s, { source: 'pos' });
    addSaleItem(s, sale.id, 'termo', 3);
    expect(sale.subtotal).toBeGreaterThanOrEqual(PROMO.threshold);
    expect(sale.discount).toBe(Math.round(sale.subtotal * PROMO.rate));
    expect(sale.total).toBe(sale.subtotal - sale.discount);
  });
});
