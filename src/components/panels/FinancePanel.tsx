import { useState } from 'react';
import { useUi } from '@/stores/uiStore';
import { Badge, Empty, Modal, Stat, Tabs } from '@/components/ui/primitives';
import { FeatureLock, useGameState } from './shared';
import { financeSummary, LEDGER_LABELS, topProducts } from '@/domain/finance';
import { inventoryDashboard } from '@/domain/inventory';
import { itemDisplayName } from '@/domain/compounding';
import { PAYMENT_LABELS } from '@/domain/pos';
import { dayOf, formatClock, formatMoney } from '@/domain/time';

type Period = 'today' | 'yesterday' | 'week' | 'all';

export function FinancePanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const [period, setPeriod] = useState<Period>('today');
  const [tab, setTab] = useState<'summary' | 'daily' | 'sales' | 'ledger'>('summary');
  const day = game.time.day;
  const range: Record<Period, [number, number]> = { today: [day, day], yesterday: [day - 1, day - 1], week: [Math.max(1, day - 6), day], all: [1, day] };
  const [from, to] = range[period];
  const f = financeSummary(game, from, to);
  const top = topProducts(game, from, to);
  const inv = inventoryDashboard(game);
  return (
    <Modal title="Keuangan" subtitle="Semua angka dihitung dari buku besar & transaksi yang tersimpan" onClose={close} testId="panel-finance">
      <FeatureLock feature="finance">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'summary', label: 'Ringkasan' },
            { id: 'daily', label: 'Laporan Harian' },
            { id: 'sales', label: 'Riwayat Transaksi' },
            { id: 'ledger', label: 'Buku Besar' },
          ]}
        />
        {(tab === 'summary' || tab === 'ledger' || tab === 'sales') && (
          <div className="mb-3 flex flex-wrap gap-1" role="radiogroup" aria-label="Periode">
            {(
              [
                ['today', 'Hari ini'],
                ['yesterday', 'Kemarin'],
                ['week', '7 hari'],
                ['all', 'Semua'],
              ] as [Period, string][]
            ).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${period === id ? 'bg-brand-600 text-white' : 'bg-ink-800 text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {tab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Pemasukan" value={formatMoney(f.income)} tone="good" />
              <Stat label="Pengeluaran" value={formatMoney(f.expenses)} tone="bad" />
              <Stat label="Kerugian stok (nonkas)" value={formatMoney(f.nonCashLosses)} tone={f.nonCashLosses ? 'warn' : undefined} />
              <Stat label="Laba / rugi" value={formatMoney(f.profit)} tone={f.profit >= 0 ? 'good' : 'bad'} />
              <Stat label="Pendapatan penjualan" value={formatMoney(f.salesRevenue)} />
              <Stat label="HPP" value={formatMoney(f.cogs)} hint="Harga pokok dari batch terjual" />
              <Stat label="Laba kotor" value={formatMoney(f.grossMargin)} tone={f.grossMargin >= 0 ? 'good' : 'bad'} />
              <Stat label="Kas saat ini" value={formatMoney(game.money)} tone={game.money >= 0 ? undefined : 'bad'} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-muted mb-1 text-xs font-semibold uppercase">Rincian per kategori</div>
                {f.byCategory.length === 0 ? (
                  <div className="text-muted text-sm">Belum ada transaksi pada periode ini.</div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {f.byCategory.map((c) => (
                        <tr key={c.category} className="border-t border-ink-800">
                          <td className="py-1">{LEDGER_LABELS[c.category]}</td>
                          <td className={`text-right tabular-nums ${c.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatMoney(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div>
                <div className="text-muted mb-1 text-xs font-semibold uppercase">Produk terlaris</div>
                {top.length === 0 ? (
                  <div className="text-muted text-sm">—</div>
                ) : (
                  <ol className="space-y-0.5 text-sm">
                    {top.map((t, i) => (
                      <li key={t.medicineId} className="flex justify-between">
                        <span>
                          {i + 1}. {itemDisplayName(game, t.medicineId)}
                        </span>
                        <span className="tabular-nums">{t.qty}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="text-muted mb-1 mt-3 text-xs font-semibold uppercase">Stok rendah</div>
                <div className="text-sm">{inv.lowStock.length + inv.outOfStock.length === 0 ? '—' : [...inv.outOfStock.map((id) => `${itemDisplayName(game, id)} (habis)`), ...inv.lowStock.map((l) => `${itemDisplayName(game, l.medicineId)} (${l.qty})`)].join(', ')}</div>
              </div>
            </div>
          </div>
        )}
        {tab === 'daily' &&
          (game.reports.length === 0 ? (
            <Empty>Laporan harian dibuat saat apotek tutup (20.00).</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-muted text-left text-xs uppercase">
                  <tr>
                    <th className="py-1">Hari</th>
                    <th className="text-right">Pemasukan</th>
                    <th className="text-right">Pengeluaran</th>
                    <th className="text-right">Kerugian stok</th>
                    <th className="text-right">Laba</th>
                    <th className="text-right">Dilayani</th>
                    <th className="text-right">Pergi</th>
                    <th className="text-right">Reputasi</th>
                  </tr>
                </thead>
                <tbody>
                  {[...game.reports].reverse().map((r) => (
                    <tr key={r.day} className="border-t border-ink-800">
                      <td className="py-1">Hari {r.day}</td>
                      <td className="text-right tabular-nums">{formatMoney(r.revenue)}</td>
                      <td className="text-right tabular-nums">{formatMoney(r.expenses)}</td>
                      <td className="text-right tabular-nums">{formatMoney(r.nonCashLosses)}</td>
                      <td className={`text-right tabular-nums ${r.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatMoney(r.profit)}</td>
                      <td className="text-right">{r.patientsServed}</td>
                      <td className="text-right">{r.patientsLeft}</td>
                      <td className="text-right">
                        {Math.round(r.reputationStart)} → {Math.round(r.reputationEnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        {tab === 'sales' && (
          <ul className="space-y-1 text-sm">
            {game.sales
              .filter((x) => x.status !== 'open' && x.completedAt !== undefined && dayOf(x.completedAt) >= from && dayOf(x.completedAt) <= to)
              .reverse()
              .slice(0, 100)
              .map((x) => (
                <li key={x.id} className="rounded border border-ink-700 px-2 py-1.5">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      {x.id} · H{dayOf(x.completedAt!)} {formatClock(x.completedAt!)} · {x.method ? PAYMENT_LABELS[x.method] : '—'} · oleh {x.handledBy === 'player' ? 'kamu' : (game.employees.find((e) => e.id === x.handledBy)?.name ?? 'pegawai')}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={x.status === 'completed' ? 'green' : 'red'}>{x.status === 'completed' ? 'Lunas' : 'Batal'}</Badge>
                      <span className="tabular-nums">{formatMoney(x.total)}</span>
                    </span>
                  </div>
                  <div className="text-muted text-xs">{x.items.map((i) => `${itemDisplayName(game, i.medicineId)} ×${i.qty}`).join(', ')}</div>
                </li>
              ))}
          </ul>
        )}
        {tab === 'ledger' && (
          <table className="w-full text-xs">
            <thead className="text-muted text-left uppercase">
              <tr>
                <th className="py-1">Waktu</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th className="text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {game.ledger
                .filter((e) => dayOf(e.at) >= from && dayOf(e.at) <= to)
                .slice(-150)
                .reverse()
                .map((e) => (
                  <tr key={e.id} className="border-t border-ink-800">
                    <td className="py-1">
                      H{dayOf(e.at)} {formatClock(e.at)}
                    </td>
                    <td>
                      {LEDGER_LABELS[e.category]}
                      {e.nonCash && <span className="text-muted"> (nonkas)</span>}
                    </td>
                    <td className="text-muted">{e.description}</td>
                    <td className={`text-right tabular-nums ${e.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatMoney(e.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </FeatureLock>
    </Modal>
  );
}
