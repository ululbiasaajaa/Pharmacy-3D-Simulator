import { useMemo, useState } from 'react';
import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Callout, Empty, Modal, NumberStepper, Tabs, inputClass } from '@/components/ui/primitives';
import { useFeedback, useGameState } from './shared';
import {
  cancelOrder,
  createDraftOrder,
  findSupplier,
  incomingQty,
  leadTimeMinutes,
  placeOrder,
  PO_STATUS_LABELS,
  procurementRecommendations,
  receiveOrder,
  setAutoReorder,
  setOrderItem,
  supplierUnitCost,
} from '@/domain/procurement';
import { freeVolume, stockOf } from '@/domain/inventory';
import { getEffects } from '@/domain/core';
import { CATEGORY_LABELS } from '@/data/medicines';
import { dayOf, formatClock, formatDuration, formatMoney } from '@/domain/time';
import type { PurchaseOrderStatus } from '@/domain/types';

type Tab = 'suppliers' | 'orders' | 'recs';

const STATUS_TONE: Record<PurchaseOrderStatus, 'slate' | 'blue' | 'amber' | 'green' | 'red' | 'violet'> = {
  draft: 'slate',
  ordered: 'blue',
  processing: 'blue',
  shipping: 'amber',
  arrived: 'green',
  received: 'violet',
  cancelled: 'red',
};

