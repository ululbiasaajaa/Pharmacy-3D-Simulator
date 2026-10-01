import { useUi, type PanelArgs, type PanelId } from '@/stores/uiStore';
import { Modal } from '@/components/ui/primitives';
import { useGameState } from './shared';
import { isFeatureUnlocked, requiredLevel } from '@/domain/progression';
import type { FeatureKey } from '@/domain/config';
import { audio } from '@/services/audio/audioEngine';

interface Tile {
  panel: PanelId;
  label: string;
  icon: string;
  args?: PanelArgs;
  feature?: FeatureKey;
  station?: boolean;
  hint?: string;
  modes?: string[];
}

const TILES: Tile[] = [
  { panel: 'catalog', label: 'Katalog Obat', icon: '📚' },
  { panel: 'inventory', label: 'Inventaris', icon: '📦', hint: 'Lihat stok; kelola di lemari/rak' },
  { panel: 'missions', label: 'Misi & Progres', icon: '🎯' },
  { panel: 'finance', label: 'Keuangan', icon: '💰', feature: 'finance' },
  { panel: 'employees', label: 'Pegawai', icon: '👥', feature: 'employees' },
  { panel: 'upgrades', label: 'Pengembangan', icon: '🏗', feature: 'upgrades' },
  { panel: 'report', label: 'Laporan Harian', icon: '📊', args: { tab: 'status' } },
  { panel: 'lessons', label: 'Pelajaran', icon: '🎓', modes: ['learning'] },
  { panel: 'challenge', label: 'Tantangan', icon: '🏁', modes: ['challenge'] },
  { panel: 'service', label: 'Meja Pelayanan', icon: '🧑‍⚕️', station: true },
  { panel: 'pos', label: 'Kasir', icon: '🧾', station: true },
  { panel: 'inventory', label: 'Kelola Gudang', icon: '🏬', args: { manage: true, location: 'warehouse', tab: 'receive' }, station: true },
  { panel: 'procurement', label: 'Pengadaan', icon: '🚚', station: true },
  { panel: 'compounding', label: 'Laboratorium', icon: '⚗️', feature: 'compounding', station: true },
];

/** Tablet manajemen. Stasiun fisik hanya tersedia bila "Akses cepat" aktif. */
export function TabletPanel({ quickAccess }: { quickAccess: boolean }) {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const openPanel = useUi((s) => s.openPanel);
  const tiles = TILES.filter((t) => !t.modes || t.modes.includes(game.mode));
  return (
    <Modal title="Tablet Manajemen" subtitle={quickAccess ? 'Akses cepat aktif: semua stasiun tersedia' : 'Stasiun fisik (meja, kasir, gudang, komputer, lab) dibuka dengan berjalan ke objeknya'} onClose={close} width="max-w-3xl" testId="panel-tablet">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => {
          const lockedFeature = t.feature && !isFeatureUnlocked(game, t.feature);
          const lockedStation = t.station && !quickAccess;
          const disabled = lockedFeature || lockedStation;
          const reason = lockedFeature ? `Terbuka di Level ${requiredLevel(t.feature!)}` : lockedStation ? 'Datangi stasiunnya, atau aktifkan Akses cepat di Pengaturan' : t.hint;
          return (
            <button
              key={`${t.panel}-${t.label}`}
              type="button"
              disabled={disabled}
              data-testid={`tile-${t.label.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => {
                audio.play('open');
                openPanel(t.panel, t.args);
              }}
              className="flex flex-col items-start rounded-xl border border-ink-600 bg-ink-850 p-3 text-left transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="text-2xl" aria-hidden>
                {t.icon}
              </span>
              <span className="mt-1 text-sm font-semibold text-white">{t.label}</span>
              {reason && (
                <span className="text-muted text-[11px]">
                  {disabled ? '🔒 ' : ''}
                  {reason}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
