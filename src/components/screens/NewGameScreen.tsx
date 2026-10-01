import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenShell } from './ScreenShell';
import { Button, Field, inputClass } from '@/components/ui/primitives';
import { CHALLENGES } from '@/data/challenges';
import { useGame } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { loadRecords } from '@/services/persistence/settings';
import { formatMoney } from '@/domain/time';
import { ECONOMY } from '@/domain/config';
import type { GameMode } from '@/domain/types';

const MODES: { id: GameMode; title: string; text: string; bullets: string[] }[] = [
  {
    id: 'career',
    title: 'Mode Karier',
    text: 'Mulai dari apotek kecil dan kembangkan secara bertahap.',
    bullets: [`Modal awal ${formatMoney(ECONOMY.startingMoney.career)}`, 'Fitur terbuka seiring level', 'Misi, event, dan risiko bangkrut'],
  },
  {
    id: 'learning',
    title: 'Mode Pembelajaran',
    text: 'Fokus memahami alur kerja apotek melalui pelajaran terpandu.',
    bullets: ['Semua fitur terbuka', 'Pasien lebih sabar, tanpa bangkrut', 'Umpan balik rinci setelah aktivitas'],
  },
  {
    id: 'challenge',
    title: 'Mode Tantangan',
    text: 'Skenario dengan kondisi khusus, target, dan batas waktu.',
    bullets: ['Modal & stok khusus', 'Target yang jelas', 'Menang atau kalah'],
  },
];

export function NewGameScreen() {
  const nav = useNavigate();
  const [step, setStep] = useState<'setup' | 'intro'>('setup');
  const [mode, setMode] = useState<GameMode>('career');
  const [playerName, setPlayerName] = useState('');
  const [pharmacyName, setPharmacyName] = useState('Sehat Sentosa');
  const [challengeId, setChallengeId] = useState(CHALLENGES[0].id);
  const [skipTutorial, setSkipTutorial] = useState(false);
  const records = loadRecords();
  const valid = playerName.trim().length >= 2 && pharmacyName.trim().length >= 2;

  const start = () => {
    useUi.getState().reset();
    useGame.getState().startNew({ mode, playerName, pharmacyName, challengeId: mode === 'challenge' ? challengeId : undefined, skipTutorial });
    nav('/play');
  };

  if (step === 'intro') {
    const ch = CHALLENGES.find((c) => c.id === challengeId)!;
    return (
      <ScreenShell title="Selamat datang di apotekmu" back={null}>
        <div className="panel space-y-4 rounded-2xl p-5 text-slate-200">
          <p>
            Halo, <strong>{playerName}</strong>! Kamu baru saja mengambil alih <strong>Apotek {pharmacyName}</strong>, sebuah apotek kecil di sudut kota.
          </p>
          {mode === 'career' && (
            <p>
              Dengan modal awal {formatMoney(ECONOMY.startingMoney.career)}, tugasmu adalah melayani pasien dengan teliti, menjaga stok tetap aman, dan mengembangkan apotek menjadi tempat
              yang dipercaya warga. Fitur seperti pegawai, peningkatan, dan laboratorium racik akan terbuka seiring naiknya level.
            </p>
          )}
          {mode === 'learning' && (
            <p>
              Mode ini dirancang untuk memahami alur kerja: pelayanan obat bebas, resep, FEFO, pengadaan, dan peracikan. Buka <strong>Papan Informasi</strong> di dekat pintu masuk (atau tablet)
              untuk memilih pelajaran.
            </p>
          )}
          {mode === 'challenge' && (
            <div>
              <p className="font-semibold text-white">{ch.name}</p>
              <p>{ch.description}</p>
              <ul className="text-muted mt-2 list-disc pl-5 text-sm">
                {ch.constraints.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-ink-600 bg-ink-850 p-3 text-sm">
            <p className="font-semibold text-white">Kontrol dasar</p>
            <p className="text-muted">
              Klik layar untuk mengunci kursor · <kbd>W A S D</kbd> bergerak · mouse melihat · <kbd>E</kbd> berinteraksi · <kbd>Tab</kbd> tablet manajemen · <kbd>V</kbd> ganti kamera · <kbd>Esc</kbd>{' '}
              menu jeda. Tombol dapat diubah di Pengaturan.
            </p>
          </div>
          <p className="text-muted text-xs">Semua obat, resep, dan pasien dalam permainan adalah contoh fiktif untuk simulasi — bukan saran medis.</p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setStep('setup')}>Kembali</Button>
            <Button variant="primary" size="lg" onClick={start} data-testid="start-game">
              Masuk ke apotek →
            </Button>
          </div>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Permainan Baru" wide>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <section className="panel space-y-4 rounded-2xl p-5" aria-labelledby="profil">
          <h2 id="profil" className="text-lg font-semibold">
            Profil
          </h2>
          <Field label="Nama pemain" hint="Minimal 2 karakter. Gunakan nama samaran — tidak perlu data pribadi.">
            <input className={inputClass} value={playerName} maxLength={24} onChange={(e) => setPlayerName(e.target.value)} placeholder="mis. Apt. Rani" data-testid="player-name" />
          </Field>
          <Field label="Nama apotek">
            <input className={inputClass} value={pharmacyName} maxLength={24} onChange={(e) => setPharmacyName(e.target.value)} data-testid="pharmacy-name" />
          </Field>
          {mode !== 'challenge' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipTutorial} onChange={(e) => setSkipTutorial(e.target.checked)} data-testid="skip-tutorial" />
              Lewati tutorial (untuk pemain berpengalaman)
            </label>
          )}
        </section>
        <section className="space-y-3" aria-labelledby="mode">
          <h2 id="mode" className="text-lg font-semibold">
            Mode permainan
          </h2>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                data-testid={`mode-${m.id}`}
                onClick={() => setMode(m.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${mode === m.id ? 'border-brand-400 bg-brand-900/60' : 'border-ink-600 bg-ink-850 hover:bg-ink-800'}`}
              >
                <div className="font-semibold text-white">{m.title}</div>
                <div className="text-muted mt-1 text-xs">{m.text}</div>
                <ul className="mt-2 space-y-0.5 text-xs text-slate-300">
                  {m.bullets.map((b) => (
                    <li key={b}>• {b}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
          {mode === 'challenge' && (
            <div className="panel space-y-2 rounded-xl p-3">
              <div className="text-sm font-semibold">Pilih tantangan</div>
              {CHALLENGES.map((c) => {
                const rec = records[c.id];
                return (
                  <label key={c.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${challengeId === c.id ? 'border-brand-400 bg-brand-900/40' : 'border-ink-600'}`}>
                    <input type="radio" name="challenge" checked={challengeId === c.id} onChange={() => setChallengeId(c.id)} className="mt-1" />
                    <span>
                      <span className="font-semibold text-white">{c.name}</span>
                      {rec && <span className={`ml-2 text-xs ${rec.won ? 'text-emerald-300' : 'text-amber-300'}`}>{rec.won ? `✔ Menang (hari ${rec.bestDay})` : 'Belum berhasil'}</span>}
                      <span className="text-muted block text-xs">{c.description}</span>
                      <span className="text-muted block text-xs">Batas: {c.constraints.join(' · ')}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="primary" size="lg" disabled={!valid} onClick={() => setStep('intro')} data-testid="continue-intro">
              Lanjut
            </Button>
          </div>
          {!valid && <p className="text-muted text-right text-xs">Isi nama pemain dan nama apotek (minimal 2 karakter).</p>}
        </section>
      </div>
    </ScreenShell>
  );
}
