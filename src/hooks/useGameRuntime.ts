import { useEffect, useRef } from 'react';
import { act, onGameEvent, useGame } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { useSettings } from '@/stores/settingsStore';
import { advanceTime } from '@/domain/simulation';
import { setEventNarrative } from '@/domain/events';
import { TIME } from '@/domain/config';
import { audio, type SfxName } from '@/services/audio/audioEngine';
import { eventNarrative } from '@/services/ai/aiService';
import { saveRecord } from '@/services/persistence/settings';

/** Loop waktu permainan: 10 Hz, dijeda saat menu jeda/permainan berakhir. */
export function useGameLoop() {
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const realDt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const ui = useUi.getState();
      const game = useGame.getState().game;
      if (!game || game.gameOver || ui.paused || document.hidden) return;
      if (useSettings.getState().settings.pauseOnPanel && ui.panel && ui.panel !== 'tablet') return;
      if (game.time.phase !== 'open') return;
      act((s) => advanceTime(s, (realDt * ui.speed) / TIME.realSecondsPerGameMinute));
    }, 100);
    return () => window.clearInterval(id);
  }, []);
}

const SFX: Partial<Record<string, SfxName>> = {
  'patient-arrived': 'door',
  'sale-completed': 'cash',
  'prescription-dispensed': 'success',
  'compounding-completed': 'success',
  'mission-completed': 'success',
  'achievement-unlocked': 'levelup',
  'level-up': 'levelup',
  'order-arrived': 'notify',
  'order-placed': 'click',
  'event-started': 'notify',
  'upgrade-bought': 'success',
  'employee-hired': 'success',
  'day-opened': 'open',
  'day-closed': 'notify',
  'patient-left': 'error',
};

/** Efek suara, narasi event (AI opsional), autosave harian, dan musik latar. */
export function useGameSideEffects() {
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    audio.startMusic();
    const off = onGameEvent((e) => {
      const sfx = SFX[e.type];
      if (sfx) audio.play(sfx);
      if (e.type === 'day-closed') {
        void useGame.getState().save('auto');
        useUi.getState().openPanel('report');
      }
      if (e.type === 'event-started' && e.refId) {
        const ev = useGame.getState().game?.activeEvents.find((x) => x.id === e.refId);
        if (ev) {
          void eventNarrative(ev.name, ev.description, ev.narrative).then((r) => {
            if (r.source === 'ai') act((s) => setEventNarrative(s, ev.id, r.text));
          });
        }
      }
    });
    // Autosave berkala (2 menit nyata) dan saat tab disembunyikan.
    saveTimer.current = window.setInterval(() => void useGame.getState().save('auto'), 120_000);
    const onHide = () => {
      if (document.hidden) void useGame.getState().save('auto');
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      off();
      audio.stopMusic();
      if (saveTimer.current) window.clearInterval(saveTimer.current);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  // Rekor tantangan disimpan saat tantangan berakhir.
  const challenge = useGame((s) => s.game?.challenge);
  const day = useGame((s) => s.game?.time.day ?? 0);
  useEffect(() => {
    if (challenge && challenge.status !== 'running') saveRecord(challenge.id, challenge.status === 'won', day - challenge.startDay + 1);
  }, [challenge, day]);
}
