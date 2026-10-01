import { dayOf } from './time';
import type { DailyReport, GameState, LedgerCategory, LedgerEntry } from './types';

export const LEDGER_LABELS: Record<LedgerCategory, string> = {
  sales: 'Penjualan',
  'service-fee': 'Jasa pelayanan',
  'mission-reward': 'Hadiah misi',
  'challenge-reward': 'Hadiah tantangan',
  'event-income': 'Pemasukan event',
  'stock-purchase': 'Pembelian stok',
  salary: 'Gaji pegawai',
  operational: 'Biaya operasional',
  upgrade: 'Peningkatan fasilitas',
  expansion: 'Perluasan ruangan',
  'expiry-loss': 'Kerugian kedaluwarsa',
  'damage-loss': 'Kerugian stok rusak/selisih',
  refund: 'Pengembalian dana',
  fine: 'Denda',
  other: 'Lain-lain',
};

export const ledgerForDays = (s: GameState, from: number, to: number) =>
  s.ledger.filter((e) => {
    const d = dayOf(e.at);
    return d >= from && d <= to;
  });

export interface FinanceSummary {
  income: number;
  expenses: number;
  nonCashLosses: number;
  cashFlow: number;
  profit: number;
  salesRevenue: number;
  cogs: number;
  grossMargin: number;
  byCategory: { category: LedgerCategory; amount: number }[];
}

/**
 * Ringkasan keuangan untuk rentang hari — seluruhnya dihitung dari buku besar & transaksi
 * yang tersimpan (bukan angka dekoratif).
 */
export function financeSummary(s: GameState, from: number, to: number): FinanceSummary {
  const entries = ledgerForDays(s, from, to);
  return summarize(s, entries, from, to);
}

function summarize(s: GameState, entries: LedgerEntry[], from: number, to: number): FinanceSummary {
  const byCat = new Map<LedgerCategory, number>();
  let income = 0;
  let expenses = 0;
  let nonCash = 0;
  for (const e of entries) {
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
    if (e.nonCash) nonCash += -e.amount;
    else if (e.amount > 0) income += e.amount;
    else expenses += -e.amount;
  }
  const salesRevenue = (byCat.get('sales') ?? 0) + (byCat.get('service-fee') ?? 0);
  const cogs = s.sales
    .filter((x) => x.status === 'completed' && x.completedAt !== undefined && dayOf(x.completedAt) >= from && dayOf(x.completedAt) <= to)
    .reduce((a, x) => a + x.cogs, 0);
  return {
    income,
    expenses,
    nonCashLosses: nonCash,
    cashFlow: income - expenses,
    profit: income - expenses - nonCash,
    salesRevenue,
    cogs,
    grossMargin: salesRevenue - cogs,
    byCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => a.amount - b.amount),
  };
}

export function topProducts(s: GameState, from: number, to: number, limit = 5) {
  const counts = new Map<string, number>();
  for (const sale of s.sales) {
    if (sale.status !== 'completed' || sale.completedAt === undefined) continue;
    const d = dayOf(sale.completedAt);
    if (d < from || d > to) continue;
    for (const it of sale.items) {
      if (it.medicineId.startsWith('fee:')) continue;
      counts.set(it.medicineId, (counts.get(it.medicineId) ?? 0) + it.qty);
    }
  }
  return [...counts.entries()]
    .map(([medicineId, qty]) => ({ medicineId, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

/** Laporan harian dibuat saat apotek ditutup. */
export function buildDailyReport(s: GameState, day: number, extra: Omit<DailyReport, 'day' | 'revenue' | 'expenses' | 'nonCashLosses' | 'profit' | 'cogs' | 'topProducts' | 'moneyEnd'>): DailyReport {
  const f = financeSummary(s, day, day);
  return {
    day,
    revenue: f.income,
    expenses: f.expenses,
    nonCashLosses: f.nonCashLosses,
    profit: f.profit,
    cogs: f.cogs,
    topProducts: topProducts(s, day, day),
    moneyEnd: s.money,
    ...extra,
  };
}

export function salesForDay(s: GameState, day: number) {
  return s.sales.filter((x) => x.status === 'completed' && x.completedAt !== undefined && dayOf(x.completedAt) === day);
}
