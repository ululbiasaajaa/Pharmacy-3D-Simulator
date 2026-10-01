import { Canvas } from '@react-three/fiber';
import { useSettings } from '@/stores/settingsStore';
import { Building } from '@/game/world/Building';
import { Furniture } from '@/game/world/Furniture';
import { AutoDoor } from '@/game/objects/Door';
import { Patients } from '@/game/npc/Patients';
import { Employees } from '@/game/npc/Employees';
import { PlayerController } from '@/game/player/PlayerController';

/** Mendeteksi dukungan WebGL untuk fallback non-3D. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function Lights({ shadows }: { shadows: boolean }) {
  return (
    <>
      <hemisphereLight args={['#eaf6ff', '#8a8f86', 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[14, 22, 18]}
        intensity={1.6}
        castShadow={shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0005}
      />
      <pointLight position={[-4, 2.2, 5.5]} intensity={5} distance={12} decay={1.5} />
      <pointLight position={[5, 2.2, 5.5]} intensity={5} distance={12} decay={1.5} />
      <pointLight position={[0, 2.2, -0.5]} intensity={4} distance={9} decay={1.5} />
      <pointLight position={[-8, 2.2, -6]} intensity={5} distance={9} decay={1.5} />
      <pointLight position={[0, 2.2, -6]} intensity={5} distance={9} decay={1.5} />
      <pointLight position={[8, 2.2, -6]} intensity={5} distance={9} decay={1.5} />
    </>
  );
}

export function PharmacyScene() {
  const quality = useSettings((s) => s.settings.graphicsQuality);
  const shadows = quality === 'high';
  const dpr: [number, number] = quality === 'low' ? [0.75, 1] : quality === 'medium' ? [1, 1.5] : [1, 2];
  return (
    <Canvas
      shadows={shadows}
      dpr={dpr}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      camera={{ fov: 70, near: 0.05, far: 120, position: [0, 1.65, 0.4] }}
      data-testid="game-canvas"
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#bcdff0']} />
      <fog attach="fog" args={['#bcdff0', 30, 80]} />
      <Lights shadows={shadows} />
      <Building shadows={shadows} />
      <Furniture />
      <AutoDoor />
      <Patients />
      <Employees />
      <PlayerController />
    </Canvas>
  );
}
