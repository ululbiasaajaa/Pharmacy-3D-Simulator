import { useEffect, useState } from 'react';
import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Callout, ConfirmDialog, Empty, Modal, NumberStepper, inputClass } from '@/components/ui/primitives';
import { useFeedback, useGameState } from './shared';
import { cancelSale, completeSale, PAYMENT_LABELS, PROMO, removeSaleItem, setSaleItemQty } from '@/domain/pos';
import { itemDisplayName } from '@/domain/compounding';
import { formatClock, formatMoney } from '@/domain/time';
import type { PaymentMethod } from '@/domain/types';

export function PosPanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const fb = useFeedback();
  const waiting = game.patients.filter((p) => p.status === 'checkout' && p.saleId && game.sales.find((x) => x.id === p.saleId)?.status === 'open');
  const [selectedId, setSelectedId] = useState<string | null>(waiting[0]?.id ?? null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cash, setCash] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const patient = waiting.find((p) => p.id === selectedId) ?? waiting[0];
  const sale = patient ? game.sales.find((x) => x.id === patient.saleId) : undefined;
  const handledByEmployee = patient && game.employees.some((e) => e.task?.kind === 'checkout' && e.task.targetId === patient.id);

  useEffect(() => {
    if (patient) {
      setMethod(patient.paymentMethod);
    }
  }, [patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sale) setCash(Math.ceil(sale.total / 10_000) * 10_000);
  }, [sale?.id, sale?.total]); // eslint-disable-line react-hooks/exhaustive-deps

  const recent = game.sales.filter((x) => x.status !== 'open').slice(-8).reverse();

  return (
    <Modal title="Mesin Kasir" subtitle={`${waiting.length} pasien menunggu pembayaran`} onClose={close} testId="panel-pos">
      {fb.node}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div>
          <div className="text-muted mb-1 text-xs font-semibold uppercase">Antrean kasir</div>
          {waiting.length === 0 ? (
            <Empty>Tidak ada pasien di kasir. Layani pasien di Meja Pelayanan terlebih dahulu.</Empty>
          ) : (
            <ul className="space-y-1">
              {waiting.map((p) => {
                const s = game.sales.find((x) => x.id === p.saleId)!;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${patient?.id === p.id ? 'border-brand-400 bg-brand-900/40' : 'border-ink-700 hover:bg-ink-800'}`}
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted text-xs">
                        {s.id} · {formatMoney(s.total)} · {s.source === 'prescription' ? 'Resep' : s.source === 'compounding' ? 'Racikan' : 'Obat bebas'}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          {!patient || !sale ? (
            <Empty>Pilih transaksi.</Empty>
          ) : (
            <div className="space-y-3" data-testid="pos-sale">
              {patient.cancelRequested && (
                <Callout tone="warn" title={`${patient.name}:`}>
                  “Maaf, setelah dipikir-pikir saya tidak jadi membeli.” — Batalkan transaksi ini.
                </Callout>
              )}
              {handledByEmployee && <Callout tone="info">Kasir pegawai sedang memproses transaksi ini.</Callout>}
              <table className="w-full text-sm">
                <thead className="text-muted text-left text-xs uppercase">
                  <tr>
                    <th className="py-1">Item</th>
                    <th className="py-1">Jumlah</th>
                    <th className="py-1 text-right">Harga</th>
                    <th className="py-1 text-right">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((it) => (
                    <tr key={it.medicineId} className="border-t border-ink-700">
                      <td className="py-1.5">{itemDisplayName(game, it.medicineId)}</td>
                      <td>
                        {sale.stockCommitted ? (
                          it.qty
                        ) : (
                          <NumberStepper value={it.qty} min={0} max={20} label={itemDisplayName(game, it.medicineId)} onChange={(v) => fb.show(act((s) => setSaleItemQty(s, sale.id, it.medicineId, v)))} />
                        )}
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(it.unitPrice)}</td>
                      <td className="text-right tabular-nums">{formatMoney(it.qty * it.unitPrice)}</td>
                      <td className="text-right">
                        {!sale.stockCommitted && (
                          <Button size="sm" variant="ghost" aria-label="Hapus item" onClick={() => fb.show(act((s) => removeSaleItem(s, sale.id, it.medicineId)))}>
                            ✕
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rounded-lg bg-ink-850 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(sale.subtotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-300">
                  <span>Diskon {sale.discount > 0 ? `(${PROMO.label})` : ''}</span>
                  <span className="tabular-nums">−{formatMoney(sale.discount)}</span>
                </div>
                <div className="mt-1 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="tabular-nums" data-testid="pos-total">
                    {formatMoney(sale.total)}
                  </span>
                </div>
                <div className="text-muted text-xs">Budget pasien: {formatMoney(patient.money)} · metode pilihan pasien: {PAYMENT_LABELS[patient.paymentMethod]}</div>
              </div>
              <div>
                <div className="text-muted mb-1 text-xs font-semibold uppercase">Metode pembayaran (simulasi)</div>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                    <Button key={m} size="sm" variant={method === m ? 'primary' : 'secondary'} aria-pressed={method === m} onClick={() => setMethod(m)}>
                      {PAYMENT_LABELS[m]}
                    </Button>
                  ))}
                </div>
                {method === 'cash' && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <label htmlFor="cash-in">Uang diterima</label>
                    <input id="cash-in" type="number" className={`${inputClass} w-36`} value={cash} min={0} step={1000} onChange={(e) => setCash(Number(e.target.value) || 0)} />
                    <span className={cash >= sale.total ? 'text-emerald-300' : 'text-rose-300'}>Kembalian: {formatMoney(Math.max(0, cash - sale.total))}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="danger" onClick={() => setConfirmCancel(true)} data-testid="pos-cancel">
                  Batalkan transaksi
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={busy || (method === 'cash' && cash < sale.total)}
                  data-testid="pos-complete"
                  onClick={() => {
                    setBusy(true);
                    const ok = fb.show(act((s) => completeSale(s, sale.id, method)), `Transaksi ${sale.id} selesai.`);
                    setBusy(false);
                    if (ok) setSelectedId(null);
                  }}
                >
                  ✔ Selesaikan pembayaran
                </Button>
              </div>
            </div>
          )}
          <div className="mt-5">
            <div className="text-muted mb-1 text-xs font-semibold uppercase">Transaksi terakhir</div>
            {recent.length === 0 ? (
              <div className="text-muted text-xs">Belum ada.</div>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {recent.map((x) => (
                  <li key={x.id} className="flex justify-between border-b border-ink-800 py-1">
                    <span>
                      {x.id} · {x.completedAt ? formatClock(x.completedAt) : ''} · {x.method ? PAYMENT_LABELS[x.method] : '—'}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={x.status === 'completed' ? 'green' : 'red'}>{x.status === 'completed' ? 'Lunas' : 'Batal'}</Badge>
                      <span className="tabular-nums">{formatMoney(x.total)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {confirmCancel && sale && (
        <ConfirmDialog
          title="Batalkan transaksi?"
          message={sale.stockCommitted ? 'Obat yang sudah disiapkan akan dikembalikan ke batch asal.' : 'Transaksi dibatalkan tanpa mengubah stok.'}
          confirmLabel="Batalkan"
          danger
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => {
            setConfirmCancel(false);
            fb.show(act((s) => cancelSale(s, sale.id)), 'Transaksi dibatalkan.');
          }}
        />
      )}
    </Modal>
  );
}
