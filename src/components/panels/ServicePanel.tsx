import { useEffect, useMemo, useState } from 'react';
import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Empty, Modal, NumberStepper, ProgressBar, Tabs, inputClass } from '@/components/ui/primitives';
import { useFeedback, useGameState, SimNote } from './shared';
import { PrescriptionWizard } from './PrescriptionWizard';
import {
  addToPatientCart,
  answerInfo,
  answerInquiry,
  askDetails,
  callNextPatient,
  CATEGORY_LABELS,
  declineOtc,
  findPatient,
  returnToQueue,
  sendToCheckout,
  STATUS_LABELS,
} from '@/domain/patients';
import { removeSaleItem, setSaleItemQty } from '@/domain/pos';
import { acceptCompoundingRequest, declineCompoundingRequest, findRecipe, missingIngredients, recipeAvailable } from '@/domain/compounding';
import { stockOf } from '@/domain/inventory';
import { isFeatureUnlocked } from '@/domain/progression';
import { tutorialSignal } from '@/domain/guidance';
import { CATEGORY_LABELS as MED_CATEGORY, INFO_TOPICS, SYMPTOM_PRODUCTS } from '@/data/medicines';
import { formatMoney } from '@/domain/time';
import { patientFarewell, patientLine } from '@/services/ai/aiService';
import type { GameState, Patient } from '@/domain/types';

function PatientCard({ p }: { p: Patient }) {
  const game = useGameState();
  const dialogue = useUi((s) => s.dialogue[p.id]);
  const setDialogue = useUi((s) => s.setDialogue);
  useEffect(() => {
    if (dialogue) return;
    let alive = true;
    void patientLine(game, p).then((d) => alive && setDialogue(p.id, d));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);
  const ratio = p.maxPatience ? p.patience / p.maxPatience : 1;
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-white" data-testid="active-patient-name">
            {p.name}
          </div>
          <div className="text-muted text-xs">
            {p.gender === 'L' ? 'Laki-laki' : 'Perempuan'}, {p.age} th · {p.paymentMethod === 'cash' ? 'Tunai' : p.paymentMethod === 'card' ? 'Kartu' : 'Digital'}
          </div>
        </div>
        <Badge tone={p.category === 'prescription' || p.category === 'refill' ? 'blue' : p.category === 'compounding' ? 'violet' : 'slate'}>{CATEGORY_LABELS[p.category]}</Badge>
      </div>
      <div className="mt-2">
        <div className="text-muted mb-1 flex justify-between text-[11px]">
          <span>Kesabaran</span>
          <span>{p.scripted ? 'skenario (tidak berkurang)' : `${Math.round(ratio * 100)}%`}</span>
        </div>
        <ProgressBar value={ratio * 100} tone={ratio > 0.6 ? 'green' : ratio > 0.3 ? 'amber' : 'red'} label="Kesabaran pasien" />
      </div>
      <div className="mt-3 rounded-lg bg-ink-900 px-3 py-2 text-sm text-slate-100" data-testid="patient-dialogue">
        💬 “{dialogue?.text ?? '…'}” {dialogue?.source === 'ai' && <span className="text-muted text-[10px]">(AI)</span>}
      </div>
      <div className="text-muted mt-2 text-xs">Kebutuhan: {p.need}</div>
    </div>
  );
}

