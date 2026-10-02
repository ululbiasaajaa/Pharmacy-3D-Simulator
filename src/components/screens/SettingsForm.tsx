import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '@/stores/settingsStore';
import { Button, ConfirmDialog } from '@/components/ui/primitives';
import { DEFAULT_KEYS, keyLabel, type KeyBindings, type Settings } from '@/services/persistence/settings';
import { checkAiAvailable } from '@/services/ai/aiService';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 py-2.5 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-100">{label}</div>
        {hint && <div className="text-muted text-xs">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Slider({ value, onChange, min, max, step, label, format }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; label: string; format?: (v: number) => string }) {
  return (
    <>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-40 accent-teal-400" />
      <span className="w-12 text-right text-sm tabular-nums">{format ? format(value) : value}</span>
    </>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'border-brand-300 bg-brand-500' : 'border-ink-600 bg-ink-700'}`}
    >
      <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      <span className="sr-only">{checked ? 'Aktif' : 'Nonaktif'}</span>
    </button>
  );
}

const KEY_NAMES: Record<keyof KeyBindings, string> = {
  forward: 'Maju',
  back: 'Mundur',
  left: 'Kiri',
  right: 'Kanan',
  interact: 'Interaksi',
  tablet: 'Tablet manajemen',
  sprint: 'Lari',
  camera: 'Ganti kamera',
};

function KeyBinder({ action }: { action: keyof KeyBindings }) {
  const keys = useSettings((s) => s.settings.keys);
  const update = useSettings((s) => s.update);
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        // Tukar bila tombol sudah dipakai aksi lain agar tidak ada bentrok.
        const clash = (Object.keys(keys) as (keyof KeyBindings)[]).find((k) => k !== action && keys[k] === e.code);
        const next = { ...keys, [action]: e.code };
        if (clash) next[clash] = keys[action];
        update({ keys: next });
      }
      setListening(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [listening, keys, action, update]);
  return (
    <Button size="sm" variant={listening ? 'primary' : 'secondary'} onClick={() => setListening(true)} aria-label={`Ubah tombol ${KEY_NAMES[action]}`}>
      {listening ? 'Tekan tombol…' : keyLabel(keys[action])}
    </Button>
  );
}

/** Toggle AI hanya dapat diaktifkan bila proxy AI benar-benar dapat dihubungi. */
function AiRow() {
  const enabled = useSettings((st) => st.settings.aiEnabled);
  const update = useSettings((st) => st.update);
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void checkAiAvailable().then((ok) => {
      if (alive) setAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);
  const hint =
    available === null
      ? 'Memeriksa proxy AI…'
      : available
        ? 'Proxy AI terhubung. Dialog pasien, petunjuk, dan ulasan harian dapat dibuat oleh AI.'
        : 'Tidak tersedia: proxy AI tidak ditemukan (npm run ai-proxy). Game memakai teks lokal.';
  return (
    <Row label="Fitur AI (opsional)" hint={hint}>
      <Toggle label="Fitur AI" checked={enabled && available === true} disabled={available !== true} onChange={(v) => update({ aiEnabled: v })} />
    </Row>
  );
}

export function SettingsForm() {
  const s = useSettings((st) => st.settings);
  const update = useSettings((st) => st.update);
  const resetDefaults = useSettings((st) => st.resetDefaults);
  const [confirm, setConfirm] = useState(false);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-300">Audio</h3>
        <Row label="Volume musik" hint="Musik latar prosedural (placeholder).">
          <Slider label="Volume musik" value={s.musicVolume} min={0} max={1} step={0.05} onChange={(v) => update({ musicVolume: v })} format={pct} />
        </Row>
        <Row label="Volume efek suara">
          <Slider label="Volume efek suara" value={s.sfxVolume} min={0} max={1} step={0.05} onChange={(v) => update({ sfxVolume: v })} format={pct} />
        </Row>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-300">Kontrol</h3>
        <Row label="Sensitivitas kamera">
          <Slider label="Sensitivitas kamera" value={s.mouseSensitivity} min={0.2} max={3} step={0.1} onChange={(v) => update({ mouseSensitivity: v })} format={(v) => v.toFixed(1)} />
        </Row>
        <Row label="Kecepatan gerak">
          <Slider label="Kecepatan gerak" value={s.moveSpeed} min={0.5} max={2} step={0.1} onChange={(v) => update({ moveSpeed: v })} format={(v) => `${v.toFixed(1)}×`} />
        </Row>
        <Row label="Balik sumbu Y">
          <Toggle label="Balik sumbu Y" checked={s.invertY} onChange={(v) => update({ invertY: v })} />
        </Row>
        <Row label="Sudut pandang" hint="Orang pertama (utama) atau orang ketiga.">
          <select aria-label="Sudut pandang" className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-sm" value={s.cameraMode} onChange={(e) => update({ cameraMode: e.target.value as 'first' | 'third' })}>
            <option value="first">Orang pertama</option>
            <option value="third">Orang ketiga</option>
          </select>
        </Row>
        {(Object.keys(DEFAULT_KEYS) as (keyof KeyBindings)[]).map((k) => (
          <Row key={k} label={`Tombol: ${KEY_NAMES[k]}`}>
            <KeyBinder action={k} />
          </Row>
        ))}
        <Row label="Kontrol alternatif" hint="Panah ←/→ memutar kamera, ↑/↓ bergerak, PageUp/PageDown melihat atas/bawah.">
          <span className="text-muted text-xs">Selalu aktif</span>
        </Row>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-300">Grafis & Tampilan</h3>
        <Row label="Kualitas grafis" hint="Rendah: tanpa antialias & resolusi lebih kecil. Tinggi: bayangan real-time. Ultra: ditambah AO layar & bloom — berat, untuk GPU diskrit.">
          <select aria-label="Kualitas grafis" className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-sm" value={s.graphicsQuality} onChange={(e) => update({ graphicsQuality: e.target.value as Settings['graphicsQuality'] })}>
            <option value="low">Rendah</option>
            <option value="medium">Sedang</option>
            <option value="high">Tinggi</option>
            <option value="ultra">Ultra (GPU diskrit)</option>
          </select>
        </Row>
        <Row label="Skala antarmuka / ukuran teks">
          <Slider label="Skala antarmuka" value={s.uiScale} min={0.85} max={1.4} step={0.05} onChange={(v) => update({ uiScale: v })} format={pct} />
        </Row>
        <Row label="Bahasa" hint="Bahasa Inggris tersedia sebagian (menu, HUD, jeda). Panel simulasi tetap berbahasa Indonesia.">
          <select aria-label="Bahasa" className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-sm" value={s.language} onChange={(e) => update({ language: e.target.value as 'id' | 'en' })}>
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English (sebagian)</option>
          </select>
        </Row>
        <Row label="Tampilkan crosshair">
          <Toggle label="Tampilkan crosshair" checked={s.showCrosshair} onChange={(v) => update({ showCrosshair: v })} />
        </Row>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-300">Aksesibilitas & Permainan</h3>
        <Row label="Kurangi efek gerak" hint="Mematikan guncangan kamera dan animasi antarmuka.">
          <Toggle label="Kurangi efek gerak" checked={s.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
        </Row>
        <Row label="Kontras tinggi">
          <Toggle label="Kontras tinggi" checked={s.highContrast} onChange={(v) => update({ highContrast: v })} />
        </Row>
        <Row label="Akses cepat stasiun" hint="Semua stasiun (pelayanan, kasir, gudang, lab…) dapat dibuka dari tablet tanpa berjalan.">
          <Toggle label="Akses cepat stasiun" checked={s.quickAccess} onChange={(v) => update({ quickAccess: v })} />
        </Row>
        <Row label="Jeda waktu saat panel terbuka" hint="Waktu permainan berhenti ketika panel stasiun terbuka.">
          <Toggle label="Jeda waktu saat panel terbuka" checked={s.pauseOnPanel} onChange={(v) => update({ pauseOnPanel: v })} />
        </Row>
        <AiRow />
      </section>
      <div className="flex justify-end">
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Kembalikan ke bawaan
        </Button>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Kembalikan pengaturan?"
          message="Semua pengaturan (termasuk tombol) akan kembali ke nilai bawaan."
          danger
          confirmLabel="Kembalikan"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            resetDefaults();
            setConfirm(false);
          }}
        />
      )}
    </div>
  );
}
