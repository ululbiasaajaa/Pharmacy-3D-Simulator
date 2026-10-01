import { useEffect, useMemo, useRef, useState } from 'react';
import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Callout, Empty, Modal, NumberStepper, ProgressBar } from '@/components/ui/primitives';
import { FeatureLock, SimNote, useFeedback, useGameState } from './shared';
import {
  createCompoundingOrder,
  findRecipe,
  missingIngredients,
  openCompoundingOrders,
  recipeAvailable,
  startCompounding,
  submitCompounding,
  type CompoundingEvaluation,
} from '@/domain/compounding';
import { stockOf } from '@/domain/inventory';
import { getEffects } from '@/domain/core';
import { RECIPES, STEP_LABELS } from '@/data/recipes';
import { audio } from '@/services/audio/audioEngine';
import type { CompoundingAttempt, CompoundingRecipe, CompoundingStep } from '@/domain/types';

/** Penimbangan: tahan tombol untuk menuang serbuk; presisi tampilan bergantung peralatan. */
function WeighStation({ recipe, weighed, onWeighed, precision }: { recipe: CompoundingRecipe; weighed: Record<string, number>; onWeighed: (id: string, g: number) => void; precision: number }) {
  const game = useGameState();
  const bahan = game.medicines.filter((m) => m.category === 'bahan-racik');
  const [ingredient, setIngredient] = useState<string>('');
  const [value, setValue] = useState(0);
  const [pouring, setPouring] = useState<0 | 1 | -1>(0);
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (!pouring) return;
    const id = window.setInterval(() => {
      setValue((v) => Math.max(0, v + pouring * (fine ? 0.05 : 0.6) * (0.8 + Math.random() * 0.4)));
      audio.play('scale');
    }, 80);
    return () => window.clearInterval(id);
  }, [pouring, fine]);
  const shown = precision >= 2 ? value.toFixed(2) : value.toFixed(1);
  const stopPour = () => setPouring(0);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <div className="text-muted mb-1 text-xs font-semibold uppercase">Ambil bahan dari rak</div>
        <div className="space-y-1">
          {bahan.map((m) => (
            <label key={m.id} className={`flex cursor-pointer items-center justify-between rounded border px-2 py-1 text-sm ${ingredient === m.id ? 'border-brand-400 bg-brand-900/40' : 'border-ink-700'}`}>
              <span className="flex items-center gap-2">
                <input type="radio" name="ingredient" checked={ingredient === m.id} onChange={() => {
                  setIngredient(m.id);
                  setValue(weighed[m.id] ?? 0);
                }} />
                {m.name}
              </span>
              <span className="text-muted text-xs">
                stok {stockOf(game, m.id, 'any')} g {weighed[m.id] ? `· ditimbang ${weighed[m.id].toFixed(2)} g` : ''}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-ink-600 bg-ink-850 p-3 text-center">
        <div className="text-muted text-xs">Timbangan {precision >= 2 ? 'analitik (0,01 g)' : '(0,1 g)'}</div>
        <div className="my-2 rounded-lg bg-black py-3 font-mono text-4xl text-emerald-300" aria-live="polite" data-testid="scale-display">
          {shown} g
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button disabled={!ingredient} onPointerDown={() => setPouring(1)} onPointerUp={stopPour} onPointerLeave={stopPour} onKeyDown={(e) => e.key === ' ' && setPouring(1)} onKeyUp={stopPour}>
            ⬇ Tuang (tahan)
          </Button>
          <Button disabled={!ingredient} onPointerDown={() => setPouring(-1)} onPointerUp={stopPour} onPointerLeave={stopPour}>
            ⬆ Kurangi (tahan)
          </Button>
          <Button size="sm" variant="ghost" disabled={!ingredient} onClick={() => setValue((v) => Math.max(0, v - 0.1))}>
            −0,1
          </Button>
          <Button size="sm" variant="ghost" disabled={!ingredient} onClick={() => setValue((v) => v + 0.1)}>
            +0,1
          </Button>
        </div>
        <label className="mt-2 flex items-center justify-center gap-2 text-xs">
          <input type="checkbox" checked={fine} onChange={(e) => setFine(e.target.checked)} /> Tuang perlahan (presisi)
        </label>
        <div className="mt-2 flex justify-center gap-2">
          <Button size="sm" variant="primary" disabled={!ingredient || value <= 0} onClick={() => onWeighed(ingredient, Math.round(value * 100) / 100)} data-testid="confirm-weigh">
            Catat penimbangan
          </Button>
          <Button size="sm" variant="ghost" disabled={!ingredient} onClick={() => {
            setValue(0);
            onWeighed(ingredient, 0);
          }}>
            Kosongkan
          </Button>
        </div>
        <div className="text-muted mt-2 text-[11px]">Baca jumlah target pada kartu instruksi. Penimbangan yang dicatat akan memakai stok bahan.</div>
      </div>
      <span className="sr-only">{recipe.name}</span>
    </div>
  );
}

/** Mini-game ritme: klik saat indikator berada di zona hijau. */
function RhythmStation({ label, verb, onDone }: { label: string; verb: string; onDone: (quality: number) => void }) {
  const [t, setT] = useState(0);
  const [hits, setHits] = useState<number[]>([]);
  const start = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setT((performance.now() - start.current) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const v = (Math.sin(t * 3.2) + 1) / 2;
  const total = 10;
  const press = () => {
    const score = v >= 0.7 ? 1 : v >= 0.45 ? 0.5 : 0;
    audio.play(score ? 'grind' : 'click');
    const next = [...hits, score];
    setHits(next);
    if (next.length >= total) onDone(next.reduce((a, b) => a + b, 0) / total);
  };
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850 p-3">
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div className="relative h-6 overflow-hidden rounded bg-ink-700">
        <div className="absolute inset-y-0 right-0 w-[30%] bg-emerald-700/70" aria-hidden />
        <div className="absolute inset-y-0 right-[30%] w-[25%] bg-amber-700/50" aria-hidden />
        <div className="absolute inset-y-0 w-1.5 bg-white" style={{ left: `calc(${v * 100}% - 3px)` }} aria-hidden />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-muted text-xs">
          Ketukan {hits.length}/{total} · klik saat penanda di zona hijau
        </span>
        <Button variant="primary" onClick={press} disabled={hits.length >= total} data-testid={`rhythm-${verb}`}>
          {verb}
        </Button>
      </div>
    </div>
  );
}

function Workbench({ orderId }: { orderId: string }) {
  const game = useGameState();
  const order = game.compoundingOrders.find((o) => o.id === orderId)!;
  const recipe = findRecipe(order.recipeId)!;
  const precision = getEffects(game).compoundingLevel >= 2 ? 2 : 1;
  const [attempt, setAttempt] = useState<CompoundingAttempt>(() => ({ orderId, weighed: {}, stepsDone: [], grindQuality: 0, mixQuality: 0, container: null, labelText: '' }));
  const [active, setActive] = useState<CompoundingStep | null>(null);
  const [result, setResult] = useState<CompoundingEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labelOptions = useMemo(() => [...new Set([recipe.labelInstructions, ...RECIPES.map((r) => r.labelInstructions), 'Diminum 3 x sehari'])], [recipe]);

  const markDone = (step: CompoundingStep, patch: Partial<CompoundingAttempt> = {}) => {
    setAttempt((a) => ({ ...a, ...patch, stepsDone: a.stepsDone.includes(step) ? a.stepsDone : [...a.stepsDone, step] }));
    setActive(null);
  };
  const reset = () => {
    setAttempt({ orderId, weighed: {}, stepsDone: [], grindQuality: 0, mixQuality: 0, container: null, labelText: '' });
    setActive(null);
  };
  const allSteps: CompoundingStep[] = ['weigh', 'grind', 'mix', 'divide', 'container', 'label'];
  const stepsAvailable = allSteps.filter((s) => s !== 'divide' || recipe.divideInto);

  if (order.status === 'completed') {
    return <Callout tone="success">Racikan selesai dengan nilai {order.score}. {order.patientId ? 'Pasien menuju kasir.' : ''}</Callout>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="rounded-xl bg-[#fbfaf3] p-3 text-sm text-slate-900">
          <div className="font-bold">{recipe.name}</div>
          <div className="text-xs">{recipe.description}</div>
          <div className="mt-2 text-xs font-semibold">Bahan:</div>
          <ul className="text-xs">
            {recipe.ingredients.map((i) => (
              <li key={i.medicineId}>
                • {game.medicines.find((m) => m.id === i.medicineId)?.name}: {i.amount} g (toleransi ±{Math.round(i.tolerance * 100)}%)
              </li>
            ))}
          </ul>
          <div className="mt-2 text-xs font-semibold">Urutan kerja:</div>
          <ol className="list-decimal pl-5 text-xs">
            {recipe.steps.map((s) => (
              <li key={s}>{STEP_LABELS[s]}</li>
            ))}
          </ol>
          {recipe.divideInto && <div className="mt-1 text-xs">Bagi menjadi {recipe.divideInto} bungkus.</div>}
          <div className="mt-1 text-xs">Wadah: {recipe.container}</div>
          <div className="mt-1 text-xs">Etiket: “{recipe.labelInstructions}”</div>
        </div>
        <div>
          <div className="text-muted mb-1 text-xs font-semibold uppercase">Langkah yang sudah dilakukan</div>
          <ol className="space-y-0.5 text-sm">
            {attempt.stepsDone.length === 0 && <li className="text-muted">Belum ada.</li>}
            {attempt.stepsDone.map((s, i) => (
              <li key={s}>
                {i + 1}. {STEP_LABELS[s]}
              </li>
            ))}
          </ol>
          <Button size="sm" variant="ghost" onClick={reset} className="mt-1">
            ↺ Ulangi dari awal
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {error && <Callout tone="error">{error}</Callout>}
        {result && (
          <Callout tone={result.passed ? 'success' : 'error'} title={result.passed ? `Lulus — nilai ${result.score}` : `Belum memenuhi syarat — nilai ${result.score}`}>
            <ul className="list-disc pl-4 text-xs">
              {result.feedback.map((f) => (
                <li key={f}>{f.replace(/\b(zno|vas-alb|talk|sal-acid|asc-pow|lakt)\b/g, (id) => game.medicines.find((m) => m.id === id)?.name ?? id)}</li>
              ))}
            </ul>
          </Callout>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih alat/langkah">
          {stepsAvailable.map((s) => (
            <Button key={s} size="sm" variant={active === s ? 'primary' : attempt.stepsDone.includes(s) ? 'success' : 'secondary'} onClick={() => setActive(s)} data-testid={`step-${s}`}>
              {attempt.stepsDone.includes(s) ? '✔ ' : ''}
              {STEP_LABELS[s]}
            </Button>
          ))}
        </div>
        {active === 'weigh' && (
          <div>
            <WeighStation recipe={recipe} weighed={attempt.weighed} precision={precision} onWeighed={(id, g) => setAttempt((a) => ({ ...a, weighed: { ...a.weighed, [id]: g } }))} />
            <div className="mt-2 text-right">
              <Button variant="primary" onClick={() => markDone('weigh')} disabled={Object.values(attempt.weighed).every((g) => !g)}>
                Selesai menimbang
              </Button>
            </div>
          </div>
        )}
        {active === 'grind' && <RhythmStation key="grind" label="Gerus serbuk di mortir dengan stamper." verb="Gerus" onDone={(q) => markDone('grind', { grindQuality: q })} />}
        {active === 'mix' && <RhythmStation key="mix" label="Campur bahan secara bertahap hingga homogen." verb="Aduk" onDone={(q) => markDone('mix', { mixQuality: q })} />}
        {active === 'divide' && (
          <div className="flex items-center gap-3 rounded-xl border border-ink-600 p-3">
            <span className="text-sm">Jumlah bungkus</span>
            <NumberStepper value={attempt.divideCount ?? 0} min={0} max={30} onChange={(v) => setAttempt((a) => ({ ...a, divideCount: v }))} label="Jumlah bungkus" />
            <Button variant="primary" onClick={() => markDone('divide')} disabled={!attempt.divideCount}>
              Bagi serbuk
            </Button>
          </div>
        )}
        {active === 'container' && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-ink-600 p-3">
            {recipe.containerOptions.map((c) => (
              <Button key={c} onClick={() => markDone('container', { container: c })}>
                {c}
              </Button>
            ))}
          </div>
        )}
        {active === 'label' && (
          <div className="space-y-2 rounded-xl border border-ink-600 p-3">
            <div className="text-sm">Pilih teks etiket:</div>
            {labelOptions.map((l) => (
              <Button key={l} className="w-full justify-start text-left" onClick={() => markDone('label', { labelText: l })}>
                {l}
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 pt-3">
          <div className="text-muted text-xs">
            Gerus {Math.round(attempt.grindQuality * 100)}% · Campur {Math.round(attempt.mixQuality * 100)}% · Wadah {attempt.container ?? '—'}
          </div>
          <Button
            variant="primary"
            disabled={attempt.stepsDone.length === 0}
            data-testid="submit-compounding"
            onClick={() => {
              setError(null);
              const r = act((s) => submitCompounding(s, attempt));
              if (!r) return;
              if (!r.ok) setError(r.error);
              else {
                setResult(r.value!);
                if (!r.value!.passed) reset();
              }
            }}
          >
            Serahkan hasil racikan
          </Button>
        </div>
        <SimNote>{recipe.disclaimer}</SimNote>
      </div>
    </div>
  );
}

export function CompoundingPanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const fb = useFeedback();
  const orders = openCompoundingOrders(game);
  const [selected, setSelected] = useState<string | null>(orders.find((o) => o.status === 'in-progress')?.id ?? null);
  const order = game.compoundingOrders.find((o) => o.id === selected);
  return (
    <Modal title="Laboratorium Peracikan" subtitle={`Level peralatan ${getEffects(game).compoundingLevel}`} onClose={close} width="max-w-6xl" testId="panel-compounding">
      <FeatureLock feature="compounding">
        {fb.node}
        {order && (order.status === 'in-progress' || order.status === 'completed') ? (
          <div>
            <Button size="sm" variant="ghost" className="mb-2" onClick={() => setSelected(null)}>
              ← Daftar pesanan
            </Button>
            <Workbench key={order.id} orderId={order.id} />
          </div>
        ) : (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <Empty>Tidak ada pesanan racikan. Pesanan datang dari pasien di Meja Pelayanan.</Empty>
            ) : (
              <ul className="space-y-2">
                {orders.map((o) => {
                  const r = findRecipe(o.recipeId)!;
                  const p = game.patients.find((x) => x.id === o.patientId);
                  const missing = missingIngredients(game, r);
                  return (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700 p-3 text-sm">
                      <div>
                        <div className="font-semibold">
                          {o.id} · {r.name}
                        </div>
                        <div className="text-muted text-xs">
                          {p ? `Untuk ${p.name}` : 'Latihan'} · percobaan {o.attempts} {missing.length > 0 && `· bahan kurang: ${missing.map((m) => game.medicines.find((x) => x.id === m.medicineId)?.name).join(', ')}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={o.status === 'in-progress' ? 'amber' : 'slate'}>{o.status === 'in-progress' ? 'Dikerjakan' : 'Menunggu'}</Badge>
                        <Button
                          variant="primary"
                          size="sm"
                          data-testid={`start-${o.id}`}
                          onClick={() => {
                            const res = act((s) => (o.status === 'in-progress' ? { ok: true as const } : startCompounding(s, o.id)));
                            if (res && res.ok) setSelected(o.id);
                            else fb.show(res);
                          }}
                        >
                          {o.status === 'in-progress' ? 'Lanjutkan' : 'Mulai'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {game.mode === 'learning' && (
              <div className="rounded-xl border border-ink-600 p-3">
                <div className="mb-2 text-sm font-semibold">Latihan bebas (Learning Mode)</div>
                <div className="flex flex-wrap gap-2">
                  {RECIPES.map((r) => (
                    <Button key={r.id} size="sm" disabled={!recipeAvailable(game, r)} title={recipeAvailable(game, r) ? undefined : 'Butuh Peralatan Racik Lanjutan'} onClick={() => fb.show(act((s) => createCompoundingOrder(s, r.id)), 'Pesanan latihan dibuat.')}>
                      + {r.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="text-muted text-xs">
              Resep yang tersedia:{' '}
              {RECIPES.map((r) => (
                <span key={r.id} className="mr-2">
                  {recipeAvailable(game, r) ? '✔' : '🔒'} {r.name}
                </span>
              ))}
            </div>
            <ProgressBar value={getEffects(game).compoundingLevel} max={3} label="Level peralatan" />
          </div>
        )}
      </FeatureLock>
    </Modal>
  );
}
