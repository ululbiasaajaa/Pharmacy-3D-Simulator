import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGame } from '@/stores/gameStore';
import { EXPANSION_FURNITURE, EXPANSION_ROOMS, FURNITURE, UPGRADE_FURNITURE, WALLS, type AABB } from '@/game/world/layout';
import { CEILING_LIGHTS } from '@/game/world/Architecture';
import type { RoomId } from '@/domain/types';

/** Area lantai yang menerima AO terpanggang (meter). */
const EXTENT = { minX: -16.5, maxX: 16.5, minZ: -18.5, maxZ: 16 };

/**
 * Ambient occlusion lantai yang "dipanggang" dari data tata letak ke satu tekstur kanvas:
 * bayangan lembut di kaki dinding dan di bawah/sekitar perabot. Satu draw call, tanpa
 * render bayangan per frame. Dibuat ulang hanya saat perabot/ruang berubah.
 */
export function FloorAO({ pxPerMeter }: { pxPerMeter: number }) {
  const roomsKey = useGame((s) => (s.game?.pharmacy.unlockedRooms ?? []).join(','));
  const islandShelf = useGame((s) => (s.game?.pharmacy.upgrades.shelf ?? 0) >= 1);
  const chairsB = useGame((s) => (s.game?.pharmacy.upgrades['waiting-room'] ?? 0) >= 2);

  const texture = useMemo(() => {
    const rooms = roomsKey ? (roomsKey.split(',') as RoomId[]) : [];
    const furniture: AABB[] = [...Object.values(FURNITURE)];
    if (islandShelf) furniture.push(UPGRADE_FURNITURE.islandShelf);
    if (chairsB) furniture.push(UPGRADE_FURNITURE.chairsB);
    for (const [room, boxes] of Object.entries(EXPANSION_FURNITURE)) if (rooms.includes(room as RoomId)) furniture.push(...boxes);
    return bakeAO(furniture, pxPerMeter);
  }, [roomsKey, islandShelf, chairsB, pxPerMeter]);

  useEffect(() => () => texture.dispose(), [texture]);

  const poolMaterial = useMemo(() => {
    const rooms = roomsKey ? (roomsKey.split(',') as RoomId[]) : [];
    const pools: [number, number][] = [...CEILING_LIGHTS];
    for (const [room, p] of Object.entries(EXPANSION_ROOMS)) if (rooms.includes(room as RoomId)) pools.push([p.x, p.z]);
    return new THREE.MeshBasicMaterial({
      map: bakePools(pools, Math.max(6, pxPerMeter / 3)),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    });
  }, [roomsKey, pxPerMeter]);
  useEffect(
    () => () => {
      poolMaterial.map?.dispose();
      poolMaterial.dispose();
    },
    [poolMaterial],
  );

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    [texture],
  );
  useEffect(() => () => material.dispose(), [material]);

  const w = EXTENT.maxX - EXTENT.minX;
  const d = EXTENT.maxZ - EXTENT.minZ;
  const center: [number, number, number] = [(EXTENT.minX + EXTENT.maxX) / 2, 0.003, (EXTENT.minZ + EXTENT.maxZ) / 2];
  return (
    <>
      <mesh material={material} rotation={[-Math.PI / 2, 0, 0]} position={center} raycast={() => null} renderOrder={1}>
        <planeGeometry args={[w, d]} />
      </mesh>
      <mesh material={poolMaterial} rotation={[-Math.PI / 2, 0, 0]} position={[center[0], 0.004, center[2]]} raycast={() => null} renderOrder={1}>
        <planeGeometry args={[w, d]} />
      </mesh>
    </>
  );
}

/** Genangan cahaya hangat di lantai di bawah setiap lampu plafon (ditambahkan secara aditif). */
function bakePools(pools: [number, number][], ppm: number): THREE.CanvasTexture {
  const w = Math.round((EXTENT.maxX - EXTENT.minX) * ppm);
  const h = Math.round((EXTENT.maxZ - EXTENT.minZ) * ppm);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, z] of pools) {
      const cx = (x - EXTENT.minX) * ppm;
      const cy = (z - EXTENT.minZ) * ppm;
      const r = 2.6 * ppm;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,236,212,0.16)');
      g.addColorStop(0.5, 'rgba(255,236,212,0.07)');
      g.addColorStop(1, 'rgba(255,236,212,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bakeAO(furniture: AABB[], ppm: number): THREE.CanvasTexture {
  const w = Math.round((EXTENT.maxX - EXTENT.minX) * ppm);
  const h = Math.round((EXTENT.maxZ - EXTENT.minZ) * ppm);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Bayangan bentuk yang digambar di luar kanvas (teknik shadowBlur: didukung semua browser).
    const off = w * 2;
    const soft = (b: AABB, pad: number, alpha: number, blurM: number) => {
      ctx.shadowColor = `rgba(0,0,0,${alpha})`;
      ctx.shadowBlur = blurM * ppm;
      ctx.shadowOffsetX = off;
      ctx.fillStyle = '#000';
      const x = (b.minX - pad - EXTENT.minX) * ppm;
      const y = (b.minZ - pad - EXTENT.minZ) * ppm;
      ctx.fillRect(x - off, y, (b.maxX - b.minX + pad * 2) * ppm, (b.maxZ - b.minZ + pad * 2) * ppm);
    };
    for (const b of WALLS) soft(b, 0.06, 0.32, 0.45);
    for (const b of furniture) soft(b, 0.02, 0.5, 0.22);
    // Inti gelap tipis tepat di bawah perabot (kontak).
    for (const b of furniture) soft(b, -0.02, 0.35, 0.06);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}
