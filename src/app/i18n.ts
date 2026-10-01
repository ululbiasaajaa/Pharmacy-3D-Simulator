import { useSettings } from '@/stores/settingsStore';

/**
 * Terjemahan SEBAGIAN: menu utama, HUD, menu jeda, dan pengaturan tersedia dalam
 * bahasa Inggris. Panel simulasi (resep, inventaris, dll.) tetap berbahasa Indonesia.
 */
const EN: Record<string, string> = {
  'menu.new': 'New Game',
  'menu.continue': 'Continue',
  'menu.load': 'Load Game',
  'menu.settings': 'Settings',
  'menu.guide': 'How to Play',
  'menu.credits': 'Credits & Info',
  'menu.tagline': 'Run a pharmacy: serve patients, manage stock, compound, and grow.',
  'menu.noSave': 'No saved game yet',
  'hud.money': 'Cash',
  'hud.reputation': 'Reputation',
  'hud.level': 'Level',
  'hud.queue': 'Queue',
  'hud.open': 'Open Pharmacy',
  'hud.nextDay': 'Start Next Day',
  'hud.closed': 'Closed',
  'hud.preopen': 'Preparing',
  'hud.openNow': 'Open',
  'hud.mission': 'Mission',
  'hud.tablet': 'Tablet',
  'hud.pause': 'Pause',
  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.save': 'Save Game',
  'pause.settings': 'Settings',
  'pause.quit': 'Save & Quit to Menu',
  'settings.title': 'Settings',
  'common.back': 'Back',
  'common.close': 'Close',
};

const ID: Record<string, string> = {
  'menu.new': 'Permainan Baru',
  'menu.continue': 'Lanjutkan',
  'menu.load': 'Muat Permainan',
  'menu.settings': 'Pengaturan',
  'menu.guide': 'Panduan Permainan',
  'menu.credits': 'Kredit & Informasi',
  'menu.tagline': 'Kelola apotek: layani pasien, atur stok, racik obat, dan kembangkan usahamu.',
  'menu.noSave': 'Belum ada simpanan',
  'hud.money': 'Kas',
  'hud.reputation': 'Reputasi',
  'hud.level': 'Level',
  'hud.queue': 'Antrean',
  'hud.open': 'Buka Apotek',
  'hud.nextDay': 'Mulai Hari Berikutnya',
  'hud.closed': 'Tutup',
  'hud.preopen': 'Persiapan',
  'hud.openNow': 'Buka',
  'hud.mission': 'Misi',
  'hud.tablet': 'Tablet',
  'hud.pause': 'Jeda',
  'pause.title': 'Permainan Dijeda',
  'pause.resume': 'Lanjutkan',
  'pause.save': 'Simpan Permainan',
  'pause.settings': 'Pengaturan',
  'pause.quit': 'Simpan & Keluar ke Menu',
  'settings.title': 'Pengaturan',
  'common.back': 'Kembali',
  'common.close': 'Tutup',
};

export function translate(lang: 'id' | 'en', key: string) {
  return (lang === 'en' ? EN[key] : ID[key]) ?? ID[key] ?? key;
}

export function useT() {
  const lang = useSettings((s) => s.settings.language);
  return (key: string) => translate(lang, key);
}
