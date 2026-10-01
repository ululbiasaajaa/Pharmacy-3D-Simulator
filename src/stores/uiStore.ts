import { create } from 'zustand';

export type PanelId =
  | 'service'
  | 'pos'
  | 'inventory'
  | 'catalog'
  | 'procurement'
  | 'finance'
  | 'compounding'
  | 'employees'
  | 'upgrades'
  | 'missions'
  | 'tablet'
  | 'object-info'
  | 'pause'
  | 'report'
  | 'lessons'
  | 'challenge';

export interface PanelArgs {
  /** Mode inventaris: 'manage' bila dibuka dari lemari/rak (atau akses cepat). */
  manage?: boolean;
  location?: 'shelf' | 'warehouse';
  medicineId?: string;
  category?: string;
  objectId?: string;
  tab?: string;
  refrigerated?: boolean;
}

export interface FocusTarget {
  id: string;
  label: string;
  action: string;
  disabledReason?: string;
}

export type Speed = 1 | 2 | 4 | 8;

interface UiStore {
  panel: PanelId | null;
  args: PanelArgs;
  paused: boolean;
  speed: Speed;
  focus: FocusTarget | null;
  pointerLocked: boolean;
  /** Cache teks dialog pasien (AI atau lokal) per id pasien. */
  dialogue: Record<string, { text: string; source: 'ai' | 'local' }>;
  openPanel: (panel: PanelId, args?: PanelArgs) => void;
  closePanel: () => void;
  setPaused: (p: boolean) => void;
  setSpeed: (s: Speed) => void;
  setFocus: (f: FocusTarget | null) => void;
  setPointerLocked: (v: boolean) => void;
  setDialogue: (patientId: string, d: { text: string; source: 'ai' | 'local' }) => void;
  reset: () => void;
}

export const useUi = create<UiStore>((set) => ({
  panel: null,
  args: {},
  paused: false,
  speed: 1,
  focus: null,
  pointerLocked: false,
  dialogue: {},
  openPanel: (panel, args = {}) => set({ panel, args }),
  closePanel: () => set({ panel: null, args: {} }),
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed }),
  setFocus: (focus) =>
    set((st) => (st.focus?.id === focus?.id && st.focus?.disabledReason === focus?.disabledReason ? st : { focus })),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setDialogue: (id, d) => set((st) => ({ dialogue: { ...st.dialogue, [id]: d } })),
  reset: () => set({ panel: null, args: {}, paused: false, speed: 1, focus: null, dialogue: {} }),
}));
