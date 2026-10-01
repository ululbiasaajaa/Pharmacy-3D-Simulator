import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '@/game/world/worldStore';
import { MAT } from '@/game/world/materials';
import { CanvasLabel } from '@/game/world/CanvasLabel';
import { WALL_H } from '@/game/world/layout';
import { Interactable } from './Interactable';
import { useSettings } from '@/stores/settingsStore';
import { doorSensor } from '@/game/npc/doorSensor';

/** Pintu berengsel yang berayun saat dibuka/ditutup. */
export function HingedDoor({ id, x, z, width, locked, label }: { id: string; x: number; z: number; width: number; locked?: boolean; label?: string }) {
  const leaf = useRef<THREE.Group>(null);
  const open = useWorld((s) => !!s.doorsOpen[id]) && !locked;
  const reduce = useSettings((s) => s.settings.reduceMotion);
  useFrame((_, dt) => {
    if (!leaf.current) return;
    const target = open ? -Math.PI / 2 : 0;
    const cur = leaf.current.rotation.y;
    leaf.current.rotation.y = reduce ? target : THREE.MathUtils.damp(cur, target, 8, dt);
  });
  return (
    <group position={[x, 0, z]}>
      <Interactable id={id}>
        <group ref={leaf} position={[-width / 2, 0, 0]}>
          <mesh position={[width / 2, 1.05, 0]} material={locked ? MAT.doorLocked : MAT.door} castShadow>
            <boxGeometry args={[width - 0.04, 2.1, 0.06]} />
          </mesh>
          <mesh position={[width - 0.18, 1.05, 0.06]} material={MAT.metal}>
            <boxGeometry args={[0.12, 0.03, 0.05]} />
          </mesh>
        </group>
      </Interactable>
      {/* Bagian dinding di atas pintu */}
      <mesh position={[0, (WALL_H + 2.1) / 2, 0]} material={MAT.wall}>
        <boxGeometry args={[width, WALL_H - 2.1, 0.2]} />
      </mesh>
      {label && <CanvasLabel text={label} width={Math.max(1.4, width)} height={0.28} position={[0, 2.35, 0.11]} fontSize={52} background={locked ? '#7c2d12' : '#0e655b'} />}
      {label && <CanvasLabel text={label} width={Math.max(1.4, width)} height={0.28} position={[0, 2.35, -0.11]} rotation={[0, Math.PI, 0]} fontSize={52} background={locked ? '#7c2d12' : '#0e655b'} />}
    </group>
  );
}

/** Pintu kaca otomatis di pintu masuk: terbuka bila pemain atau pasien mendekat. */
export function AutoDoor() {
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const p = useWorld.getState().player;
    const near = performance.now() - doorSensor.lastNear < 400 || (Math.abs(p.x) < 2 && Math.abs(p.z - 10) < 2.2);
    const target = near ? 1.15 : 0.6;
    if (left.current) left.current.position.x = THREE.MathUtils.damp(left.current.position.x, -target, 6, dt);
    if (right.current) right.current.position.x = THREE.MathUtils.damp(right.current.position.x, target, 6, dt);
  });
  return (
    <group position={[0, 0, 10]}>
      <mesh ref={left} position={[-0.6, 1.1, 0]} material={MAT.glass}>
        <boxGeometry args={[1.2, 2.2, 0.05]} />
      </mesh>
      <mesh ref={right} position={[0.6, 1.1, 0]} material={MAT.glass}>
        <boxGeometry args={[1.2, 2.2, 0.05]} />
      </mesh>
      <mesh position={[0, 2.7, 0]} material={MAT.wall}>
        <boxGeometry args={[2.4, 1, 0.2]} />
      </mesh>
    </group>
  );
}
