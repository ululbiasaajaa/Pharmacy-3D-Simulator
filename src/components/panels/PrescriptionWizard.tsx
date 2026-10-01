import { useMemo, useState } from 'react';
import { act } from '@/stores/gameStore';
import { Badge, Button, Callout, ConfirmDialog, NumberStepper, inputClass } from '@/components/ui/primitives';
import { BatchBadge, formatExpiry, SimNote, useGameState } from './shared';
import {
  confirmWithPrescriber,
  dispensePrescription,
  findPrescription,
  ISSUE_LABELS,
  precheckDispense,
  rejectPrescription,
  reportIssue,
  RESOLVABLE_ISSUES,
  scoreFromIssues,
} from '@/domain/prescriptions';
import { daysToExpiry, fefoSort, recommendBatch } from '@/domain/inventory';
import { LABEL_INSTRUCTION_OPTIONS } from '@/data/prescriptionTemplates';
import { formatDay } from '@/domain/time';
import type { DispenseDraft, DispenseLine, PrescriptionIssueKind, ValidationIssue } from '@/domain/types';

const STEPS = ['Resep', 'Kelengkapan', 'Penyiapan', 'Etiket', 'Serahkan'] as const;
type Step = (typeof STEPS)[number];

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return <Callout tone="success">Tidak ditemukan masalah. Siap diserahkan.</Callout>;
  return (
    <ul className="space-y-1.5" data-testid="validation-issues">
      {issues.map((i, idx) => (
        <li key={idx} className={`rounded-lg border px-3 py-2 text-sm ${i.severity === 'error' ? 'border-rose-700 bg-rose-950/50' : i.severity === 'warning' ? 'border-amber-700 bg-amber-950/50' : 'border-sky-800 bg-sky-950/40'}`}>
          <div className="font-medium">
            {i.severity === 'error' ? '✖ Kesalahan' : i.severity === 'warning' ? '⚠ Peringatan' : 'ℹ Info'}: {i.message}
          </div>
          <div className="text-muted text-xs">Tindakan: {i.action}</div>
        </li>
      ))}
    </ul>
  );
}

