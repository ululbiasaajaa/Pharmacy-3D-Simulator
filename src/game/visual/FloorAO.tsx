import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGame } from '@/stores/gameStore';
import { EXPANSION_FURNITURE, EXPANSION_ROOMS, FURNITURE, UPGRADE_FURNITURE, WALLS, type AABB } from '@/game/world/layout';
import { CEILING_LIGHTS } from '@/game/world/Architecture';
import type { RoomId } from '@/domain/types';
import { DISTRICT_BOUNDS, districtColliders } from '@/game/world/district';

/**
 * Area lantai interior yang menerima AO terpanggang & genangan cahaya (meter): hanya di dalam gedung, agar lapisan
 * transparan ini tidak menumpuk dengan AO kawasan di halaman/gang (biaya isi piksel di iGPU).
 */
const EXTENT = { minX: -12.1, maxX: 12.1, minZ: -18.1, maxZ: 10.0 };

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

  const exterior = useMemo(bakeExteriorAO, []);
  useEffect(
    () => () => {
      exterior.map?.dispose();
      exterior.dispose();
    },
    [exterior],
  );

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
      {/* AO kontak kawasan (bangunan, dinding luar apotek, properti jalan) — di atas lantai teras (y 0,016), berlubang di area gedung. */}
      <mesh name="district-ao" material={exterior} geometry={EXT_GEOMETRY} raycast={() => null} renderOrder={1} />
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

/** Area AO kawasan (seluruh batas dunia + gerbang). */
const EXT = { minX: DISTRICT_BOUNDS.minX - 0.8, maxX: DISTRICT_BOUNDS.maxX + 0.8, minZ: DISTRICT_BOUNDS.minZ - 0.5, maxZ: DISTRICT_BOUNDS.maxZ + 0.2 };
const EXT_PPM = 10;

/** Bidang AO kawasan: empat persegi di sekeliling gedung apotek (interior memakai AO-nya sendiri). UV = koordinat dunia. */
const EXT_GEOMETRY = (() => {
  const quads: [number, number, number, number][] = [
    [EXT.minX, EXT.maxX, EXTENT.maxZ, EXT.maxZ],
    [EXT.minX, EXTENT.minX, EXT.minZ, EXTENT.maxZ],
    [EXTENT.maxX, EXT.maxX, EXT.minZ, EXTENT.maxZ],
    [EXTENT.minX, EXTENT.maxX, EXT.minZ, EXTENT.minZ],
  ];
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const W = EXT.maxX - EXT.minX;
  const H = EXT.maxZ - EXT.minZ;
  for (const [x0, x1, z0, z1] of quads) {
    const base = pos.length / 3;
    for (const [x, z] of [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]) {
      pos.push(x, 0.02, z);
      uv.push((x - EXT.minX) / W, 1 - (z - EXT.minZ) / H);
    }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
})();

/**
 * AO kontak kawasan dipanggang sekali dari collider kawasan (ruko, gerbang, properti jalan) pada 10 px/m:
 * pita gelap lembut di kaki bangunan dan di bawah properti. Satu draw call, ±0,4 MB.
 */
function bakeExteriorAO(): THREE.MeshBasicMaterial {
  const w = Math.round((EXT.maxX - EXT.minX) * EXT_PPM);
  const h = Math.round((EXT.maxZ - EXT.minZ) * EXT_PPM);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const off = w * 2;
    const soft = (b: AABB, pad: number, alpha: number, blurM: number) => {
      ctx.shadowColor = `rgba(0,0,0,${alpha})`;
      ctx.shadowBlur = blurM * EXT_PPM;
      ctx.shadowOffsetX = off;
      ctx.fillStyle = '#000';
      ctx.fillRect((b.minX - pad - EXT.minX) * EXT_PPM - off, (b.minZ - pad - EXT.minZ) * EXT_PPM, (b.maxX - b.minX + pad * 2) * EXT_PPM, (b.maxZ - b.minZ + pad * 2) * EXT_PPM);
    };
    // Dinding apotek (pita gelap di kaki dinding luar, di gang & gang belakang) + collider kawasan.
    for (const b of WALLS) soft(b, 0.06, 0.3, 0.45);
    for (const b of districtColliders()) {
      const big = b.maxX - b.minX > 3 || b.maxZ - b.minZ > 3;
      soft(b, big ? 0.05 : 0.04, big ? 0.34 : 0.42, big ? 0.6 : 0.25);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
}

