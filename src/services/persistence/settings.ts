import { z } from 'zod';

export const keyBindingsSchema = z.object({
  forward: z.string(),
  back: z.string(),
  left: z.string(),
  right: z.string(),
  interact: z.string(),
  tablet: z.string(),
  sprint: z.string(),
  camera: z.string(),
});

export type KeyBindings = z.infer<typeof keyBindingsSchema>;

export const settingsSchema = z.object({
  musicVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  mouseSensitivity: z.number().min(0.1).max(3),
  moveSpeed: z.number().min(0.5).max(2),
  /** `ultra` (revisi visual 2) memakai post-processing; ditujukan untuk GPU diskrit. */
  graphicsQuality: z.enum(['low', 'medium', 'high', 'ultra']),
  uiScale: z.number().min(0.85).max(1.4),
  language: z.enum(['id', 'en']),
  reduceMotion: z.boolean(),
  highContrast: z.boolean(),
  invertY: z.boolean(),
  showCrosshair: z.boolean(),
  cameraMode: z.enum(['first', 'third']),
  pauseOnPanel: z.boolean(),
  /** Kontrol alternatif: semua stasiun dapat dibuka dari tablet tanpa berjalan. */
  quickAccess: z.boolean(),
  aiEnabled: z.boolean(),
  keys: keyBindingsSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_KEYS: KeyBindings = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  interact: 'KeyE',
  tablet: 'Tab',
  sprint: 'ShiftLeft',
  camera: 'KeyV',
};

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.35,
  sfxVolume: 0.7,
  mouseSensitivity: 1,
  moveSpeed: 1,
  graphicsQuality: 'medium',
  uiScale: 1,
  language: 'id',
  reduceMotion: false,
  highContrast: false,
  invertY: false,
  showCrosshair: true,
  cameraMode: 'first',
  pauseOnPanel: false,
  quickAccess: false,
  aiEnabled: false,
  keys: DEFAULT_KEYS,
};

const KEY = 'pharmacy3d.settings.v1';

/** Pengaturan disimpan per perangkat (localStorage). Nilai rusak diganti default. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    merged.keys = { ...DEFAULT_KEYS, ...(merged.keys ?? {}) };
    const parsed = settingsSchema.safeParse(merged);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function persistSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* penyimpanan tidak tersedia (mode privat) — pengaturan tetap berlaku untuk sesi ini */
  }
}

/** Rekor tantangan (per perangkat). */
const RECORDS_KEY = 'pharmacy3d.records.v1';
export type ChallengeRecords = Record<string, { won: boolean; bestDay: number; at: string }>;

export function loadRecords(): ChallengeRecords {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '{}') as ChallengeRecords;
  } catch {
    return {};
  }
}

export function saveRecord(id: string, won: boolean, day: number) {
  const r = loadRecords();
  const prev = r[id];
  if (!prev || (won && (!prev.won || day < prev.bestDay))) r[id] = { won, bestDay: day, at: new Date().toISOString() };
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    /* abaikan */
  }
}

export function keyLabel(code: string) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = { ShiftLeft: 'Shift', ShiftRight: 'Shift Kanan', Space: 'Spasi', Tab: 'Tab', ControlLeft: 'Ctrl', AltLeft: 'Alt', Enter: 'Enter' };
  return map[code] ?? code;
}
