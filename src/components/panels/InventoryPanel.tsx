import { useMemo, useState } from 'react';
import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Callout, Empty, Modal, NumberStepper, ProgressBar, Stat, Tabs, inputClass } from '@/components/ui/primitives';
import { BatchBadge, formatExpiry, SimNote, useFeedback, useGameState } from './shared';
import {
  adjustBatch,
  disposeBatch,
  fefoSort,
  inventoryDashboard,
  isExpired,
  LOCATION_LABELS,
  restockShelf,
  stockOf,
  transferBatch,
} from '@/domain/inventory';
import { receiveOrder, findSupplier } from '@/domain/procurement';
import { CATEGORY_LABELS } from '@/data/medicines';
import { formatClock, formatMoney } from '@/domain/time';
import { dayOf } from '@/domain/time';
import type { MedicineBatch, MedicineCategory, StockLocation } from '@/domain/types';

type Tab = 'stock' | 'receive' | 'dashboard' | 'history';

const TX_LABELS: Record<string, string> = {
  receive: 'Penerimaan',
  dispense: 'Resep',
  sale: 'Penjualan',
  compounding: 'Racikan',
  adjust: 'Penyesuaian',
  transfer: 'Pemindahan',
  'dispose-damaged': 'Musnah (rusak)',
  'dispose-expired': 'Musnah (ED)',
  return: 'Retur',
};