export function PrescriptionWizard({ rxId }: { rxId: string }) {
  const game = useGameState();
  const rx = findPrescription(game, rxId);
  const [step, setStep] = useState<Step>('Resep');
  const [draft, setDraft] = useState<DispenseDraft>(() => ({
    prescriptionId: rxId,
    completenessChecked: false,
    labelPrepared: false,
    reportedIssue: null,
    lines: [],
  }));
  const [issueKind, setIssueKind] = useState<PrescriptionIssueKind>('missing-instructions');
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info' | 'warn'; text: string } | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!rx) return <Callout tone="error">Resep tidak ditemukan.</Callout>;
  const done = rx.status === 'dispensed' || rx.status === 'rejected';

  const lineFor = (idx: number): DispenseLine =>
    draft.lines.find((l) => l.itemIndex === idx) ?? { itemIndex: idx, medicineId: '', batchId: '', qty: 0, instructions: '' };
  const setLine = (idx: number, patch: Partial<DispenseLine>) =>
    setDraft((d) => {
      const others = d.lines.filter((l) => l.itemIndex !== idx);
      const cur = d.lines.find((l) => l.itemIndex === idx) ?? { itemIndex: idx, medicineId: '', batchId: '', qty: 0, instructions: '' };
      return { ...d, labelPrepared: patch.instructions !== undefined ? false : d.labelPrepared, lines: [...others, { ...cur, ...patch }].sort((a, b) => a.itemIndex - b.itemIndex) };
    });

  return (
    <div data-testid="rx-wizard">
      <ol className="mb-3 flex flex-wrap gap-1 text-xs" aria-label="Langkah pelayanan resep">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(s)}
              aria-current={step === s ? 'step' : undefined}
              className={`rounded-md px-2 py-1 font-medium ${step === s ? 'bg-brand-600 text-white' : 'bg-ink-800 text-slate-300 hover:bg-ink-700'}`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>
      {message && (
        <div className="mb-3">
          <Callout tone={message.tone}>{message.text}</Callout>
        </div>
      )}
      {done && <Callout tone={rx.status === 'dispensed' ? 'success' : 'info'}>{rx.status === 'dispensed' ? `Resep telah diserahkan (skor ${rx.score}). Pasien menuju kasir.` : 'Resep ditolak.'}</Callout>}

      {step === 'Resep' && (
        <div className="rounded-xl bg-[#fbfaf3] p-4 font-serif text-sm text-slate-900 shadow-inner" data-testid="rx-paper">
          <div className="flex justify-between border-b border-slate-300 pb-2">
            <div>
              <div className="font-bold">{rx.clinic}</div>
              <div>{rx.prescriber ?? <span className="italic text-rose-700">— (tidak tertulis)</span>}</div>
            </div>
            <div className="text-right text-xs">
              <div>No. {rx.id}</div>
              <div>Tgl. {formatDay(rx.writtenDay)}</div>
              {rx.isRefill && <div className="font-semibold">Salinan resep · iter tersisa: {rx.iterRemaining}×</div>}
            </div>
          </div>
          <ul className="mt-3 space-y-3">
            {rx.items.map((it, i) => {
              const med = game.medicines.find((m) => m.id === it.medicineId);
              return (
                <li key={i}>
                  <div className="font-semibold">
                    R/ {it.writtenName} — {it.strength}, {it.form}
                  </div>
                  <div>
                    No. {it.qty} {med?.unit}
                  </div>
                  <div className="italic">S. {it.instructions || <span className="text-rose-700">— (tidak tertulis)</span>}</div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-slate-300 pt-2 text-xs">
            Pro: {rx.patientName} · Umur: {rx.patientAge ?? <span className="text-rose-700">— (tidak tertulis)</span>}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">{rx.notes} Resep fiktif — bukan rekomendasi medis.</div>
          <div className="mt-3 text-right font-sans">
            <Button size="sm" variant="primary" onClick={() => setStep('Kelengkapan')}>
              Lanjut ke pemeriksaan →
            </Button>
          </div>
        </div>
      )}

      {step === 'Kelengkapan' && (
        <div className="space-y-3 text-sm">
          <p>Periksa resep pada langkah 1. Apakah informasi berikut lengkap dan sah?</p>
          <ul className="text-muted list-disc space-y-0.5 pl-5 text-xs">
            <li>Identitas pasien (nama & umur)</li>
            <li>Identitas/paraf penulis resep</li>
            <li>Kekuatan & bentuk sediaan tersedia di katalog</li>
            <li>Aturan pakai tertulis untuk setiap item</li>
            <li>Untuk tebus ulang: jatah iter masih ada</li>
          </ul>
          {draft.completenessChecked && <Callout tone="success">Pemeriksaan kelengkapan dicatat.</Callout>}
          {rx.status === 'on-hold' && rx.hiddenIssue && RESOLVABLE_ISSUES.includes(rx.hiddenIssue) && (
            <Button
              variant="primary"
              onClick={() => {
                const r = act((s) => confirmWithPrescriber(s, rx.id));
                if (r?.ok) {
                  setDraft((d) => ({ ...d, completenessChecked: true }));
                  setMessage({ tone: 'success', text: 'Konfirmasi diterima (simulasi). Resep diperbarui; lanjutkan penyiapan.' });
                }
              }}
              data-testid="confirm-prescriber"
            >
              📞 Konfirmasi ke penulis resep
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="success"
              disabled={done || draft.completenessChecked}
              onClick={() => {
                setDraft((d) => ({ ...d, completenessChecked: true, reportedIssue: 'none' }));
                setStep('Penyiapan');
              }}
              data-testid="rx-complete"
            >
              ✔ Resep lengkap
            </Button>
            <select className={`${inputClass} w-auto`} value={issueKind} onChange={(e) => setIssueKind(e.target.value as PrescriptionIssueKind)} aria-label="Jenis masalah">
              {(Object.keys(ISSUE_LABELS) as PrescriptionIssueKind[]).map((k) => (
                <option key={k} value={k}>
                  {ISSUE_LABELS[k]}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={done || rx.status === 'on-hold'}
              onClick={() => {
                const r = act((s) => reportIssue(s, rx.id, issueKind));
                if (!r) return;
                if (!r.ok) setMessage({ tone: 'error', text: r.error });
                else if (r.value!.correct)
                  setMessage({ tone: 'success', text: r.value!.resolvable ? 'Masalah ditemukan! Lakukan konfirmasi ke penulis resep.' : 'Masalah ditemukan! Resep tidak dapat dilayani — tolak resep dengan penjelasan.' });
                else setMessage({ tone: 'warn', text: 'Laporan tidak tepat untuk resep ini. Pasien harus menunggu lebih lama.' });
                setDraft((d) => ({ ...d, reportedIssue: issueKind }));
              }}
              data-testid="report-issue"
            >
              ⚠ Laporkan masalah
            </Button>
            <Button variant="danger" disabled={done} onClick={() => setConfirmReject(true)} data-testid="reject-rx">
              Tolak resep
            </Button>
          </div>
        </div>
      )}

      {step === 'Penyiapan' && (
        <div className="space-y-4">
          {rx.items.map((it, idx) => (
            <PrepareItem key={idx} idx={idx} item={it} line={lineFor(idx)} onChange={(patch) => setLine(idx, patch)} />
          ))}
          <div className="text-right">
            <Button variant="primary" onClick={() => setStep('Etiket')}>
              Lanjut ke etiket →
            </Button>
          </div>
        </div>
      )}

      {step === 'Etiket' && (
        <div className="space-y-4">
          {rx.items.map((it, idx) => {
            const line = lineFor(idx);
            const med = game.medicines.find((m) => m.id === line.medicineId);
            return (
              <div key={idx} className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm font-medium">Aturan pakai item {idx + 1}</div>
                  <select className={inputClass} value={line.instructions} onChange={(e) => setLine(idx, { instructions: e.target.value })} aria-label={`Aturan pakai item ${idx + 1}`} data-testid={`label-select-${idx}`}>
                    <option value="">— pilih aturan pakai —</option>
                    {LABEL_INSTRUCTION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <div className="text-muted mt-1 text-xs">Resep: “{it.instructions || '—'}”</div>
                </div>
                <div className="print-area rounded-lg border-2 border-sky-700 bg-white p-3 text-xs text-slate-900" aria-label="Pratinjau etiket">
                  <div className="text-center font-bold">APOTEK {game.profile.pharmacyName.toUpperCase()}</div>
                  <div className="text-center text-[10px]">Etiket simulasi · {formatDay(game.time.day)}</div>
                  <div className="mt-1 border-t border-slate-300 pt-1">No. {rx.id} · {rx.patientName}</div>
                  <div className="font-semibold">{med?.name ?? '(produk belum dipilih)'} — {line.qty || 0} {med?.unit ?? ''}</div>
                  <div className="mt-1 text-sm font-bold">{line.instructions || '(aturan pakai)'}</div>
                  {med?.refrigerated && <div className="mt-1 text-[10px] font-semibold text-blue-700">Simpan di lemari pendingin</div>}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => window.print()}>🖨 Cetak etiket</Button>
            <Button
              variant="primary"
              disabled={rx.items.some((_, i) => !lineFor(i).instructions)}
              onClick={() => {
                setDraft((d) => ({ ...d, labelPrepared: true }));
                setStep('Serahkan');
              }}
              data-testid="label-ready"
            >
              ✔ Etiket siap
            </Button>
          </div>
        </div>
      )}

      {step === 'Serahkan' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone={draft.completenessChecked ? 'green' : 'red'}>{draft.completenessChecked ? '✔' : '✖'} Kelengkapan</Badge>
            <Badge tone={draft.lines.length === rx.items.length ? 'green' : 'red'}>
              {draft.lines.length}/{rx.items.length} item disiapkan
            </Badge>
            <Badge tone={draft.labelPrepared ? 'green' : 'red'}>{draft.labelPrepared ? '✔' : '✖'} Etiket</Badge>
          </div>
          {issues && (
            <>
              <IssueList issues={issues} />
              <div className="text-muted text-xs">Perkiraan skor: {scoreFromIssues(issues)}</div>
            </>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={done} onClick={() => setIssues(act((s) => precheckDispense(s, draft)) ?? null)} title={game.mode === 'learning' ? undefined : 'Pemeriksaan ulang memakan sedikit waktu pasien'} data-testid="precheck">
              🔍 Periksa ulang{game.mode !== 'learning' ? ' (−waktu)' : ''}
            </Button>
            <Button
              variant="primary"
              disabled={done || busy}
              data-testid="dispense"
              onClick={() => {
                setBusy(true);
                const r = act((s) => dispensePrescription(s, draft));
                setBusy(false);
                if (!r) return;
                if (!r.ok) {
                  setMessage({ tone: 'error', text: r.error });
                  return;
                }
                setIssues(r.value!.issues);
                const errors = r.value!.issues.filter((i) => i.severity === 'error').length;
                setMessage(errors ? { tone: 'error', text: `${r.message} (${errors} kesalahan)` } : { tone: 'success', text: `${r.message} Skor: ${r.value!.score}.` });
              }}
            >
              💊 Serahkan obat
            </Button>
          </div>
        </div>
      )}
      <SimNote>Resep, obat, dan aturan pakai adalah contoh fiktif untuk simulasi alur kerja.</SimNote>
      {confirmReject && (
        <ConfirmDialog
          title="Tolak resep?"
          message="Tolak hanya jika resep tidak dapat dilayani (mis. tidak sah atau jatah iter habis). Penolakan yang tidak perlu menurunkan reputasi."
          danger
          confirmLabel="Tolak resep"
          onCancel={() => setConfirmReject(false)}
          onConfirm={() => {
            setConfirmReject(false);
            const r = act((s) => rejectPrescription(s, rx.id));
            if (r?.ok) setMessage({ tone: r.value!.correct ? 'success' : 'error', text: r.value!.correct ? 'Penolakan tepat. Pasien diberi penjelasan.' : 'Resep sebenarnya dapat dilayani — reputasi turun.' });
          }}
        />
      )}
    </div>
  );
}

function PrepareItem({ idx, item, line, onChange }: { idx: number; item: { writtenName: string; strength: string; form: string; qty: number; medicineId: string }; line: DispenseLine; onChange: (p: Partial<DispenseLine>) => void }) {
  const game = useGameState();
  const [q, setQ] = useState('');
  const options = useMemo(
    () => game.medicines.filter((m) => m.active && m.category !== 'bahan-racik' && (!q || `${m.name} ${m.genericName}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 30),
    [game.medicines, q],
  );
  const med = game.medicines.find((m) => m.id === line.medicineId);
  const batches = line.medicineId ? game.batches.filter((b) => b.medicineId === line.medicineId && b.location === 'shelf' && b.status !== 'disposed' && b.qty > 0).sort(fefoSort) : [];
  const rec = line.medicineId ? recommendBatch(game, line.medicineId, line.qty || item.qty) : null;
  return (
    <div className="rounded-xl border border-ink-600 p-3" data-testid={`prepare-item-${idx}`}>
      <div className="mb-2 text-sm" data-testid={`prepare-header-${idx}`}>
        <span className="font-semibold">Item {idx + 1}:</span> {item.writtenName} · {item.strength} · {item.form} · No. {item.qty}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-muted mb-1 text-xs font-semibold uppercase">1. Pilih produk</div>
          <input className={inputClass} placeholder="Cari di katalog…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Cari produk item ${idx + 1}`} />
          <select className={`${inputClass} mt-1`} value={line.medicineId} onChange={(e) => onChange({ medicineId: e.target.value, batchId: '' })} aria-label={`Produk item ${idx + 1}`} data-testid={`product-select-${idx}`}>
            <option value="">— pilih produk —</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.strength}, {m.form})
              </option>
            ))}
          </select>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-muted text-xs font-semibold uppercase">3. Jumlah</span>
            <NumberStepper value={line.qty} min={0} max={50} onChange={(v) => onChange({ qty: v })} label={`Jumlah item ${idx + 1}`} />
            <span className="text-muted text-xs">{med?.unit}</span>
          </div>
        </div>
        <div>
          <div className="text-muted mb-1 text-xs font-semibold uppercase">2. Pilih batch (rak)</div>
          {!line.medicineId ? (
            <div className="text-muted text-xs">Pilih produk terlebih dahulu.</div>
          ) : batches.length === 0 ? (
            <Callout tone="warn">{rec?.reason ?? 'Tidak ada batch di rak.'}</Callout>
          ) : (
            <div className="space-y-1">
              {rec && <div className="rounded border border-brand-700 bg-brand-900/40 px-2 py-1 text-xs">Rekomendasi sistem: {rec.reason}</div>}
              {batches.map((b) => {
                const disabled = b.status !== 'active' || daysToExpiry(b, game.time.day) <= 0;
                return (
                  <label key={b.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded border px-2 py-1 text-xs ${line.batchId === b.id ? 'border-brand-400 bg-brand-900/40' : 'border-ink-700'} ${disabled ? 'opacity-60' : ''}`}>
                    <span className="flex items-center gap-2">
                      <input type="radio" name={`batch-${idx}`} checked={line.batchId === b.id} onChange={() => onChange({ batchId: b.id })} disabled={disabled} />
                      <span className="font-mono">{b.batchNo}</span>
                      {rec?.batch?.id === b.id && <Badge tone="green">FEFO</Badge>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span>stok {b.qty}</span>
                      <span className="text-muted">ED {formatExpiry(b, game.time.day)}</span>
                      <BatchBadge batch={b} day={game.time.day} />
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
