import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { act, useGame } from '@/stores/gameStore';
import { useUi, type Speed } from '@/stores/uiStore';
import { useSettings } from '@/stores/settingsStore';
import { useT } from '@/app/i18n';
import { Badge, Button, ProgressBar } from '@/components/ui/primitives';
import { formatClock, formatDayLong, formatMoney } from '@/domain/time';
import { PROGRESSION } from '@/domain/config';
import { getEffects } from '@/domain/core';
import { openPharmacy, startNextDay } from '@/domain/simulation';
import { skipTutorial, skipTutorialStep, tutorialSignal, lessonProgress, lessonDef } from '@/domain/guidance';
import { challengeProgress, challengeDef } from '@/domain/challenge';
import { missionDef } from '@/domain/missions';
import { TUTORIAL_STEPS } from '@/data/tutorial';
import { INTERACTABLES } from '@/game/interactions/interactions';
import { keyLabel } from '@/services/persistence/settings';
import { tutorHint } from '@/services/ai/aiService';
import { useFlash } from './flash';
import type { GameNotification } from '@/domain/types';

function TopBar() {
  const t = useT();
  const game = useGame((s) => s.game)!;
  const speed = useUi((s) => s.speed);
  const paused = useUi((s) => s.paused);
  const setSpeed = useUi((s) => s.setSpeed);
  const openPanel = useUi((s) => s.openPanel);
  const setPaused = useUi((s) => s.setPaused);
  const cap = getEffects(game).queueCapacity;
  const xpNeed = PROGRESSION.xpPerLevel(game.progression.level);
  const rep = game.progression.reputation;
  const phaseLabel = game.time.phase === 'open' ? t('hud.openNow') : game.time.phase === 'preopen' ? t('hud.preopen') : t('hud.closed');
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2 sm:p-3">
      <div className="panel pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 text-sm">
        <div>
          <div className="font-semibold text-white">Apotek {game.profile.pharmacyName}</div>
          <div className="text-muted text-xs">
            Hari {game.time.day} · {formatDayLong(game.time.day)}
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums text-white" aria-label="Jam permainan" data-testid="hud-clock">
          {formatClock(game.time.now)}
        </div>
        <Badge tone={game.time.phase === 'open' ? 'green' : game.time.phase === 'preopen' ? 'amber' : 'red'}>{phaseLabel}</Badge>
        <div className="flex items-center gap-1" role="group" aria-label="Kecepatan waktu">
          {([1, 2, 4, 8] as Speed[]).map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setSpeed(sp)}
              aria-pressed={speed === sp}
              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${speed === sp ? 'bg-brand-500 text-white' : 'bg-ink-700 text-slate-300 hover:bg-ink-600'}`}
            >
              {sp}×
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              openPanel('pause');
            }}
            className="ml-1 rounded bg-ink-700 px-1.5 py-0.5 text-xs font-semibold text-slate-200 hover:bg-ink-600"
            aria-label={t('hud.pause')}
          >
            {paused ? '▶' : '❚❚'}
          </button>
        </div>
      </div>
      <div className="panel pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2 text-sm">
        <div>
          <div className="text-muted text-[11px] uppercase">{t('hud.money')}</div>
          <div className={`font-bold tabular-nums ${game.money < 0 ? 'text-rose-300' : 'text-emerald-300'}`} data-testid="hud-money">
            {formatMoney(game.money)}
          </div>
        </div>
        <div className="w-28">
          <div className="text-muted text-[11px] uppercase">
            {t('hud.reputation')} {Math.round(rep)}
          </div>
          <ProgressBar value={rep} tone={rep >= 60 ? 'green' : rep >= 35 ? 'amber' : 'red'} label={t('hud.reputation')} />
        </div>
        <div className="w-28">
          <div className="text-muted text-[11px] uppercase">
            {t('hud.level')} {game.progression.level}
          </div>
          <ProgressBar value={game.progression.xp} max={xpNeed} label="XP" />
        </div>
        <div>
          <div className="text-muted text-[11px] uppercase">{t('hud.queue')}</div>
          <div className="font-semibold tabular-nums">
            {game.queue.length}/{cap}
          </div>
        </div>
        {game.activeEvents.map((e) => (
          <Badge key={e.id} tone="violet" title={`${e.description} ${e.narrative}`}>
            ⚡ {e.name} · s.d. {formatClock(e.endAt)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** Animasi "+Rp" saat kas bertambah (dinonaktifkan bila efek gerak dikurangi). */
function MoneyDelta() {
  const money = useGame((s) => s.game?.money ?? 0);
  const reduce = useSettings((s) => s.settings.reduceMotion);
  const prev = useRef(money);
  const [deltas, setDeltas] = useState<{ id: number; amount: number }[]>([]);
  useEffect(() => {
    const diff = money - prev.current;
    prev.current = money;
    if (diff === 0 || reduce) return;
    const id = Date.now() + Math.random();
    setDeltas((d) => [...d.slice(-3), { id, amount: diff }]);
    const timer = window.setTimeout(() => setDeltas((d) => d.filter((x) => x.id !== id)), 1600);
    return () => window.clearTimeout(timer);
  }, [money, reduce]);
  return (
    <div className="pointer-events-none absolute right-40 top-16 flex flex-col items-end" aria-hidden>
      {deltas.map((d) => (
        <span key={d.id} className={`animate-float-up text-sm font-bold ${d.amount > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          {d.amount > 0 ? '+' : ''}
          {formatMoney(d.amount)}
        </span>
      ))}
    </div>
  );
}

