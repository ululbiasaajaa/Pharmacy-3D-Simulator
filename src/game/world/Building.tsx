import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { occluderObjects } from './worldStore';
import { useGame } from '@/stores/gameStore';
import { MAT } from './materials';
import { CanvasLabel } from './CanvasLabel';
import { EXPANSION_DOORS, EXPANSION_ROOMS, INTERIOR_DOORS, ROOM_LABELS, WALL_H, WALLS, type AABB } from './layout';
import { HingedDoor } from '@/game/objects/Door';
import type { RoomId } from '@/domain/types';

function WallBox({ b, material = MAT.wall }: { b: AABB; material?: typeof MAT.wall }) {
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  return (
    <mesh position={[(b.minX + b.maxX) / 2, WALL_H / 2, (b.minZ + b.maxZ) / 2]} material={material} castShadow receiveShadow>
      <boxGeometry args={[w, WALL_H, d]} />
    </mesh>
  );
}

function Floor({ x0, x1, z0, z1, material }: { x0: number; x1: number; z0: number; z1: number; material: typeof MAT.floorFront }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} material={material} receiveShadow>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
    </mesh>
  );
}

/** Dinding depan dengan etalase kaca. */
function Storefront({ pharmacyName }: { pharmacyName: string }) {
  const segments = WALLS.filter((w) => Math.abs((w.minZ + w.maxZ) / 2 - 10) < 0.01);
  return (
    <group>
      {segments.map((b, i) => {
        const w = b.maxX - b.minX;
        const cx = (b.minX + b.maxX) / 2;
        return (
          <group key={i}>
            <mesh position={[cx, 0.45, 10]} material={MAT.wall} castShadow>
              <boxGeometry args={[w, 0.9, 0.2]} />
            </mesh>
            <mesh position={[cx, 2.9, 10]} material={MAT.wallAccent}>
              <boxGeometry args={[w, 0.6, 0.22]} />
            </mesh>
            <mesh position={[cx, 1.75, 10]} material={MAT.glass}>
              <boxGeometry args={[w, 1.7, 0.05]} />
            </mesh>
            {[b.minX + 0.05, b.maxX - 0.05].map((x) => (
              <mesh key={x} position={[x, 1.75, 10]} material={MAT.metalDark}>
                <boxGeometry args={[0.08, 1.7, 0.12]} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Papan nama & tanda plus */}
      <CanvasLabel text={`APOTEK ${pharmacyName.toUpperCase()}`} width={6} height={0.7} position={[0, 3.55, 10.15]} background="#0e655b" fontSize={120} />
      <group position={[4.2, 3.55, 10.2]}>
        <mesh material={MAT.lightPanel}>
          <boxGeometry args={[0.2, 0.7, 0.08]} />
        </mesh>
        <mesh material={MAT.lightPanel}>
          <boxGeometry args={[0.7, 0.2, 0.08]} />
        </mesh>
      </group>
      <mesh position={[0, 3.55, 10.05]} material={MAT.wall}>
        <boxGeometry args={[24.2, 0.9, 0.15]} />
      </mesh>
    </group>
  );
}

function Outside() {
  const trees = useMemo(
    () => [
      [-14, 15],
      [-5, 17.5],
      [6, 17.5],
      [14, 15],
      [-15, 3],
      [15, -4],
    ],
    [],
  );
  return (
    <group>
      <Floor x0={-40} x1={40} z0={10} z1={13} material={MAT.sidewalk} />
      <Floor x0={-40} x1={40} z0={13} z1={20} material={MAT.road} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={MAT.grass} receiveShadow>
        <planeGeometry args={[120, 120]} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[-37.5 + i * 5, 0.01, 16.5]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.white}>
          <planeGeometry args={[2, 0.15]} />
        </mesh>
      ))}
      {trees.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1, 0]} material={MAT.woodDark} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 2, 6]} />
          </mesh>
          <mesh position={[0, 2.6, 0]} material={MAT.plant} castShadow>
            <icosahedronGeometry args={[1.2, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CeilingLights({ warm }: { warm: boolean }) {
  const spots: [number, number][] = [
    [-6, 6],
    [0, 6],
    [6, 6],
    [-3, 0],
    [3, 0],
    [-8, -6],
    [0, -6],
    [8, -6],
  ];
  return (
    <group>
      {spots.map(([x, z], i) => (
        <mesh key={i} position={[x, WALL_H - 0.02, z]} rotation={[Math.PI / 2, 0, 0]} material={warm ? MAT.lightWarm : MAT.lightPanel}>
          <planeGeometry args={[1.4, 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

export function Building({ shadows }: { shadows: boolean }) {
  const name = useGame((s) => s.game?.profile.pharmacyName ?? 'Sehat');
  const unlockedKey = useGame((s) => (s.game?.pharmacy.unlockedRooms ?? []).join(','));
  const decor = useGame((s) => s.game?.pharmacy.upgrades.decor ?? 0);
  const unlocked = unlockedKey ? (unlockedKey.split(',') as RoomId[]) : [];

  const walls = WALLS.filter((w) => Math.abs((w.minZ + w.maxZ) / 2 - 10) > 0.01);
  const wallGroup = useRef<Group>(null);
  useEffect(() => {
    const g = wallGroup.current;
    if (!g) return;
    occluderObjects.set('walls', g);
    return () => {
      occluderObjects.delete('walls');
    };
  }, []);
  return (
    <group>
      <Outside />
      <Floor x0={-12} x1={12} z0={2} z1={10} material={MAT.floorFront} />
      <Floor x0={-12} x1={12} z0={-2} z1={2} material={MAT.floorBack} />
      <Floor x0={-12} x1={-4} z0={-10} z1={-2} material={MAT.floorBack} />
      <Floor x0={-4} x1={4} z0={-10} z1={-2} material={MAT.floorLab} />
      <Floor x0={4} x1={12} z0={-10} z1={-2} material={MAT.floorBack} />
      <Floor x0={-12} x1={12} z0={-18} z1={-10} material={MAT.floorExpansion} />
      <group ref={wallGroup}>
        {walls.map((b, i) => (
          <WallBox key={i} b={b} material={b.minZ < -9 ? MAT.wallBack : MAT.wall} />
        ))}
      </group>
      <Storefront pharmacyName={name} />
      {/* Plafon (tidak menghasilkan bayangan agar cahaya matahari tetap masuk dari etalase) */}
      <mesh position={[0, WALL_H, -4]} rotation={[Math.PI / 2, 0, 0]} material={MAT.ceiling} receiveShadow={shadows}>
        <planeGeometry args={[24, 28]} />
      </mesh>
      <CeilingLights warm={decor >= 3} />

      {INTERIOR_DOORS.map((d) => (
        <HingedDoor key={d.id} id={d.id} x={d.x} z={d.z} width={d.width} label={d.id === 'door-storage' ? 'GUDANG' : d.id === 'door-lab' ? 'LAB RACIK' : 'ADMINISTRASI'} />
      ))}
      {EXPANSION_DOORS.map((d) => {
        const isUnlocked = !!d.room && unlocked.includes(d.room);
        return <HingedDoor key={d.id} id={d.id} x={d.x} z={d.z} width={d.width} locked={!isUnlocked} label={isUnlocked ? ROOM_LABELS[d.room!] : `${ROOM_LABELS[d.room!]} · TERKUNCI`} />;
      })}
      {Object.entries(EXPANSION_ROOMS).map(([room, pos]) =>
        unlocked.includes(room as RoomId) ? (
          <group key={room}>
            <mesh position={[pos.x, WALL_H - 0.02, pos.z]} rotation={[Math.PI / 2, 0, 0]} material={MAT.lightPanel}>
              <planeGeometry args={[1.4, 0.5]} />
            </mesh>
            <pointLight position={[pos.x, 2.2, pos.z]} intensity={6} distance={9} decay={1.6} />
          </group>
        ) : null,
      )}
    </group>
  );
}
