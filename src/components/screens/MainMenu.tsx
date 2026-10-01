import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/primitives';
import { useT } from '@/app/i18n';
import { listSaves, loadGame, type SlotInfo } from '@/services/persistence/saveService';
import { useGame } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { formatMoney } from '@/domain/time';

const MODE_LABEL: Record<string, string> = { career: 'Karier', learning: 'Pembelajaran', challenge: 'Tantangan' };

export function MainMenu() {
  const nav = useNavigate();
  const t = useT();
  const [latest, setLatest] = useState<SlotInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void listSaves().then((slots) => {
      if (!alive) return;
      const withRec = slots.filter((s) => s.record).sort((a, b) => (b.record!.savedAt > a.record!.savedAt ? 1 : -1));
      setLatest(withRec[0] ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onContinue = async () => {
    if (!latest) return;
    const r = await loadGame(latest.slot);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    useUi.getState().reset();
    useGame.getState().load(r.state, latest.slot);
    nav('/play');
  };

  return (
    <div className="relative h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#14544c_0%,_#0b1215_65%)]">
      <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden>
        <div className="absolute left-[8%] top-[18%] h-40 w-10 rounded bg-brand-300" />
        <div className="absolute left-[8%] top-[18%] mt-[60px] h-10 w-40 -translate-x-[60px] rounded bg-brand-300" />
      </div>
      <div className="relative mx-auto flex min-h-full max-w-xl flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-4xl font-black text-white shadow-lg" aria-hidden>
            +
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Pharmacy 3D Simulator</h1>
          <p className="text-muted mt-3 text-base">{t('menu.tagline')}</p>
        </div>
        <nav className="panel flex flex-col gap-2.5 rounded-2xl p-4 shadow-2xl" aria-label="Menu utama">
          <Button variant="primary" size="lg" onClick={() => nav('/new')} data-testid="menu-new">
            {t('menu.new')}
          </Button>
          <Button size="lg" disabled={!latest} onClick={onContinue} data-testid="menu-continue" title={latest ? undefined : t('menu.noSave')}>
            {t('menu.continue')}
            {latest?.record && (
              <span className="text-muted ml-2 text-xs font-normal">
                {latest.record.summary.pharmacyName} · Hari {latest.record.summary.day} · {MODE_LABEL[latest.record.summary.mode]} · {formatMoney(latest.record.summary.money)}
              </span>
            )}
            {!latest && !loading && <span className="text-muted ml-2 text-xs font-normal">({t('menu.noSave')})</span>}
          </Button>
          <Button size="lg" onClick={() => nav('/load')} data-testid="menu-load">
            {t('menu.load')}
          </Button>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Button onClick={() => nav('/settings')} data-testid="menu-settings">
              {t('menu.settings')}
            </Button>
            <Button onClick={() => nav('/guide')} data-testid="menu-guide">
              {t('menu.guide')}
            </Button>
            <Button onClick={() => nav('/credits')} data-testid="menu-credits">
              {t('menu.credits')}
            </Button>
          </div>
          {error && (
            <p className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-sm text-rose-100" role="alert">
              {error} Buka "Muat Permainan" untuk mengelola slot.
            </p>
          )}
        </nav>
        <p className="text-muted mt-6 text-center text-xs">
          Simulasi permainan. Seluruh data obat, resep, dan pasien adalah contoh fiktif untuk tujuan edukatif dan bukan saran medis.
        </p>
      </div>
    </div>
  );
}