function FocusPrompt() {
  const focus = useUi((s) => s.focus);
  const panel = useUi((s) => s.panel);
  const interactKey = useSettings((s) => s.settings.keys.interact);
  const crosshair = useSettings((s) => s.settings.showCrosshair);
  const mode = useGame((s) => s.game?.mode);
  if (panel) return null;
  const explanation = focus && mode === 'learning' ? INTERACTABLES.get(focus.id)?.explanation : undefined;
  return (
    <>
      {crosshair && <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow" aria-hidden />}
      {focus && (
        <div className="pointer-events-none absolute left-1/2 top-[56%] w-[min(92vw,420px)] -translate-x-1/2 text-center" role="status" data-testid="focus-prompt">
          <div className="panel inline-block rounded-xl px-3 py-2">
            <div className="text-sm font-semibold text-white">{focus.label}</div>
            {focus.disabledReason ? (
              <div className="text-xs text-amber-300">🔒 {focus.disabledReason}</div>
            ) : (
              <div className="text-xs text-slate-200">
                <kbd className="rounded border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[11px]">{keyLabel(interactKey)}</kbd> {focus.action}
              </div>
            )}
            {explanation && <div className="text-muted mt-1 max-w-sm text-left text-xs">💡 {explanation}</div>}
          </div>
        </div>
      )}
    </>
  );
}

function ClickToPlay() {
  const locked = useUi((s) => s.pointerLocked);
  const panel = useUi((s) => s.panel);
  if (locked || panel) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 rounded-lg bg-black/55 px-3 py-1.5 text-xs text-slate-100">
      Klik layar untuk mengendalikan kamera · Panah untuk kontrol keyboard
    </div>
  );
}

function FlashLayer() {
  const { message, at } = useFlash();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 2200);
    return () => window.clearTimeout(id);
  }, [message, at]);
  if (!visible || !message) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 rounded-lg border border-amber-600 bg-amber-950/90 px-4 py-2 text-sm text-amber-100" role="alert">
      {message}
    </div>
  );
}

