import { create } from 'zustand';
import { DEFAULT_SETTINGS, loadSettings, persistSettings, type Settings } from '@/services/persistence/settings';
import { audio } from '@/services/audio/audioEngine';
import { checkAiAvailable, setAiEnabled } from '@/services/ai/aiService';

interface SettingsStore {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  resetDefaults: () => void;
}

/** Menerapkan pengaturan ke subsistem (audio, AI, tampilan). */
export function applySettings(s: Settings) {
  audio.setVolumes(s.musicVolume, s.sfxVolume);
  setAiEnabled(s.aiEnabled);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.fontSize = `${Math.round(16 * s.uiScale)}px`;
    root.dataset.contrast = s.highContrast ? 'high' : 'normal';
    root.dataset.motion = s.reduceMotion ? 'reduce' : 'full';
  }
}

const initial = loadSettings();
applySettings(initial);
// AI aktif dari sesi sebelumnya: pastikan proxy ada sebelum game mencoba memanggilnya.
if (initial.aiEnabled) void checkAiAvailable();

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: initial,
  update: (patch) => {
    const next = { ...get().settings, ...patch };
    persistSettings(next);
    applySettings(next);
    set({ settings: next });
  },
  resetDefaults: () => {
    persistSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));
