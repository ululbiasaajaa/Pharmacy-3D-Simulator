import { useEffect, useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useUi } from '@/stores/uiStore';
import * as THREE from 'three';
import { Building } from '@/game/world/Building';
import { Furniture } from '@/game/world/Furniture';
import { AutoDoor } from '@/game/objects/Door';
import { Patients } from '@/game/npc/Patients';
import { Employees } from '@/game/npc/Employees';
import { PlayerController } from '@/game/player/PlayerController';
import { DaylightDriver, SceneEnvironment, SceneLights, SkyDome } from '@/game/visual/Atmosphere';
import { useVisualProfile, type VisualProfile } from '@/game/visual/quality';
import { FloorAO } from '@/game/visual/FloorAO';
import { SunPatches } from '@/game/visual/SunPatches';
import { configureMaterials } from '@/game/world/materials';

/** Mendeteksi dukungan WebGL untuk fallback non-3D. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Memasang tekstur prosedural sesuai kualitas grafis sebelum frame pertama. */
function MaterialQuality({ profile }: { profile: VisualProfile }) {
  useLayoutEffect(() => configureMaterials(profile), [profile]);
  return null;
}

/**
 * Saat panel/modal terbuka (latar redup menutupi scene), scene 3D hanya dirender bila diminta:
 * hemat GPU & baterai selama pemain bekerja di panel. Logika permainan tetap berjalan (timer terpisah).
 */
function RenderThrottle() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  const covered = useUi((s) => s.panel !== null);
  useEffect(() => {
    setFrameloop(covered ? 'demand' : 'always');
    if (covered) invalidate();
  }, [covered, setFrameloop, invalidate]);
  return null;
}

export function PharmacyScene() {
  const profile = useVisualProfile();
  return (
    <Canvas
      shadows={profile.sunShadows ? 'percentage' : false}
      dpr={profile.dpr}
      gl={{ antialias: profile.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: false, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 0.95 }}
      camera={{ fov: 70, near: 0.05, far: 120, position: [0, 1.65, 0.4] }}
      data-testid="game-canvas"
      style={{ position: 'absolute', inset: 0 }}
    >
      <fog attach="fog" args={['#d3e6f3', 35, 95]} />
      <MaterialQuality profile={profile} />
      <RenderThrottle />
      <DaylightDriver />
      <SkyDome />
      <SceneEnvironment resolution={profile.envResolution} />
      <SceneLights profile={profile} />
      <Building shadows={profile.sunShadows} />
      <FloorAO pxPerMeter={profile.quality === 'low' ? 14 : 24} />
      {!profile.sunShadows && <SunPatches />}
      <Furniture />
      <AutoDoor />
      <Patients />
      <Employees />
      <PlayerController />
    </Canvas>
  );
}
