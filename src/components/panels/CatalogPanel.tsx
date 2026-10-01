import { useMemo, useState } from 'react';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Modal, inputClass } from '@/components/ui/primitives';
import { BatchBadge, formatExpiry, SimNote, useGameState } from './shared';
import { fefoSort, LOCATION_LABELS, stockOf } from '@/domain/inventory';
import { CATEGORY_LABELS } from '@/data/medicines';
import { formatMoney } from '@/domain/time';
import type { MedicineCategory } from '@/domain/types';

export function CatalogPanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const openPanel = useUi((s) => s.openPanel);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [sel, setSel] = useState<string | null>(null);
  const list = useMemo(
    () => game.medicines.filter((m) => (cat === 'all' || m.category === cat) && (!q || `${m.name} ${m.genericName}`.toLowerCase().includes(q.toLowerCase()))),
    [game.medicines, cat, q],
  );
  const med = game.medicines.find((m) => m.id === sel);
  return (
    <Modal title="Katalog Obat" subtitle={`${game.medicines.length} produk · data contoh simulasi`} onClose={close} testId="panel-catalog">
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-xs`} placeholder="Cari nama / generik…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari katalog" />
        <select className={`${inputClass} w-auto`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter kategori">
          <option value="all">Semua kategori</option>
          {(Object.keys(CATEGORY_LABELS) as MedicineCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <ul className="scroll-thin max-h-[60vh] space-y-1 overflow-y-auto pr-1">
          {list.map((m) => {
            const total = stockOf(game, m.id, 'any');
            return (
              <li key={m.id}>
                <button type="button" onClick={() => setSel(m.id)} className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${sel === m.id ? 'border-brand-400 bg-brand-900/40' : 'border-ink-700 hover:bg-ink-800'}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="text-muted text-xs">
                      {m.genericName} · {CATEGORY_LABELS[m.category]}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="tabular-nums">{m.category === 'bahan-racik' ? '—' : formatMoney(m.sellPrice)}</span>
                    <Badge tone={total === 0 ? 'red' : total < m.minStock ? 'amber' : 'green'}>{total === 0 ? 'Habis' : `Stok ${total}`}</Badge>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="rounded-xl border border-ink-600 bg-ink-850 p-3 text-sm">
          {!med ? (
            <div className="text-muted">Pilih produk untuk melihat detail.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-base font-semibold text-white">{med.name}</div>
              <div className="flex flex-wrap gap-1">
                <Badge>{CATEGORY_LABELS[med.category]}</Badge>
                {med.prescriptionOnly && <Badge tone="blue">Hanya dengan resep</Badge>}
                {med.refrigerated && <Badge tone="blue">Rantai dingin</Badge>}
                <Badge tone="amber">{med.dataStatus === 'contoh-simulasi' ? 'Contoh simulasi' : 'Terverifikasi'}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted">Nama generik</dt>
                <dd>{med.genericName}</dd>
                <dt className="text-muted">Kekuatan</dt>
                <dd>{med.strength}</dd>
                <dt className="text-muted">Bentuk sediaan</dt>
                <dd>{med.form}</dd>
                <dt className="text-muted">Satuan</dt>
                <dd>{med.unit}</dd>
                <dt className="text-muted">Harga beli (dasar)</dt>
                <dd>{formatMoney(med.buyPrice)}</dd>
                <dt className="text-muted">Harga jual</dt>
                <dd>{med.category === 'bahan-racik' ? 'tidak dijual langsung' : formatMoney(med.sellPrice)}</dd>
                <dt className="text-muted">Stok minimum</dt>
                <dd>{med.minStock}</dd>
                <dt className="text-muted">Stok rak / gudang</dt>
                <dd>
                  {stockOf(game, med.id, 'shelf')} / {stockOf(game, med.id, 'warehouse')}
                </dd>
              </dl>
              <p className="text-muted text-xs">{med.description}</p>
              <div className="text-muted text-xs font-semibold uppercase">Batch</div>
              <ul className="space-y-1">
                {game.batches
                  .filter((b) => b.medicineId === med.id && b.status !== 'disposed' && b.qty > 0)
                  .sort(fefoSort)
                  .map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-1 rounded border border-ink-700 px-2 py-1 text-xs">
                      <span className="font-mono">{b.batchNo}</span>
                      <span>{LOCATION_LABELS[b.location]}</span>
                      <span>×{b.qty}</span>
                      <span className="text-muted">{formatExpiry(b, game.time.day)}</span>
                      <BatchBadge batch={b} day={game.time.day} />
                    </li>
                  ))}
              </ul>
              <Button size="sm" onClick={() => openPanel('inventory', { category: med.category })}>
                Buka di inventaris
              </Button>
            </div>
          )}
        </div>
      </div>
      <SimNote />
    </Modal>
  );
}
