import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { daylight } from './daylight';

/** Bentang kaca etalase (x0, x1) + pintu masuk. */
const BAYS: [number, number][] = [
  [-11.79, -6.57],
  [-6.23, -1.55],
  [-1.2, 1.2],
  [1.55, 6.23],
  [6.57, 11.79],
];
const Y0 = 0.56;
const Y1 = 2.72;
const GLASS_Z = 10.05;
/** Genangan sinar berhenti di depan meja pelayanan (meja menghalangi sinar ke area staf). */
const MIN_Z = 2.5;

function patchTexture(): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, s, s);
    // Tepi lembut.
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.06, 'rgba(255,255,255,1)');
    g.addColorStop(0.94, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, s * 0.04, s, s * 0.92);
    // Bayangan mullion & palang transom.
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    for (const u of [1 / 3, 2 / 3]) ctx.fillRect(u * s - 2, 0, 4, s);
    ctx.fillRect(0, s * (1 - (2.22 - Y0) / (Y1 - Y0)) - 2, s, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Sinar matahari yang masuk lewat etalase, diproyeksikan ke lantai mengikuti arah matahari
 * (pengganti murah bayangan real-time di kualitas Rendah/Sedang).
 */
export function SunPatches() {
  const mesh = useRef<THREE.Mesh>(null);
  const last = useRef(-1);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BAYS.length * 4 * 3), 3));
    const uv: number[] = [];
    const idx: number[] = [];
    BAYS.forEach((_, i) => {
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      const o = i * 4;
      idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    });
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: patchTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m || Math.abs(daylight.minute - last.current) < 0.5) return;
    last.current = daylight.minute;
    const d = daylight.current;
    const s = d.sunDir;
    const k = s.z > 0.05 && s.y > 0.1 ? d.sunIntensity * Math.min(1, s.z * 1.5) : 0;
    m.visible = k > 0.03;
    if (!m.visible) return;
    material.color.copy(d.sunColor).multiplyScalar(k * 0.085);
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    BAYS.forEach(([x0, x1], i) => {
      const corners: [number, number][] = [
        [x0, Y0],
        [x1, Y0],
        [x1, Y1],
        [x0, Y1],
      ];
      corners.forEach(([x, y], c) => {
        const px = x - (s.x * y) / s.y;
        const pz = Math.max(MIN_Z, GLASS_Z - (s.z * y) / s.y);
        pos.setXYZ(i * 4 + c, px, 0.006, pz);
      });
    });
    pos.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={2} raycast={() => null} frustumCulled={false} />;
}
