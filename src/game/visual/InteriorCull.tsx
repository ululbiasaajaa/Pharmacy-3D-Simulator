import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useWorld } from '@/game/world/worldStore';
import { INTERIOR_DOORS, SIDE_DOORS } from '@/game/world/layout';

/**
 * Culling interior berbasis posisi kamera (pengganti occlusion culling): isi apotek hanya dapat terlihat dari
 * dalam gedung, dari depan (lewat kaca etalase & pintu masuk), atau dari gang kiri saat pintu bongkar muat terbuka.
 * Di gang samping/belakang interior tertutup dinding & lantai atas, jadi dilewati (±300 draw call).
 */
export function isInteriorVisible(x: number, z: number, loadingDoorOpen: boolean) {
  const inside = x > -12.15 && x < 12.15 && z > -18.15 && z < 10.1;
  const front = z >= 9.9;
  const sideDoor = loadingDoorOpen && x < -12 && z > -18.2 && z < 10.2;
  return inside || front || sideDoor;
}

export function InteriorCull({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.visible = isInteriorVisible(camera.position.x, camera.position.z, !!useWorld.getState().doorsOpen[SIDE_DOORS[0].id]);
  });
  return (
    <group ref={group} name="interior-cull">
      {children}
    </group>
  );
}

/**
 * Ruang belakang (gudang, lab racik, administrasi, ruang perluasan) dipisah dinding tanpa jendela di z = −2:
 * isinya hanya terlihat dari ruang belakang itu sendiri, lewat pintu dalam yang terbuka (dari area depan atau
 * dari luar lewat kaca), atau lewat pintu bongkar muat yang terbuka dari gang kiri.
 */
export function isBackRoomVisible(x: number, z: number, doors: Record<string, boolean>) {
  const inside = x > -12.15 && x < 12.15 && z > -18.15 && z < 10.1;
  if (inside && z < -1.85) return true;
  if (INTERIOR_DOORS.some((d) => doors[d.id]) && (inside || z >= 9.9)) return true;
  return !!doors[SIDE_DOORS[0].id] && x < -12 && z > -18.2 && z < 10.2;
}

export function BackRoomCull({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (g) g.visible = isBackRoomVisible(camera.position.x, camera.position.z, useWorld.getState().doorsOpen);
  });
  return (
    <group ref={group} name="back-room-cull">
      {children}
    </group>
  );
}

/**
 * Uji "portal" untuk benda di luar gedung (NPC jalanan, kendaraan): dari dalam apotek, dunia luar hanya terlihat lewat
 * kaca etalase depan (benda di depan muka gedung, z > 10,1) atau lewat pintu bongkar muat yang terbuka (gang kiri).
 * `maxDist` membatasi jarak pandang untuk figur kecil (penjaga kios, pejalan kaki) di luar.
 */
export function outsideVisible(camX: number, camZ: number, x: number, z: number, maxDist = Infinity) {
  if ((camX - x) ** 2 + (camZ - z) ** 2 > maxDist * maxDist) return false;
  const camInside = camX > -12.15 && camX < 12.15 && camZ > -18.15 && camZ < 10.1;
  const objInside = x > -12.15 && x < 12.15 && z > -18.15 && z < 10.1;
  if (!camInside || objInside) return true;
  if (z > 10.1) {
    // Garis pandang harus menembus bidang etalase (z = 10) di dalam bentang kaca, bukan dinding samping.
    const t = (10 - camZ) / (z - camZ);
    return Math.abs(camX + (x - camX) * t) < 11.8;
  }
  return x < -12.1 && !!useWorld.getState().doorsOpen[SIDE_DOORS[0].id];
}
