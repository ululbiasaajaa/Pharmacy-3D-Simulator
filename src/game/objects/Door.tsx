import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '@/game/world/worldStore';
import { MAT, type MatKey } from '@/game/world/materials';
import { CanvasLabel } from '@/game/world/CanvasLabel';
import { WALL_H, WALL_T } from '@/game/world/layout';
import { Interactable } from './Interactable';
import { useSettings } from '@/stores/settingsStore';
import { doorSensor } from '@/game/npc/doorSensor';
import { GeoBuilder, meterBox } from '@/game/visual/geometry';
import { BuiltMeshes } from '@/game/visual/Built';

const LEAF_H = 2.1;

/** Daun pintu HPL dengan tepi membulat, pelat tendang, dan gagang tuas (koordinat engsel = 0). */
function buildLeaf(width: number, locked: boolean) {
  const b = new GeoBuilder<MatKey>();
  const w = width - 0.06;
  b.box(locked ? 'doorLocked' : 'door', w, LEAF_H - 0.01, 0.045, w / 2 + 0.01, LEAF_H / 2, 0, { r: 0.008 });
  for (const s of [-1, 1]) {
    b.box('aluminum', w - 0.1, 0.18, 0.004, w / 2 + 0.01, 0.12, s * 0.024, { r: 0 });
    // Gagang tuas + rozet.
    b.cylinder('aluminum', 0.028, 0.028, 0.012, w - 0.07, 1.02, s * 0.028, { rotX: Math.PI / 2, seg: 16 });
    b.box('aluminum', 0.13, 0.018, 0.018, w - 0.12, 1.02, s * 0.045, { r: 0.006 });
  }
  return b.build();
}

/** Kusen pintu (dua tiang + ambang atas) dan dinding di atas pintu. */
function buildFrame(width: number) {
  const b = new GeoBuilder<MatKey>();
  const d = WALL_T + 0.04;
  for (const s of [-1, 1]) b.box('aluminum', 0.06, LEAF_H + 0.06, d, s * (width / 2 + 0.03), (LEAF_H + 0.06) / 2, 0, { r: 0.006 });
  b.box('aluminum', width + 0.12, 0.06, d, 0, LEAF_H + 0.03, 0, { r: 0.006 });
  b.add('wall', meterBox(width, WALL_H - LEAF_H, WALL_T), 0, (WALL_H + LEAF_H) / 2, 0, { worldUV: true });
  return b.build();
}

/**
 * Pintu berengsel yang berayun saat dibuka/ditutup. `rotY` memutar seluruh pintu (π/2 = dinding sejajar sumbu Z;
 * daun berayun ke +X lokal dunia, mis. ke dalam gudang untuk pintu bongkar muat).
 */
export function HingedDoor({ id, x, z, width, locked, label, rotY = 0 }: { id: string; x: number; z: number; width: number; locked?: boolean; label?: string; rotY?: number }) {
  const leaf = useRef<THREE.Group>(null);
  const open = useWorld((s) => !!s.doorsOpen[id]) && !locked;
  const reduce = useSettings((s) => s.settings.reduceMotion);
  const leafParts = useMemo(() => buildLeaf(width, !!locked), [width, locked]);
  const frameParts = useMemo(() => buildFrame(width), [width]);
  useFrame((_, dt) => {
    if (!leaf.current) return;
    const target = open ? -Math.PI / 2 : 0;
    const cur = leaf.current.rotation.y;
    leaf.current.rotation.y = reduce ? target : THREE.MathUtils.damp(cur, target, 8, dt);
  });
  const signBg = locked ? '#9a3412' : '#0e655b';
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Interactable id={id}>
        <group ref={leaf} position={[-width / 2, 0, 0]}>
          <BuiltMeshes parts={leafParts} castShadow />
        </group>
      </Interactable>
      <BuiltMeshes parts={frameParts} />
      {label && <CanvasLabel text={label} width={Math.max(1.4, width)} height={0.26} position={[0, 2.38, WALL_T / 2 + 0.012]} fontSize={52} background={signBg} />}
      {label && <CanvasLabel text={label} width={Math.max(1.4, width)} height={0.26} position={[0, 2.38, -WALL_T / 2 - 0.012]} rotation={[0, Math.PI, 0]} fontSize={52} background={signBg} />}
    </group>
  );
}

/** Daun pintu kaca geser: kaca + bingkai aluminium + pita stiker pengaman. */
function buildSlidingPane() {
  const b = new GeoBuilder<MatKey>();
  const w = 1.2;
  const h = 2.2;
  b.box('aluminum', w, 0.07, 0.05, 0, 0.035, 0, { r: 0.004 });
  b.box('aluminum', w, 0.05, 0.05, 0, h - 0.025, 0, { r: 0.004 });
  for (const s of [-1, 1]) b.box('aluminum', 0.05, h, 0.05, s * (w / 2 - 0.025), h / 2, 0, { r: 0.004 });
  b.box('facadeAccent', w - 0.1, 0.06, 0.006, 0, 1.05, 0.012, { r: 0 });
  b.box('facadeAccent', w - 0.1, 0.06, 0.006, 0, 1.05, -0.012, { r: 0 });
  return b.build();
}

/** Pintu kaca otomatis di pintu masuk: terbuka bila pemain atau pasien mendekat. */
export function AutoDoor() {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const pane = useMemo(buildSlidingPane, []);
  useFrame((_, dt) => {
    const p = useWorld.getState().player;
    const near = performance.now() - doorSensor.lastNear < 400 || (Math.abs(p.x) < 2 && Math.abs(p.z - 10) < 2.2);
    const target = near ? 1.15 : 0.6;
    if (left.current) left.current.position.x = THREE.MathUtils.damp(left.current.position.x, -target, 6, dt);
    if (right.current) right.current.position.x = THREE.MathUtils.damp(right.current.position.x, target, 6, dt);
  });
  return (
    <group position={[0, 0, 10]}>
      {[left, right].map((ref, i) => (
        <group key={i} ref={ref} position={[i === 0 ? -0.6 : 0.6, 0, 0]}>
          <BuiltMeshes parts={pane} />
          <mesh position={[0, 1.1, 0]} material={MAT.glass} renderOrder={3}>
            <boxGeometry args={[1.12, 2.1, 0.012]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
