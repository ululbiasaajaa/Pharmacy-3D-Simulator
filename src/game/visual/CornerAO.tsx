import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL_H, WALLS, type AABB } from '@/game/world/layout';

/**
 * AO sudut "terpanggang" (ART_DIRECTION.md §7): strip gradien gelap di kaki dinding, di puncak
 * dinding, dan di tepi plafon — sisi dalam bangunan saja. Pengganti murah AO layar untuk GPU
 * terintegrasi: satu draw call transparan, tanpa biaya per frame (N8AO ±16 ms di Iris Xe 1080p).
 * Lantai di kaki dinding sudah ditangani `FloorAO`.
 */
const INSIDE = { minX: -12, maxX: 12, minZ: -18, maxZ: 10 };
const isFront = (w: AABB) => Math.abs((w.minZ + w.maxZ) / 2 - 10) < 0.01;
const inside = (x: number, z: number) => x > INSIDE.minX && x < INSIDE.maxX && z > INSIDE.minZ && z < INSIDE.maxZ;

type V3 = [number, number, number];

/** Quad dari tepi sudut (a0,a1; v=0, gelap) ke tepi luar (b0,b1; v=1, transparan). */
function strip(a0: V3, a1: V3, b0: V3, b1: V3, alpha: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a0, ...a1, ...b1, ...b0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute([0, 0, 0, alpha, 0, 0, 0, alpha, 0, 0, 0, alpha, 0, 0, 0, alpha], 4));
  g.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]);
  return g;
}

/** Diekspor untuk pengujian. */
export function buildStrips(): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  const e = 0.004; // sedikit di depan permukaan
  for (const w of WALLS) {
    if (isFront(w)) continue;
    const alongX = w.maxX - w.minX >= w.maxZ - w.minZ;
    const faces = alongX
      ? [
          { n: -1, c: w.minZ, a0: w.minX, a1: w.maxX },
          { n: 1, c: w.maxZ, a0: w.minX, a1: w.maxX },
        ]
      : [
          { n: -1, c: w.minX, a0: w.minZ, a1: w.maxZ },
          { n: 1, c: w.maxX, a0: w.minZ, a1: w.maxZ },
        ];
    for (const f of faces) {
      const mid = (f.a0 + f.a1) / 2;
      const probe = f.c + f.n * 0.3;
      if (alongX ? !inside(mid, probe) : !inside(probe, mid)) continue;
      // Titik pada permukaan dinding (u sepanjang dinding, d = jarak dari dinding, y = tinggi).
      const P = (u: number, y: number, d = 0): V3 => (alongX ? [u, y, f.c + f.n * (e + d)] : [f.c + f.n * (e + d), y, u]);
      // Kaki dinding (di atas plint 10 cm) → 0,5 m.
      parts.push(strip(P(f.a0, 0.1), P(f.a1, 0.1), P(f.a0, 0.55), P(f.a1, 0.55), 0.3));
      // Puncak dinding di bawah plafon → 0,6 m.
      parts.push(strip(P(f.a0, WALL_H - 0.002), P(f.a1, WALL_H - 0.002), P(f.a0, WALL_H - 0.6), P(f.a1, WALL_H - 0.6), 0.34));
      // Tepi plafon → 0,7 m dari dinding.
      parts.push(strip(P(f.a0, WALL_H - e, -e), P(f.a1, WALL_H - e, -e), P(f.a0, WALL_H - e, 0.7), P(f.a1, WALL_H - e, 0.7), 0.3));
    }
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Gradien alfa sepanjang V: gelap di sudut, memudar halus (kurva kuadrat). */
function gradientTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    for (let y = 0; y < c.height; y++) {
      const v = y / (c.height - 1);
      ctx.fillStyle = `rgba(255,255,255,${Math.pow(1 - v, 2.2).toFixed(3)})`;
      ctx.fillRect(0, y, c.width, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  // Kanvas baris 0 = atas; UV v=0 harus gelap → tanpa flip.
  t.flipY = false;
  return t;
}

export function CornerAO() {
  const geometry = useMemo(buildStrips, []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: gradientTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
        // Tanpa polygonOffset: offset berbasis kemiringan menarik strip yang terlihat dari samping
        // menembus dinding. Strip sudah diberi jarak fisik 4 mm dari permukaan.
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry?.dispose();
      material.map?.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} raycast={() => null} renderOrder={1} />;
}