function ProductPicker({ game, patient, onResult }: { game: GameState; patient: Patient; onResult: (r: ReturnType<typeof addToPatientCart> | undefined) => void }) {
  const [q, setQ] = useState('');
  const [qty, setQty] = useState(1);
  const list = useMemo(
    () =>
      game.medicines
        .filter((m) => m.active && m.category !== 'bahan-racik')
        .filter((m) => !q || `${m.name} ${m.genericName}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 40),
    [game.medicines, q],
  );
  return (
    <div>
      <div className="mb-2 flex gap-2">
        <input className={inputClass} placeholder="Cari produk (nama/generik)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari produk" data-testid="product-search" />
        <NumberStepper value={qty} onChange={setQty} min={1} max={10} label="Jumlah" />
      </div>
      <div className="scroll-thin max-h-64 space-y-1 overflow-y-auto pr-1">
        {list.map((m) => {
          const shelf = stockOf(game, m.id, 'shelf');
          return (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 px-2 py-1.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {m.name} {m.prescriptionOnly && <Badge tone="blue">Resep</Badge>}
                </div>
                <div className="text-muted text-xs">
                  {MED_CATEGORY[m.category]} · {formatMoney(m.sellPrice)}/{m.unit} · rak {shelf}
                </div>
              </div>
              <Button size="sm" disabled={shelf <= 0 || m.prescriptionOnly} title={m.prescriptionOnly ? 'Hanya melalui resep' : shelf <= 0 ? 'Stok rak kosong' : undefined} onClick={() => onResult(act((s) => addToPatientCart(s, patient.id, m.id, qty)))} data-testid={`add-${m.id}`}>
                + Tambah
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OtcService({ p }: { p: Patient }) {
  const game = useGameState();
  const fb = useFeedback();
  const [details, setDetails] = useState<string | null>(null);
  const sale = p.saleId ? game.sales.find((x) => x.id === p.saleId && x.status === 'open') : undefined;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        {fb.node}
        <div className="mb-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => {
            const r = act((s) => askDetails(s, p.id));
            if (r?.ok) setDetails(r.value ?? null);
          }}>
            ❓ Tanyakan detail
          </Button>
          <Button size="sm" variant="danger" onClick={() => fb.show(act((s) => declineOtc(s, p.id)), 'Pasien dipersilakan pergi.')}>
            Tidak tersedia / tolak
          </Button>
        </div>
        {details && <div className="mb-3 rounded-lg bg-ink-900 px-3 py-2 text-sm">💬 “{details}”</div>}
        {p.symptom && game.mode === 'learning' && (
          <div className="mb-3 rounded-lg border border-sky-800 bg-sky-950/40 px-3 py-2 text-xs text-sky-100">
            Petunjuk pelajaran: untuk keluhan “{SYMPTOM_PRODUCTS[p.symptom].label}”, aturan simulasi menganggap sesuai:{' '}
            {SYMPTOM_PRODUCTS[p.symptom].products.map((id) => game.medicines.find((m) => m.id === id)?.name).join(', ')}.
          </div>
        )}
        <ProductPicker game={game} patient={p} onResult={(r) => r && !r.ok && fb.show(r)} />
      </div>
      <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
        <div className="mb-2 font-semibold">Keranjang</div>
        {!sale || sale.items.length === 0 ? (
          <Empty>Belum ada produk.</Empty>
        ) : (
          <div className="space-y-2">
            {sale.items.map((it) => {
              const m = game.medicines.find((x) => x.id === it.medicineId);
              return (
                <div key={it.medicineId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 truncate">{m?.name}</div>
                  <div className="flex items-center gap-2">
                    <NumberStepper value={it.qty} min={0} max={20} label={m?.name} onChange={(v) => fb.show(act((s) => setSaleItemQty(s, sale.id, it.medicineId, v)))} />
                    <span className="w-24 text-right tabular-nums">{formatMoney(it.qty * it.unitPrice)}</span>
                    <Button size="sm" variant="ghost" aria-label="Hapus item" onClick={() => act((s) => removeSaleItem(s, sale.id, it.medicineId))}>
                      ✕
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="border-t border-ink-700 pt-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-emerald-300">
                  <span>Diskon promo</span>
                  <span className="tabular-nums">−{formatMoney(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(sale.total)}</span>
              </div>
            </div>
          </div>
        )}
        <Button
          variant="primary"
          className="mt-3 w-full"
          disabled={!sale || sale.items.length === 0}
          data-testid="send-checkout"
          onClick={() => {
            const r = act((s) => {
              const res = sendToCheckout(s, p.id);
              if (res.ok) tutorialSignal(s, 'sent-to-checkout');
              return res;
            });
            fb.show(r);
          }}
        >
          Kirim ke kasir →
        </Button>
      </div>
    </div>
  );
}

function InquiryService({ p }: { p: Patient }) {
  const game = useGameState();
  const fb = useFeedback();
  const med = game.medicines.find((m) => m.id === p.inquiryMedicineId);
  const [checked, setChecked] = useState(false);
  return (
    <div>
      {fb.node}
      <p className="mb-2 text-sm">
        Pasien menanyakan ketersediaan <strong>{med?.name}</strong>. Periksa stok (rak + gudang) sebelum menjawab.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setChecked(true)}>
          🔎 Cek stok di sistem
        </Button>
        {checked && med && (
          <span className="text-sm">
            Rak: <strong>{stockOf(game, med.id, 'shelf')}</strong> · Gudang: <strong>{stockOf(game, med.id, 'warehouse')}</strong> (stok layak)
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="success" onClick={() => {
          const r = act((s) => answerInquiry(s, p.id, true));
          if (r?.ok) fb.setMsg({ tone: r.value!.correct ? 'success' : 'error', text: r.value!.correct ? (r.value!.buys ? 'Benar! Pasien ingin membeli — tambahkan produk ke keranjang.' : 'Jawaban benar.') : 'Jawaban kurang tepat.' });
          else fb.show(r);
        }}>
          Ya, tersedia
        </Button>
        <Button variant="danger" onClick={() => {
          const r = act((s) => answerInquiry(s, p.id, false));
          if (r?.ok) fb.setMsg({ tone: r.value!.correct ? 'success' : 'error', text: r.value!.correct ? 'Jawaban benar.' : 'Jawaban kurang tepat.' });
          else fb.show(r);
        }}>
          Tidak tersedia
        </Button>
      </div>
    </div>
  );
}

function InfoService({ p }: { p: Patient }) {
  const fb = useFeedback();
  const topic = INFO_TOPICS.find((t) => t.id === p.infoTopicId);
  if (!topic) return null;
  return (
    <div>
      {fb.node}
      <p className="mb-2 text-sm font-medium">“{topic.question}”</p>
      <div className="flex flex-col gap-2">
        {topic.options.map((o, i) => (
          <Button key={o} className="justify-start text-left" onClick={() => {
            const r = act((s) => answerInfo(s, p.id, i));
            if (r?.ok) fb.setMsg({ tone: r.value!.correct ? 'success' : 'error', text: `${r.value!.correct ? 'Tepat.' : 'Kurang tepat.'} ${r.value!.explanation}` });
          }}>
            {o}
          </Button>
        ))}
      </div>
      <SimNote>Informasi umum untuk permainan, bukan saran medis.</SimNote>
    </div>
  );
}

function CompoundingIntake({ p }: { p: Patient }) {
  const game = useGameState();
  const fb = useFeedback();
  const recipeId = p.compoundingOrderId?.startsWith('pending:') ? p.compoundingOrderId.slice(8) : '';
  const recipe = findRecipe(recipeId);
  if (!recipe) return null;
  const unlocked = isFeatureUnlocked(game, 'compounding');
  const equip = recipeAvailable(game, recipe);
  const missing = missingIngredients(game, recipe);
  return (
    <div>
      {fb.node}
      <div className="rounded-lg border border-ink-600 p-3 text-sm">
        <div className="font-semibold">{recipe.name}</div>
        <div className="text-muted text-xs">{recipe.description}</div>
        <div className="mt-2 text-xs">Harga racikan: {formatMoney(recipe.price)} + jasa peracikan</div>
        <ul className="mt-2 space-y-0.5 text-xs">
          <li>{unlocked ? '✔' : '✖'} Laboratorium peracikan {unlocked ? 'tersedia' : 'belum terbuka (Level 3)'}</li>
          <li>{equip ? '✔' : '✖'} Peralatan {equip ? 'memadai' : 'belum memadai (Peralatan Racik Lanjutan)'}</li>
          <li>{missing.length === 0 ? '✔ Bahan tersedia' : `✖ Bahan kurang: ${missing.map((m) => game.medicines.find((x) => x.id === m.medicineId)?.name).join(', ')}`}</li>
        </ul>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={!unlocked || !equip || missing.length > 0} onClick={() => fb.show(act((s) => acceptCompoundingRequest(s, p.id)), 'Pesanan dibuat. Kerjakan di Meja Peracikan.')} data-testid="accept-compounding">
          Terima pesanan racikan
        </Button>
        <Button variant="danger" onClick={() => {
          const r = act((s) => declineCompoundingRequest(s, p.id));
          if (r?.ok) fb.setMsg({ tone: r.value!.justified ? 'info' : 'warn', text: r.value!.justified ? 'Penolakan wajar: racikan memang belum dapat dibuat.' : 'Racikan sebenarnya dapat dibuat. Pasien kecewa.' });
        }}>
          Tolak dengan sopan
        </Button>
      </div>
      <SimNote>{recipe.disclaimer}</SimNote>
    </div>
  );
}

function QueueList() {
  const game = useGameState();
  const fb = useFeedback();
  const waiting = game.queue.map((id) => findPatient(game, id)).filter(Boolean) as Patient[];
  const others = game.patients.filter((p) => p.status === 'checkout' || p.status === 'awaiting' || (p.status === 'serving' && p.servedBy !== 'player'));
  return (
    <div>
      {fb.node}
      {waiting.length === 0 ? (
        <Empty>{game.time.phase === 'open' ? 'Belum ada pasien dalam antrean.' : 'Apotek belum dibuka.'}</Empty>
      ) : (
        <ol className="space-y-1.5" data-testid="queue-list">
          {waiting.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 px-3 py-2 text-sm">
              <div>
                <span className="text-muted mr-2">#{i + 1}</span>
                <span className="font-medium">{p.name}</span> <Badge>{CATEGORY_LABELS[p.category]}</Badge>
                <div className="mt-1 w-40">
                  <ProgressBar value={p.patience} max={p.maxPatience} tone={p.patience / p.maxPatience > 0.6 ? 'green' : p.patience / p.maxPatience > 0.3 ? 'amber' : 'red'} label="Kesabaran" />
                </div>
              </div>
              <Button size="sm" variant="primary" disabled={!!game.activePatientId} onClick={() => fb.show(act((s) => callNextPatient(s, p.id)), 'Pasien dipanggil ke meja pelayanan.')}>
                Layani
              </Button>
            </li>
          ))}
        </ol>
      )}
      {others.length > 0 && (
        <div className="mt-4">
          <div className="text-muted mb-1 text-xs font-semibold uppercase">Pasien lain</div>
          <ul className="space-y-1 text-sm">
            {others.map((p) => (
              <li key={p.id} className="flex justify-between rounded border border-ink-700 px-2 py-1">
                <span>{p.name}</span>
                <span className="text-muted">
                  {STATUS_LABELS[p.status]}
                  {p.servedBy && p.servedBy !== 'player' ? ` · ${game.employees.find((e) => e.id === p.servedBy)?.name ?? 'pegawai'}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ServicePanel({ initialTab }: { initialTab?: string }) {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const [tab, setTab] = useState<'current' | 'queue'>(initialTab === 'queue' ? 'queue' : 'current');
  const fb = useFeedback();
  // Tetap tampilkan pasien yang baru selesai dilayani agar hasil (skor/validasi) terbaca.
  const [viewId, setViewId] = useState<string | null>(game.activePatientId);
  useEffect(() => {
    if (game.activePatientId) setViewId(game.activePatientId);
  }, [game.activePatientId]);
  const p = findPatient(game, game.activePatientId ?? viewId);
  const finished = !!p && p.status !== 'serving';
  return (
    <Modal title="Meja Pelayanan" subtitle={`Antrean: ${game.queue.length} pasien · ${game.time.phase === 'open' ? 'apotek buka' : 'apotek belum buka'}`} onClose={close} testId="panel-service">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'current', label: p ? `Melayani: ${p.name}` : 'Pasien saat ini' },
          { id: 'queue', label: `Antrean (${game.queue.length})` },
        ]}
      />
      {tab === 'queue' && <QueueList />}
      {tab === 'current' && (
        <>
          {fb.node}
          {!p ? (
            <div className="space-y-3">
              <Empty>Tidak ada pasien di meja pelayanan.</Empty>
              <div className="flex justify-center">
                <Button variant="primary" disabled={game.time.phase !== 'open' || game.queue.length === 0} onClick={() => fb.show(act((s) => callNextPatient(s)), 'Pasien dipanggil ke meja pelayanan.')} data-testid="call-next">
                  Panggil pasien berikutnya
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <div className="space-y-2">
                <PatientCard p={p} />
                {!finished && (
                  <Button size="sm" variant="ghost" onClick={() => fb.show(act((s) => returnToQueue(s, p.id)), 'Pasien dipersilakan menunggu kembali.')}>
                    ↩ Persilakan menunggu dulu
                  </Button>
                )}
              </div>
              <div>
                {finished && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-600 bg-brand-900/40 px-3 py-2 text-sm" role="status" data-testid="service-finished">
                    <span>
                      Pelayanan {p.name} selesai — status: <strong>{STATUS_LABELS[p.status]}</strong>
                      <span className="mt-0.5 block text-xs text-slate-200" data-testid="patient-farewell">
                        💬 “{patientFarewell(p)}”
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={game.queue.length === 0 || game.time.phase !== 'open'}
                      onClick={() => {
                        const r = act((s) => callNextPatient(s));
                        if (r?.ok) setViewId(r.value!.id);
                        else fb.show(r);
                      }}
                      data-testid="next-patient"
                    >
                      Pasien berikutnya →
                    </Button>
                  </div>
                )}
                {(p.category === 'otc' || p.category === 'canceller') && <OtcService p={p} />}
                {p.category === 'inquiry' && <InquiryService p={p} />}
                {p.category === 'info' && <InfoService p={p} />}
                {(p.category === 'prescription' || p.category === 'refill') && p.prescriptionId && <PrescriptionWizard key={p.prescriptionId} rxId={p.prescriptionId} />}
                {p.category === 'compounding' && <CompoundingIntake p={p} />}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
