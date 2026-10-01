import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useGame } from '@/stores/gameStore';
import { useSettings } from '@/stores/settingsStore';
import { PharmacyScene, hasWebGL } from '@/game/scenes/PharmacyScene';
import { Hud } from '@/components/hud/Hud';
import { PanelHost } from '@/components/panels/PanelHost';
import { useGameLoop, useGameSideEffects } from '@/hooks/useGameRuntime';

function NoWebGL() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink-950 p-6 text-center">
      <div className="panel max-w-md rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Mode tanpa 3D</h2>
        <p className="text-muted mt-2 text-sm">
          Perangkat/browser ini tidak mendukung WebGL. Permainan tetap dapat dimainkan melalui tablet manajemen (tombol Tab atau tombol Tablet di HUD) dengan akses cepat ke semua stasiun.
        </p>
      </div>
    </div>
  );
}

function PlayRuntime() {
  useGameLoop();
  useGameSideEffects();
  const webgl = useMemo(() => hasWebGL(), []);
  const quickAccess = useSettings((s) => s.settings.quickAccess);
  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="play-screen">
      {webgl ? <PharmacyScene /> : <NoWebGL />}
      <Hud forceQuickAccess={!webgl || quickAccess} />
      <PanelHost quickAccess={!webgl || quickAccess} />
    </div>
  );
}

export default function PlayScreen() {
  const hasGame = useGame((s) => !!s.game);
  if (!hasGame) return <Navigate to="/" replace />;
  return <PlayRuntime />;
}