function SuppliersTab() {
  const game = useGameState();
  const fb = useFeedback();
  const [supId, setSupId] = useState(game.suppliers[0].id);
  const [q, setQ] = useState('');
  const sup = findSupplier(game, supId)!;
  const draft = game.purchaseOrders.find((o) => o.supplierId === supId && o.status === 'draft');
  const products = useMemo(
    () => sup.products.filter((p) => {
      const m = game.medicines.find((x) => x.id === p.medicineId);
      return m && (!q || m.name.toLowerCase().includes(q.toLowerCase()));
    }),
    [sup, q, game.medicines],
  );
  const setQty = (medicineId: string, qty: number) => {
    let poId = draft?.id;
    if (!poId) {
      const r = act((s) => createDraftOrder(s, supId));
      if (!r?.ok) return fb.show(r);
      poId = r.value!.id;
    }
    const r = act((s) => setOrderItem(s, poId!, medicineId, qty));
    if (r && !r.ok) fb.show(r);
  };
  return (
    <div>
      {fb.node}
      <div className="grid gap-2 md:grid-cols-4">
        {game.suppliers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSupId(s.id)}
            className={`rounded-lg border p-2 text-left text-xs ${supId === s.id ? 'border-brand-400 bg-brand-900/40' : 'border-ink-700 hover:bg-ink-800'}`}
            data-testid={`supplier-${s.id}`}
          >
            <div className="text-sm font-semibold text-white">{s.name}</div>
            <div className="text-muted">
              Kirim ±{formatDuration(leadTimeMinutes(game, s))} · andal {Math.round(s.reliability * 100)}%
            </div>
            <div className="text-muted">Min. order {formatMoney(s.minOrder)}</div>
            <div className="mt-1 flex gap-1">
              <Badge tone={s.relationship === 'mitra' ? 'green' : s.relationship === 'baik' ? 'blue' : 'slate'}>{s.relationship}</Badge>
              <Badge>Rep {s.reputation}</Badge>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <input className={`${inputClass} mb-2 max-w-xs`} placeholder="Cari produk pemasok…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari produk pemasok" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-muted text-left text-xs uppercase">
                <tr>
                  <th className="py-1">Produk</th>
                  <th>Harga beli</th>
                  <th>Stok</th>
                  <th>Datang</th>
                  <th>Pesan</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const m = game.medicines.find((x) => x.id === p.medicineId)!;
                  const stock = stockOf(game, m.id, 'any');
                  const inDraft = draft?.items.find((i) => i.medicineId === m.id)?.qty ?? 0;
                  return (
                    <tr key={p.medicineId} className="border-t border-ink-700">
                      <td className="py-1.5">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-muted text-xs">{CATEGORY_LABELS[m.category]}</div>
                      </td>
                      <td className="tabular-nums">
                        {formatMoney(supplierUnitCost(game, sup, m.id) ?? 0)}/{m.unit}
                      </td>
                      <td className={`tabular-nums ${stock < m.minStock ? 'text-amber-300' : ''}`}>
                        {stock}/{m.minStock}
                      </td>
                      <td className="tabular-nums">{incomingQty(game, m.id) || '—'}</td>
                      <td>
                        <NumberStepper value={inDraft} min={0} max={5000} step={m.unit === 'gram' ? 50 : 5} onChange={(v) => setQty(m.id, v)} label={m.name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-ink-600 bg-ink-850 p-3 text-sm">
          <div className="mb-2 font-semibold">Draf pesanan</div>
          {!draft || draft.items.length === 0 ? (
            <div className="text-muted text-xs">Atur jumlah produk di tabel untuk membuat draf.</div>
          ) : (
            <>
              <ul className="space-y-0.5 text-xs">
                {draft.items.map((i) => (
                  <li key={i.medicineId} className="flex justify-between">
                    <span>
                      {game.medicines.find((m) => m.id === i.medicineId)?.name} ×{i.qty}
                    </span>
                    <span className="tabular-nums">{formatMoney(i.qty * i.unitCost)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-ink-700 pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(draft.total)}</span>
              </div>
              {draft.total < sup.minOrder && <div className="mt-1 text-xs text-amber-300">Kurang {formatMoney(sup.minOrder - draft.total)} dari minimum pemesanan.</div>}
              {draft.total > game.money && <div className="mt-1 text-xs text-rose-300">Melebihi kas yang tersedia.</div>}
              <div className="text-muted mt-1 text-xs">
                Estimasi tiba ±{formatDuration(leadTimeMinutes(game, sup))} · ruang gudang bebas {Math.round(freeVolume(game, 'warehouse'))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" onClick={() => fb.show(act((s) => placeOrder(s, draft.id)))} data-testid="place-order">
                  Konfirmasi pesanan
                </Button>
                <Button variant="ghost" onClick={() => fb.show(act((s) => cancelOrder(s, draft.id)), 'Draf dibuang.')}>
                  Buang draf
                </Button>
              </div>
            </>
          )}
          <div className="text-muted mt-3 text-xs">Kas: {formatMoney(game.money)}. Pembayaran pesanan dilakukan di muka.</div>
        </div>
      </div>
    </div>
  );
}

function OrdersTab() {
  const game = useGameState();
  const fb = useFeedback();
  const orders = [...game.purchaseOrders].filter((o) => o.status !== 'draft').reverse();
  return (
    <div>
      {fb.node}
      {orders.length === 0 ? (
        <Empty>Belum ada pesanan.</Empty>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const sup = findSupplier(game, o.supplierId);
            return (
              <li key={o.id} className="rounded-lg border border-ink-700 p-3 text-sm" data-testid={`order-${o.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">{o.id}</span> · {sup?.name} · {formatMoney(o.total)}
                    <div className="text-muted text-xs">{o.items.map((i) => `${game.medicines.find((m) => m.id === i.medicineId)?.name} ×${i.qty}`).join(', ')}</div>
                    {o.eta && ['ordered', 'processing', 'shipping'].includes(o.status) && (
                      <div className="text-muted text-xs">
                        ETA hari {dayOf(o.eta)} pukul {formatClock(o.eta)} {o.delayed && <span className="text-amber-300">(terlambat)</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[o.status]}>{PO_STATUS_LABELS[o.status]}</Badge>
                    {(o.status === 'ordered' || o.status === 'processing') && (
                      <Button size="sm" variant="danger" onClick={() => fb.show(act((s) => cancelOrder(s, o.id)), 'Pesanan dibatalkan; dana dikembalikan.')}>
                        Batalkan
                      </Button>
                    )}
                    {o.status === 'arrived' && (
                      <Button size="sm" variant="primary" onClick={() => fb.show(act((s) => receiveOrder(s, o.id)), `${o.id} diterima.`)}>
                        Terima
                      </Button>
                    )}
                  </div>
                </div>
                <ol className="mt-2 flex flex-wrap gap-1 text-[10px]">
                  {(['ordered', 'processing', 'shipping', 'arrived', 'received'] as PurchaseOrderStatus[]).map((st) => {
                    const order = ['ordered', 'processing', 'shipping', 'arrived', 'received'];
                    const reached = o.status !== 'cancelled' && order.indexOf(o.status) >= order.indexOf(st);
                    return (
                      <li key={st} className={`rounded px-1.5 py-0.5 ${reached ? 'bg-brand-700 text-white' : 'bg-ink-800 text-slate-400'}`}>
                        {PO_STATUS_LABELS[st]}
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecsTab() {
  const game = useGameState();
  const fb = useFeedback();
  const enabled = getEffects(game).computerLevel >= 1 || game.mode === 'learning';
  const hasManager = game.employees.some((e) => e.role === 'manager');
  if (!enabled) {
    return <Callout tone="warn" title="Rekomendasi terkunci">Beli peningkatan "Sistem Komputer Apotek" level 1 untuk mengaktifkan rekomendasi pengadaan berbasis aturan.</Callout>;
  }
  const recs = procurementRecommendations(game);
  const addAll = () => {
    for (const r of recs) {
      if (!r.supplierId) continue;
      const d = act((s) => createDraftOrder(s, r.supplierId!));
      if (d?.ok) act((s) => setOrderItem(s, d.value!.id, r.medicineId, r.suggestedQty));
    }
    fb.setMsg({ tone: 'success', text: 'Rekomendasi dimasukkan ke draf per pemasok. Tinjau lalu konfirmasi di tab Pemasok.' });
  };
  return (
    <div>
      {fb.node}
      <p className="text-muted mb-2 text-xs">
        Aturan: titik pesan ulang = stok minimum + (permintaan harian × waktu kirim). Jumlah saran menargetkan ±5 hari permintaan. Pemasok dipilih berdasarkan harga, dan kecepatan saat stok kritis.
      </p>
      {hasManager && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={game.pharmacy.autoReorder} onChange={(e) => fb.show(act((s) => setAutoReorder(s, e.target.checked)), e.target.checked ? 'Manajer akan memesan ulang otomatis.' : 'Pemesanan otomatis dimatikan.')} />
          Izinkan manajer memesan ulang secara otomatis (menyisakan kas Rp 500.000)
        </label>
      )}
      {recs.length === 0 ? (
        <Empty>Semua stok di atas titik pesan ulang.</Empty>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="text-muted text-left text-xs uppercase">
              <tr>
                <th className="py-1">Produk</th>
                <th>Stok</th>
                <th>Permintaan/hr</th>
                <th>Saran</th>
                <th>Pemasok</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => (
                <tr key={r.medicineId} className="border-t border-ink-700" title={r.reason}>
                  <td className="py-1.5">{game.medicines.find((m) => m.id === r.medicineId)?.name}</td>
                  <td className="tabular-nums">
                    {r.current}
                    {r.incoming ? ` (+${r.incoming})` : ''}
                  </td>
                  <td className="tabular-nums">{r.dailyDemand}</td>
                  <td className="tabular-nums">{r.suggestedQty}</td>
                  <td className="text-xs">{r.supplierId ? findSupplier(game, r.supplierId)?.name : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-right">
            <Button variant="primary" onClick={addAll}>
              Masukkan semua ke draf
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function ProcurementPanel() {
  const close = useUi((s) => s.closePanel);
  const game = useGameState();
  const [tab, setTab] = useState<Tab>('suppliers');
  const active = game.purchaseOrders.filter((o) => ['ordered', 'processing', 'shipping', 'arrived'].includes(o.status)).length;
  return (
    <Modal title="Komputer · Pengadaan" subtitle={`Kas ${formatMoney(game.money)} · ${active} pesanan aktif`} onClose={close} width="max-w-6xl" testId="panel-procurement">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'suppliers', label: 'Pemasok & Pemesanan' },
          { id: 'orders', label: `Status Pesanan (${active})` },
          { id: 'recs', label: 'Rekomendasi' },
        ]}
      />
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'recs' && <RecsTab />}
    </Modal>
  );
}