function GuidanceCards() {
  const game = useGame((s) => s.game)!;
  const interactKey = useSettings((s) => s.settings.keys.interact);
  const tutorial = game.tutorial;
  const step = tutorial.active ? TUTORIAL_STEPS[tutorial.step] : undefined;
  const lesson = game.lessons.activeLessonId ? lessonDef(game.lessons.activeLessonId) : undefined;
  const lprog = lesson ? lessonProgress(game) : null;
  const ch = challengeDef(game);
  const cprog = ch ? challengeProgress(game) : null;
  const activeMission = game.missions.find((m) => m.status === 'completed') ?? game.missions.find((m) => m.status === 'active');
  const mdef = activeMission ? missionDef(activeMission.id) : undefined;
  return (
    <div className="pointer-events-none absolute left-2 top-24 flex w-[min(88vw,320px)] flex-col gap-2 sm:left-3 sm:top-24">
      {step && (
        <div className="panel pointer-events-auto rounded-xl border-brand-500 p-3 text-sm" data-testid="tutorial-card">
          <div className="text-[11px] font-semibold uppercase text-brand-300">
            Tutorial {tutorial.step + 1}/{TUTORIAL_STEPS.length}
          </div>
          <div className="font-semibold text-white">{step.title}</div>
          <p className="mt-1 text-slate-200">{step.text.replace('tekan E', `tekan ${keyLabel(interactKey)}`)}</p>
          {step.hint && <p className="text-muted mt-1 text-xs">{step.hint}</p>}
          <div className="mt-2 flex gap-2">
            {step.signal === 'ack' && (
              <Button size="sm" variant="primary" onClick={() => act((s) => tutorialSignal(s, 'ack'))} data-testid="tutorial-next">
                Mengerti
              </Button>
            )}
            {step.signal !== 'ack' && (
              <Button size="sm" variant="ghost" onClick={() => act(skipTutorialStep)} data-testid="tutorial-skip-step">
                Lewati langkah ini
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => act(skipTutorial)} data-testid="tutorial-skip">
              Lewati tutorial
            </Button>
          </div>
        </div>
      )}
      {lesson && lprog && (
        <div className="panel pointer-events-auto rounded-xl p-3 text-sm" data-testid="lesson-card">
          <div className="text-[11px] font-semibold uppercase text-sky-300">Pelajaran aktif</div>
          <div className="font-semibold text-white">{lesson.title}</div>
          <ul className="mt-1 space-y-0.5">
            {lprog.map((o) => (
              <li key={o.label} className={o.done ? 'text-emerald-300' : 'text-slate-200'}>
                {o.done ? '✔' : '○'} {o.label} ({o.value}/{o.target})
              </li>
            ))}
          </ul>
          <ol className="text-muted mt-1 list-decimal pl-4 text-xs">
            {lesson.steps.map((st) => (
              <li key={st}>{st}</li>
            ))}
          </ol>
        </div>
      )}
      {ch && cprog && (
        <div className="panel pointer-events-auto rounded-xl p-3 text-sm" data-testid="challenge-card">
          <div className="text-[11px] font-semibold uppercase text-violet-300">Tantangan · sisa {cprog.daysLeft} hari</div>
          <div className="font-semibold text-white">{ch.name}</div>
          <div className="mt-1 text-xs text-slate-200">
            {cprog.label}: {cprog.label.toLowerCase().includes('pasien') ? cprog.current : formatMoney(cprog.current)} / {cprog.label.toLowerCase().includes('pasien') ? cprog.target : formatMoney(cprog.target)}
          </div>
          <ProgressBar value={Math.max(0, cprog.current)} max={cprog.target} tone={cprog.met ? 'green' : 'brand'} />
          {cprog.secondaryLabel && <div className={`mt-1 text-xs ${cprog.secondaryOk ? 'text-emerald-300' : 'text-amber-300'}`}>{cprog.secondaryOk ? '✔' : '⚠'} {cprog.secondaryLabel}</div>}
        </div>
      )}
      {mdef && activeMission && !step && (
        <div className="panel pointer-events-auto rounded-xl p-3 text-sm" data-testid="mission-card">
          <div className="text-[11px] font-semibold uppercase text-amber-300">{activeMission.status === 'completed' ? 'Misi selesai — klaim di Papan Misi' : 'Misi'}</div>
          <div className="font-semibold text-white">{mdef.name}</div>
          <div className="text-muted text-xs">{mdef.description}</div>
          <div className="mt-1">
            <ProgressBar value={activeMission.progress} max={mdef.objective.target} tone={activeMission.status === 'completed' ? 'green' : 'amber'} />
          </div>
        </div>
      )}
    </div>
  );
}

function Toasts() {
  const notifications = useGame((s) => s.game?.notifications);
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<GameNotification[]>([]);
  useEffect(() => {
    if (!notifications) return;
    if (!seen.current) {
      seen.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const fresh = notifications.filter((n) => !seen.current!.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current!.add(n.id));
    setToasts((t) => [...t, ...fresh].slice(-5));
    const ids = fresh.map((n) => n.id);
    window.setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 6000);
  }, [notifications]);
  const tone = { info: 'border-sky-700 bg-sky-950/90', success: 'border-emerald-700 bg-emerald-950/90', warning: 'border-amber-700 bg-amber-950/90', error: 'border-rose-700 bg-rose-950/90' };
  const icon = { info: 'ℹ', success: '✔', warning: '⚠', error: '✖' };
  return (
    <div className="pointer-events-none absolute bottom-20 right-2 flex w-[min(92vw,360px)] flex-col gap-1.5 sm:right-3" aria-live="polite">
      {toasts.map((n) => (
        <div key={n.id} className={`animate-toast rounded-lg border px-3 py-2 text-sm text-slate-100 shadow-lg ${tone[n.level]}`}>
          <span aria-hidden className="mr-1">
            {icon[n.level]}
          </span>
          {n.message}
        </div>
      ))}
    </div>
  );
}

function BottomBar({ quickAccess }: { quickAccess: boolean }) {
  const t = useT();
  const phase = useGame((s) => s.game!.time.phase);
  const openPanel = useUi((s) => s.openPanel);
  const [hint, setHint] = useState<{ text: string; source: string } | null>(null);
  const tabletKey = useSettings((s) => s.settings.keys.tablet);
  const askHint = async () => {
    const g = useGame.getState().game;
    if (!g) return;
    setHint(await tutorHint(g));
  };
  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 9000);
    return () => window.clearTimeout(id);
  }, [hint]);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 sm:p-3">
      {hint && (
        <div className="panel pointer-events-auto max-w-lg rounded-xl px-3 py-2 text-sm" role="status">
          💡 {hint.text} <span className="text-muted text-[10px]">({hint.source === 'ai' ? 'AI' : 'lokal'})</span>
        </div>
      )}
      <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
        {phase === 'preopen' && (
          <Button variant="primary" onClick={() => act(openPharmacy)} data-testid="hud-open">
            🔓 {t('hud.open')}
          </Button>
        )}
        {phase === 'closed' && (
          <>
            <Button onClick={() => openPanel('report')}>📊 Laporan</Button>
            <Button variant="primary" onClick={() => act(startNextDay)} data-testid="hud-next-day">
              ☀ {t('hud.nextDay')}
            </Button>
          </>
        )}
        <Button onClick={() => openPanel('tablet')} data-testid="hud-tablet" title={`Tombol ${keyLabel(tabletKey)}`}>
          📱 {t('hud.tablet')} <span className="text-muted text-[10px]">[{keyLabel(tabletKey)}]</span>
        </Button>
        <Button onClick={askHint}>💡 Petunjuk</Button>
        {quickAccess && (
          <>
            <Button onClick={() => openPanel('service')} data-testid="quick-service">
              Pelayanan
            </Button>
            <Button onClick={() => openPanel('pos')} data-testid="quick-pos">
              Kasir
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function GameOver() {
  const over = useGame((s) => s.game?.gameOver);
  const challenge = useGame((s) => s.game?.challenge);
  const quit = useGame((s) => s.quit);
  const nav = useNavigate();
  if (!over) return null;
  const won = challenge?.status === 'won';
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="alertdialog" aria-label="Permainan berakhir">
      <div className="panel animate-pop max-w-md rounded-2xl p-6 text-center">
        <div className="text-4xl" aria-hidden>
          {won ? '🏆' : '📉'}
        </div>
        <h2 className="mt-2 text-xl font-bold">{won ? 'Tantangan berhasil!' : challenge ? 'Tantangan gagal' : 'Permainan berakhir'}</h2>
        <p className="text-muted mt-2 text-sm">{over.reason}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              quit();
              nav('/');
            }}
          >
            Kembali ke menu
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Hud({ forceQuickAccess }: { forceQuickAccess: boolean }) {
  const panel = useUi((s) => s.panel);
  return (
    <>
      <TopBar />
      <MoneyDelta />
      <FocusPrompt />
      <ClickToPlay />
      <FlashLayer />
      {!panel && <GuidanceCards />}
      <Toasts />
      {!panel && <BottomBar quickAccess={forceQuickAccess} />}
      <GameOver />
    </>
  );
}