function BatchRow({ b, manage, onMsg }: { b: MedicineBatch; manage: boolean; onMsg: ReturnType<typeof useFeedback>['show'] }) {
  const game = useGameState();
  const [qty, setQty] = useState(b.qty);
  const [mode, setMode] = useState<null | 'move' | 'adjust' | 'damage'>(null);
  const [reason, setReason] = useState('');
  const expired = isExpired(b, game.time.day);
  const other: StockLocation = b.location === 'shelf' ? 'warehouse' : 'shelf';
  return (
    <div className="rounded-lg border border-ink-700 px-2 py-1.5 text-xs" data-testid={`batch-${b.batchNo}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-mono font-semibold">{b.batchNo}</span>
          <Badge tone={b.location === 'shelf' ? 'blue' : 'slate'}>{LOCATION_LABELS[b.location]}</Badge>
          <BatchBadge batch={b} day={game.time.day} />
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <span>
            Qty <strong>{b.qty}</strong>
          </span>
          <span>ED {formatExpiry(b, game.time.day)}</span>
          <span className="text-muted">HPP {formatMoney(b.unitCost)}</span>
        </span>
      </div>
      {manage && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {!expired && b.status === 'active' && (
            <Button size="sm" onClick={() => setMode(mode === 'move' ? null : 'move')}>
              Pindah ke {LOCATION_LABELS[other]}
            </Button>
          )}
          {expired && (
            <Button size="sm" variant="danger" data-testid={`dispose-${b.batchNo}`} onClick={() => onMsg(act((s) => disposeBatch(s, b.id, 'expired')), `Batch ${b.batchNo} dimusnahkan.`)}>
              Musnahkan (kedaluwarsa)
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setMode(mode === 'damage' ? null : 'damage')}>
            Stok rusak
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode(mode === 'adjust' ? null : 'adjust')}>
            Stock opname
          </Button>
        </div>
      )}
      {mode && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded bg-ink-850 p-2">
          <span>{mode === 'move' ? 'Jumlah dipindah' : mode === 'damage' ? 'Jumlah rusak' : 'Jumlah fisik'}</span>
          <NumberStepper value={qty} min={0} max={mode === 'adjust' ? 9999 : b.qty} onChange={setQty} label="Jumlah" />
          {mode === 'adjust' && <input className={`${inputClass} w-48`} placeholder="Alasan selisih (wajib)" value={reason} onChange={(e) => setReason(e.target.value)} />}
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const r =
                mode === 'move'
                  ? act((s) => transferBatch(s, b.id, qty, other))
                  : mode === 'damage'
                    ? act((s) => disposeBatch(s, b.id, 'damaged', qty))
                    : act((s) => adjustBatch(s, b.id, qty, reason));
              if (onMsg(r, 'Perubahan stok dicatat.')) setMode(null);
            }}
          >
            Konfirmasi
          </Button>
        </div>
      )}
    </div>
  );
}

function StockTab({ manage, location, category, refrigerated }: { manage: boolean; location?: StockLocation; category?: string; refrigerated?: boolean }) {
  const game = useGameState();
  const fb = useFeedback();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>(category ?? 'all');
  const [loc, setLoc] = useState<StockLocation | 'any'>(location ?? 'any');
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const day = game.time.day;
  const meds = useMemo(
    () =>
      game.medicines.filter(
        (m) =>
          m.active &&
          (cat === 'all' || m.category === cat) &&
          (!refrigerated || m.refrigerated) &&
          (!q || `${m.name} ${m.genericName}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [game.medicines, cat, q, refrigerated],
  );
  return (
    <div>
      {fb.node}
      {!manage && <Callout tone="info">Mode lihat saja. Buka Lemari Gudang atau Rak Obat (atau aktifkan Akses cepat) untuk mengelola stok.</Callout>}
      <div className="my-3 flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-xs`} placeholder="Cari obat…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari obat" />
        <select className={`${inputClass} w-auto`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
          <option value="all">Semua kategori</option>
          {(Object.keys(CATEGORY_LABELS) as MedicineCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select className={`${inputClass} w-auto`} value={loc} onChange={(e) => setLoc(e.target.value as StockLocation | 'any')} aria-label="Lokasi">
          <option value="any">Semua lokasi</option>
          <option value="shelf">Rak Pelayanan</option>
          <option value="warehouse">Gudang</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} /> Hanya bermasalah
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-muted text-left text-xs uppercase">
            <tr>
              <th className="py-1">Obat</th>
              <th>Rak</th>
              <th>Gudang</th>
              <th>Min</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => {
              const shelf = stockOf(game, m.id, 'shelf');
              const wh = stockOf(game, m.id, 'warehouse');
              const batches = game.batches.filter((b) => b.medicineId === m.id && b.status !== 'disposed' && b.qty > 0 && (loc === 'any' || b.location === loc)).sort(fefoSort);
              const hasExpired = batches.some((b) => isExpired(b, day));
              const low = shelf + wh < m.minStock;
              const shelfLow = shelf < m.minStock && wh > 0;
              if (problemsOnly && !hasExpired && !low && !shelfLow) return null;
              if (loc !== 'any' && batches.length === 0 && problemsOnly) return null;
              return (
                <tr key={m.id} className="border-t border-ink-700 align-top">
                  <td className="py-1.5">
                    <button type="button" className="text-left hover:underline" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-muted text-xs">
                        {CATEGORY_LABELS[m.category]} · {m.unit}
                      </div>
                    </button>
                    {open === m.id && (
                      <div className="mt-2 space-y-1" data-testid={`batches-${m.id}`}>
                        {batches.length === 0 ? <div className="text-muted text-xs">Tidak ada batch.</div> : batches.map((b) => <BatchRow key={b.id} b={b} manage={manage} onMsg={fb.show} />)}
                      </div>
                    )}
                  </td>
                  <td className="tabular-nums">{shelf}</td>
                  <td className="tabular-nums">{wh}</td>
                  <td className="tabular-nums">{m.minStock}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {shelf + wh === 0 && <Badge tone="red">Habis</Badge>}
                      {low && shelf + wh > 0 && <Badge tone="amber">Stok rendah</Badge>}
                      {hasExpired && <Badge tone="red">Ada ED</Badge>}
                      {m.refrigerated && <Badge tone="blue">Dingin</Badge>}
                    </div>
                  </td>
                  <td className="text-right">
                    {manage && wh > 0 && (
                      <Button size="sm" onClick={() => fb.show(act((s) => restockShelf(s, m.id)), `Rak ${m.name} diisi ulang.`)} data-testid={`restock-${m.id}`}>
                        Isi rak
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SimNote />
    </div>
  );
}

function ReceiveTab({ manage }: { manage: boolean }) {
  const game = useGameState();
  const fb = useFeedback();
  const arrived = game.purchaseOrders.filter((o) => o.status === 'arrived');
  const incoming = game.purchaseOrders.filter((o) => ['ordered', 'processing', 'shipping'].includes(o.status));
  return (
    <div>
      {fb.node}
      <div className="text-muted mb-1 text-xs font-semibold uppercase">Kiriman tiba</div>
      {arrived.length === 0 ? (
        <Empty>Tidak ada kiriman yang menunggu diterima.</Empty>
      ) : (
        <ul className="space-y-2">
          {arrived.map((o) => (
            <li key={o.id} className="rounded-lg border border-ink-700 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {o.id} · {findSupplier(game, o.supplierId)?.name}
                  </div>
                  <div className="text-muted text-xs">{o.items.map((i) => `${game.medicines.find((m) => m.id === i.medicineId)?.name} ×${i.qty}`).join(', ')}</div>
                </div>
                <Button variant="primary" disabled={!manage} onClick={() => fb.show(act((s) => receiveOrder(s, o.id)), `${o.id} diterima ke gudang.`)} data-testid={`receive-${o.id}`}>
                  Terima ke gudang
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="text-muted mb-1 mt-4 text-xs font-semibold uppercase">Dalam perjalanan</div>
      {incoming.length === 0 ? (
        <div className="text-muted text-sm">Tidak ada.</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {incoming.map((o) => (
            <li key={o.id} className="flex justify-between rounded border border-ink-700 px-2 py-1">
              <span>
                {o.id} · {findSupplier(game, o.supplierId)?.name}
              </span>
              <span className="text-muted">
                ETA hari {o.eta ? dayOf(o.eta) : '?'} {o.eta ? formatClock(o.eta) : ''} {o.delayed && '(terlambat)'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardTab() {
  const game = useGameState();
  const d = inventoryDashboard(game);
  const name = (id: string) => game.medicines.find((m) => m.id === id)?.name ?? id;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Jenis obat" value={d.medicineTypes} />
        <Stat label="Total unit layak" value={d.totalUnits.toLocaleString('id-ID')} />
        <Stat label="Nilai persediaan" value={formatMoney(d.stockValue)} />
        <Stat label="Hampir ED (≤30 hr)" value={d.nearExpiry} tone={d.nearExpiry ? 'warn' : undefined} />
        <Stat label="Batch kedaluwarsa" value={d.expired} tone={d.expired ? 'bad' : 'good'} hint={d.expired ? `Nilai ${formatMoney(d.expiredValue)}` : undefined} />
        <Stat label="Stok rendah" value={d.lowStock.length} tone={d.lowStock.length ? 'warn' : undefined} />
        <Stat label="Habis" value={d.outOfStock.length} tone={d.outOfStock.length ? 'bad' : undefined} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-sm">
            Kapasitas rak: {d.shelfUsed} / {d.shelfCapacity}
          </div>
          <ProgressBar value={d.shelfUsed} max={d.shelfCapacity} tone={d.shelfUsed / d.shelfCapacity > 0.9 ? 'red' : 'brand'} label="Kapasitas rak" />
        </div>
        <div>
          <div className="mb-1 text-sm">
            Kapasitas gudang: {d.warehouseUsed} / {d.warehouseCapacity}
          </div>
          <ProgressBar value={d.warehouseUsed} max={d.warehouseCapacity} tone={d.warehouseUsed / d.warehouseCapacity > 0.9 ? 'red' : 'brand'} label="Kapasitas gudang" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-muted mb-1 text-xs font-semibold uppercase">Stok rendah</div>
          <ul className="space-y-0.5 text-sm">
            {d.lowStock.map((l) => (
              <li key={l.medicineId}>
                {name(l.medicineId)} — {l.qty}/{l.min}
              </li>
            ))}
            {d.lowStock.length === 0 && <li className="text-muted">—</li>}
          </ul>
        </div>
        <div>
          <div className="text-muted mb-1 text-xs font-semibold uppercase">Habis</div>
          <ul className="space-y-0.5 text-sm">
            {d.outOfStock.map((id) => (
              <li key={id}>{name(id)}</li>
            ))}
            {d.outOfStock.length === 0 && <li className="text-muted">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function HistoryTab() {
  const game = useGameState();
  const [type, setType] = useState('all');
  const list = game.inventoryTx.filter((t) => type === 'all' || t.type === type).slice(-120).reverse();
  return (
    <div>
      <select className={`${inputClass} mb-2 w-auto`} value={type} onChange={(e) => setType(e.target.value)} aria-label="Jenis transaksi">
        <option value="all">Semua jenis</option>
        {Object.entries(TX_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {list.length === 0 ? (
        <Empty>Belum ada riwayat.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead className="text-muted text-left uppercase">
              <tr>
                <th className="py-1">Waktu</th>
                <th>Jenis</th>
                <th>Obat</th>
                <th>Batch</th>
                <th>Lokasi</th>
                <th className="text-right">Δ Qty</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-ink-800">
                  <td className="py-1">
                    H{dayOf(t.at)} {formatClock(t.at)}
                  </td>
                  <td>{TX_LABELS[t.type]}</td>
                  <td>{game.medicines.find((m) => m.id === t.medicineId)?.name}</td>
                  <td className="font-mono">{game.batches.find((b) => b.id === t.batchId)?.batchNo ?? t.batchId}</td>
                  <td>{LOCATION_LABELS[t.location]}</td>
                  <td className={`text-right tabular-nums ${t.qtyDelta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{t.qtyDelta > 0 ? `+${t.qtyDelta}` : t.qtyDelta}</td>
                  <td className="text-muted">{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function InventoryPanel({ manage, location, category, refrigerated, initialTab }: { manage: boolean; location?: StockLocation; category?: string; refrigerated?: boolean; initialTab?: string }) {
  const close = useUi((s) => s.closePanel);
  const game = useGameState();
  const arrived = game.purchaseOrders.filter((o) => o.status === 'arrived').length;
  const [tab, setTab] = useState<Tab>(initialTab === 'receive' && arrived > 0 ? 'receive' : 'stock');
  const title = refrigerated ? 'Lemari Pendingin' : category === 'bahan-racik' ? 'Rak Bahan Racik' : location === 'warehouse' ? 'Gudang' : location === 'shelf' ? 'Rak Pelayanan' : 'Inventaris';
  return (
    <Modal title={title} subtitle={manage ? 'Mode kelola' : 'Mode lihat'} onClose={close} testId="panel-inventory">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'stock', label: 'Stok & Batch' },
          { id: 'receive', label: `Penerimaan${arrived ? ` (${arrived})` : ''}` },
          { id: 'dashboard', label: 'Dasbor' },
          { id: 'history', label: 'Riwayat' },
        ]}
      />
      {tab === 'stock' && <StockTab manage={manage} location={location} category={category} refrigerated={refrigerated} />}
      {tab === 'receive' && <ReceiveTab manage={manage} />}
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'history' && <HistoryTab />}
    </Modal>
  );
}
