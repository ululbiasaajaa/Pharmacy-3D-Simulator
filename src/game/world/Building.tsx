import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { occluderObjects } from './worldStore';
import { useGame } from '@/stores/gameStore';
import type { MatKey } from './materials';
import { EXPANSION_DOORS, INTERIOR_DOORS, ROOM_LABELS, SIDE_DOORS, WALL_H, WALLS } from './layout';
import { Facade, InteriorDetails } from './Architecture';
import { Exterior } from './Exterior';
import { useIsNight } from '@/game/visual/useIsNight';
import { GeoBuilder, floorQuad, meterBox } from '@/game/visual/geometry';
import { BuiltMeshes } from '@/game/visual/Built';
import { HingedDoor } from '@/game/objects/Door';
import { InteriorCull } from '@/game/visual/InteriorCull';
import type { RoomId } from '@/domain/types';

/** Dinding dalam & luar (kecuali sisi etalase) digabung per material — UV berskala meter. */
function buildWalls() {
  const b = new GeoBuilder<MatKey>();
  for (const w of WALLS) {
    if (Math.abs((w.minZ + w.maxZ) / 2 - 10) < 0.01) continue;
    const width = w.maxX - w.minX;
    const depth = w.maxZ - w.minZ;
    b.add(w.minZ < -9 ? 'wallBack' : 'wall', meterBox(width, WALL_H, depth), (w.minX + w.maxX) / 2, WALL_H / 2, (w.minZ + w.maxZ) / 2, { worldUV: true });
  }
  return b.build();
}

type FloorDef = { x0: number; x1: number; z0: number; z1: number; mat: MatKey };

const FLOORS: FloorDef[] = [
  { x0: -12, x1: 12, z0: 2, z1: 10, mat: 'floorFront' },
  { x0: -12, x1: 12, z0: -2, z1: 2, mat: 'floorBack' },
  { x0: -12, x1: -4, z0: -10, z1: -2, mat: 'floorBack' },
  { x0: -4, x1: 4, z0: -10, z1: -2, mat: 'floorLab' },
  { x0: 4, x1: 12, z0: -10, z1: -2, mat: 'floorBack' },
  { x0: -12, x1: 12, z0: -18, z1: -10, mat: 'floorExpansion' },
];

/** Lantai interior + plafon (menghadap bawah), satu mesh per material. */
function buildFloorsAndCeiling() {
  const b = new GeoBuilder<MatKey>();
  for (const f of FLOORS) b.add(f.mat, floorQuad(f.x0, f.x1, f.z0, f.z1));
  b.add('ceiling', floorQuad(-12, 12, -18, 10, WALL_H, true));
  return b.build();
}

export function Building({ shadows }: { shadows: boolean }) {
  const name = useGame((s) => s.game?.profile.pharmacyName ?? 'Sehat');
  const unlockedKey = useGame((s) => (s.game?.pharmacy.unlockedRooms ?? []).join(','));
  const decor = useGame((s) => s.game?.pharmacy.upgrades.decor ?? 0);
  const unlocked = useMemo(() => (unlockedKey ? (unlockedKey.split(',') as RoomId[]) : []), [unlockedKey]);
  const night = useIsNight();

  const walls = useMemo(buildWalls, []);
  const floors = useMemo(buildFloorsAndCeiling, []);
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
      <Exterior />
      <BuiltMeshes parts={floors} receiveShadow={shadows} />
      <group ref={wallGroup}>
        <BuiltMeshes parts={walls} castShadow={shadows} receiveShadow={shadows} />
      </group>
      <Facade pharmacyName={name} night={night} />
      <InteriorCull>
        <InteriorDetails unlocked={unlocked} warm={decor >= 3} />
      </InteriorCull>

      {INTERIOR_DOORS.map((d) => (
        <HingedDoor key={d.id} id={d.id} x={d.x} z={d.z} width={d.width} label={d.id === 'door-storage' ? 'GUDANG' : d.id === 'door-lab' ? 'LAB RACIK' : 'ADMINISTRASI'} />
      ))}
      {/* Pintu samping gudang ke gang bongkar muat (dinding x = −12, daun berayun ke dalam gudang). */}
      {SIDE_DOORS.map((d) => (
        <HingedDoor key={d.id} id={d.id} x={d.x} z={d.z} width={d.width} rotY={Math.PI / 2} label="BONGKAR MUAT" />
      ))}
      {EXPANSION_DOORS.map((d) => {
        const isUnlocked = !!d.room && unlocked.includes(d.room);
        return <HingedDoor key={d.id} id={d.id} x={d.x} z={d.z} width={d.width} locked={!isUnlocked} label={isUnlocked ? ROOM_LABELS[d.room!] : `${ROOM_LABELS[d.room!]} · TERKUNCI`} />;
      })}
    </group>
  );
}
