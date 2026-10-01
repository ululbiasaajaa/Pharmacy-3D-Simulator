import { create } from 'zustand';
import { produce, setAutoFreeze } from 'immer';
import { createNewGame, type NewGameOptions } from '@/domain/newGame';
import { postProcess } from '@/domain/simulation';
import type { GameEvent, GameState } from '@/domain/types';
import { saveGame, type SlotId } from '@/services/persistence/saveService';

// State dibekukan oleh immer mencegah mutasi tak sengaja di luar aksi domain.
setAutoFreeze(true);

type Listener = (e: GameEvent) => void;
const listeners = new Set<Listener>();

/** Event bus untuk subsistem di luar domain (audio, autosave, UI). */
export function onGameEvent(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

interface GameStore {
  game: GameState | null;
  slot: SlotId | null;
  lastSavedAt: number | null;
  saving: boolean;
  /**
   * Menjalankan fungsi domain terhadap draft state (immer), lalu mengevaluasi misi,
   * pencapaian, tutorial, pelajaran, dan tantangan. Nilai kembalian disalin agar aman
   * dipakai di luar draft.
   */
  act: <T>(fn: (s: GameState) => T) => T | undefined;
  startNew: (opts: NewGameOptions) => void;
  load: (state: GameState, slot?: SlotId | null) => void;
  quit: () => void;
  save: (slot: SlotId) => Promise<boolean>;
}

function plain<T>(v: T): T {
  if (v === undefined || v === null || typeof v !== 'object') return v;
  return JSON.parse(JSON.stringify(v)) as T;
}

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  slot: null,
  lastSavedAt: null,
  saving: false,

  act: (fn) => {
    const current = get().game;
    if (!current) return undefined;
    let result: unknown;
    let events: GameEvent[] = [];
    const next = produce(current, (draft) => {
      result = plain(fn(draft as GameState));
      postProcess(draft as GameState);
      if (draft.outbox.length) {
        events = plain(draft.outbox);
        draft.outbox = [];
      }
    });
    if (next !== current) set({ game: next });
    for (const e of events) for (const l of listeners) l(e);
    return result as ReturnType<typeof fn>;
  },

  startNew: (opts) => {
    set({ game: createNewGame(opts), slot: null, lastSavedAt: null });
  },

  load: (state, slot = null) => {
    set({ game: produce(state, () => undefined), slot, lastSavedAt: Date.now() });
  },

  quit: () => set({ game: null, slot: null }),

  save: async (slot) => {
    const game = get().game;
    if (!game) return false;
    set({ saving: true });
    try {
      await saveGame(slot, game);
      set({ slot: slot === 'auto' ? get().slot : slot, lastSavedAt: Date.now(), saving: false });
      return true;
    } catch {
      set({ saving: false });
      return false;
    }
  },
}));

/** Pintasan untuk komponen: jalankan aksi domain. */
export const act = <T>(fn: (s: GameState) => T) => useGame.getState().act(fn);
