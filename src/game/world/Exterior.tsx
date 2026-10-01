import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GeoBuilder, floorQuad } from '@/game/visual/geometry';
import { BuiltMeshes } from '@/game/visual/Built';
import { LightHalo } from '@/game/visual/LightHalo';
import { daylight } from '@/game/visual/daylight';
import { useVisualProfile } from '@/game/visual/quality';
import { CanvasLabel } from './CanvasLabel';
import { MAT, type MatKey } from './materials';

/**
 * Lingkungan luar (ART_DIRECTION.md §3 & §7): deretan ruko fiktif, parkir, trotoar,
 * jalan, lampu jalan, tiang listrik, pohon, dan motor parkir. Semua statis → digabung per material.
 */
type B = GeoBuilder<MatKey>;

const FACADES: MatKey[] = ['facadeA', 'facadeB', 'facadeC', 'facadeD'];
const AWNINGS: MatKey[] = ['awningRed', 'awningBlue', 'awningGreen'];

interface Shop {
  x0: number;
  x1: number;
  /** Muka depan bangunan (z) dan arah hadap (+1 = menghadap +Z / jalan di depan apotek). */
  front: number;
  facing: 1 | -1;
  height: number;
  name: string;
  sign: string;
  open: boolean;
}

/** Ruko di sisi yang sama (kiri/kanan apotek) dan seberang jalan. Nama toko generik & fiktif. */
export const SHOPS: Shop[] = [
  { x0: -40, x1: -32.2, front: 10.1, facing: 1, height: 10.2, name: 'TOKO KELONTONG', sign: '#1f5f99', open: true },
  { x0: -32, x1: -24.3, front: 10.1, facing: 1, height: 7.4, name: 'LAUNDRY KILOAN', sign: '#2e8bc0', open: false },
  { x0: -24.1, x1: -16.6, front: 10.1, facing: 1, height: 8.6, name: 'FOTOKOPI & ATK', sign: '#c0392b', open: true },
  { x0: 16.6, x1: 24.2, front: 10.1, facing: 1, height: 8.2, name: 'KONTER PULSA', sign: '#e67e22', open: true },
  { x0: 24.4, x1: 32, front: 10.1, facing: 1, height: 10.6, name: 'TOKO BANGUNAN', sign: '#7f8c8d', open: false },
  { x0: 32.2, x1: 40, front: 10.1, facing: 1, height: 7.2, name: 'WARUNG MAKAN', sign: '#27ae60', open: true },
  { x0: -36, x1: -27, front: 25.2, facing: -1, height: 8.4, name: 'BENGKEL MOTOR', sign: '#34495e', open: true },
  { x0: -26.8, x1: -18, front: 25.2, facing: -1, height: 10.4, name: 'TOKO ROTI', sign: '#d35400', open: true },
  { x0: -17.8, x1: -9, front: 25.2, facing: -1, height: 7.6, name: 'SALON', sign: '#8e44ad', open: false },
  { x0: -8.8, x1: 0, front: 25.2, facing: -1, height: 9.8, name: 'TOKO EMAS', sign: '#b7950b', open: false },
  { x0: 0.2, x1: 9, front: 25.2, facing: -1, height: 8.2, name: 'KEDAI KOPI', sign: '#6e2c00', open: true },
  { x0: 9.2, x1: 18, front: 25.2, facing: -1, height: 10.8, name: 'TOKO SEPATU', sign: '#2c3e50', open: false },
  { x0: 18.2, x1: 27, front: 25.2, facing: -1, height: 7.8, name: 'PERCETAKAN', sign: '#16a085', open: true },
  { x0: 27.2, x1: 36, front: 25.2, facing: -1, height: 9.2, name: 'TOKO KAIN', sign: '#a93226', open: false },
];

function shopModel(b: B, s: Shop, i: number) {
  const w = s.x1 - s.x0;
  const cx = (s.x0 + s.x1) / 2;
  const depth = s.facing === 1 ? 16 : 9;
  const f = s.facing;
  const zFront = s.front;
  const zc = zFront - (f * depth) / 2;
  const mat = FACADES[i % FACADES.length];
  // Massa bangunan + ambang atap.
  b.box(mat, w, s.height, depth, cx, s.height / 2, zc, { r: 0 });
  b.box(mat, w + 0.1, 0.25, 0.32, cx, s.height + 0.05, zFront + f * 0.05, { r: 0.01 });
  // Lantai dasar: bukaan toko gelap (terbuka) atau rolling door tertutup.
  const doorW = w - 1.2;
  if (s.open) {
    b.box('shopDark', doorW, 2.9, 0.1, cx, 1.45, zFront + f * 0.02, { r: 0 });
    b.box('shutter', doorW, 0.6, 0.06, cx, 2.6, zFront + f * 0.06, { r: 0 });
    // Rak & barang samar di dalam toko.
    for (let k = 0; k < 3; k++) b.box('cardboard', doorW * 0.25, 0.5, 0.05, cx - doorW * 0.3 + k * doorW * 0.3, 0.9 + (k % 2) * 0.6, zFront + f * 0.08, { r: 0 });
  } else {
    b.box('shutter', doorW, 2.9, 0.06, cx, 1.45, zFront + f * 0.03, { r: 0 });
  }
  b.box('metalDark', doorW + 0.2, 0.32, 0.3, cx, 3.06, zFront + f * 0.15, { r: 0.01 });
  // Tenda (awning) miring.
  b.box(AWNINGS[i % AWNINGS.length], w - 0.4, 0.04, 1.3, cx, 3.35, zFront + f * 0.62, { rotX: f * 0.32, r: 0 });
  // Papan nama di atas tenda.
  b.box('metalDark', w * 0.82, 0.86, 0.08, cx, 4.2, zFront + f * 0.04, { r: 0.02 });
  // Jendela lantai atas (menyala di malam hari).
  const floors = Math.max(1, Math.floor((s.height - 4.6) / 2.6) + 1);
  for (let fl = 0; fl < floors; fl++) {
    const y = 5.6 + fl * 2.6;
    if (y + 0.8 > s.height - 0.3) break;
    const n = Math.max(2, Math.round(w / 2.4));
    for (let k = 0; k < n; k++) {
      const x = s.x0 + (w / n) * (k + 0.5);
      b.box('aluminum', 1.4, 1.3, 0.06, x, y, zFront + f * 0.01, { r: 0.004 });
      b.box((k + fl + i) % 3 === 0 ? 'windowLit' : 'glassDark', 1.3, 1.2, 0.02, x, y, zFront + f * 0.04, { r: 0 });
    }
    if (fl === 0 && i % 2 === 0) b.box('white', 0.8, 0.5, 0.3, s.x0 + w * 0.8, y - 1.0, zFront + f * 0.2, { r: 0.02 });
  }
  // Teras keramik.
  if (f === 1) b.add('terrace', floorQuad(s.x0, s.x1, zFront, zFront + 1.1, 0.015));
}

function motorbike(b: B, x: number, z: number, rotY: number, body: MatKey) {
  b.group(x, 0, z, rotY, () => {
    for (const zz of [-0.62, 0.62]) {
      b.cylinder('tire', 0.25, 0.25, 0.09, 0, 0.25, zz, { rotZ: Math.PI / 2, seg: 16 });
      b.cylinder('chrome', 0.1, 0.1, 0.1, 0, 0.25, zz, { rotZ: Math.PI / 2, seg: 10 });
    }
    b.box(body, 0.34, 0.28, 1.0, 0, 0.55, -0.15, { r: 0.08 });
    b.box('bikeBlack', 0.3, 0.1, 0.62, 0, 0.74, -0.22, { r: 0.04 });
    b.box(body, 0.3, 0.55, 0.22, 0, 0.66, 0.5, { rotX: -0.25, r: 0.06 });
    b.box('bikeBlack', 0.22, 0.12, 0.6, 0, 0.36, 0.12, { r: 0.04 });
    b.cylinder('metalDark', 0.018, 0.018, 0.62, 0, 1.0, 0.56, { rotZ: Math.PI / 2, seg: 8 });
    b.box('lampGlow', 0.14, 0.08, 0.04, 0, 0.92, 0.66, { r: 0.02 });
    b.cylinder('metalDark', 0.012, 0.012, 0.6, -0.22, 0.3, 0.0, { rotZ: 0.4, seg: 6 });
  });
}

function streetLamp(b: B, x: number, z: number, facing: 1 | -1) {
  b.cylinder('metalDark', 0.07, 0.1, 6.2, x, 3.1, z, { seg: 12 });
  b.cylinder('concrete', 0.18, 0.2, 0.4, x, 0.2, z, { seg: 12 });
  b.box('metalDark', 0.08, 0.08, 1.4, x, 6.1, z - facing * 0.65, { rotX: facing * 0.12, r: 0.02 });
  b.box('metalDark', 0.32, 0.12, 0.6, x, 6.0, z - facing * 1.3, { r: 0.03 });
  b.box('lampGlow', 0.26, 0.03, 0.5, x, 5.93, z - facing * 1.3, { r: 0 });
}

function tree(b: B, x: number, z: number, seed: number) {
  let r = seed * 9301 + 49297;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  b.cylinder('concrete', 0.55, 0.6, 0.4, x, 0.2, z, { seg: 16 });
  b.cylinder('soil', 0.5, 0.5, 0.02, x, 0.39, z, { seg: 16 });
  b.cylinder('trunk', 0.11, 0.17, 2.6, x, 1.5, z, { seg: 8 });
  b.cylinder('trunk', 0.06, 0.09, 1.2, x + 0.3, 2.9, z, { rotZ: -0.6, seg: 6 });
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd();
    const rad = 0.6 + rnd() * 0.7;
    const y = 3.2 + rnd() * 1.4;
    b.add(rnd() > 0.35 ? 'treeLeaf' : 'treeLeafLight', new THREE.IcosahedronGeometry(0.75 + rnd() * 0.5, 1), x + Math.cos(a) * rad, y, z + Math.sin(a) * rad);
  }
  b.add('treeLeaf', new THREE.IcosahedronGeometry(1.1, 1), x, 4.4, z);
}

function powerPole(b: B, x: number, z: number) {
  b.cylinder('concrete', 0.12, 0.17, 9, x, 4.5, z, { seg: 10 });
  b.box('metalDark', 1.8, 0.1, 0.1, x, 8.4, z, { r: 0 });
  for (const dx of [-0.8, 0, 0.8]) b.cylinder('white', 0.04, 0.05, 0.12, x + dx, 8.52, z, { seg: 8 });
}

/** Kabel listrik melendut di antara dua tiang (beberapa segmen lurus). */
function cable(b: B, x0: number, x1: number, y: number, z: number, sag: number) {
  const segs = 6;
  let prev = new THREE.Vector3(x0, y, z);
  for (let k = 1; k <= segs; k++) {
    const t = k / segs;
    const p = new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(Math.PI * t) * sag, z);
    const mid = prev.clone().add(p).multiplyScalar(0.5);
    const len = prev.distanceTo(p);
    const ang = Math.atan2(p.y - prev.y, p.x - prev.x);
    b.cylinder('black', 0.012, 0.012, len, mid.x, mid.y, mid.z, { rotZ: ang - Math.PI / 2, seg: 4 });
    prev = p;
  }
}

function buildStreet(full: boolean) {
  const b = new GeoBuilder<MatKey>();
  // Tanah dasar, parkir/trotoar depan, gang samping, jalan, trotoar seberang.
  b.add('ground', floorQuad(-90, 90, -70, 90, -0.02));
  b.add('sidewalk', floorQuad(-40, 40, 10, 14.8));
  for (const [x0, x1] of [
    [-16.6, -12.2],
    [12.2, 16.6],
  ])
    b.add('concrete', floorQuad(x0, x1, -18, 10, 0.002));
  b.add('road', floorQuad(-40, 40, 15, 22));
  b.add('sidewalk', floorQuad(-40, 40, 22.2, 25.2));
  // Kanstin bercat hitam-putih (khas jalan di Indonesia).
  for (let x = -40; x < 40; x += 0.5) {
    const m: MatKey = Math.round((x + 40) / 0.5) % 2 === 0 ? 'curbWhite' : 'curbBlack';
    b.box(m, 0.5, 0.15, 0.2, x + 0.25, 0.075, 14.9, { r: 0 });
    b.box(m, 0.5, 0.15, 0.2, x + 0.25, 0.075, 22.1, { r: 0 });
  }
  // Marka jalan: garis tepi menerus + garis tengah putus-putus.
  for (const z of [15.35, 21.65]) b.box('roadPaint', 80, 0.004, 0.1, 0, 0.002, z, { r: 0 });
  for (let x = -39; x < 40; x += 5) b.box('roadPaint', 2.4, 0.004, 0.12, x, 0.002, 18.5, { r: 0 });
  // Pagar ujung gang.
  for (const [x0, x1] of [
    [-16.6, -12.2],
    [12.2, 16.6],
  ])
    b.box('concrete', x1 - x0, 2.4, 0.15, (x0 + x1) / 2, 1.2, -17.9, { r: 0 });
  SHOPS.forEach((s, i) => shopModel(b, s, i));
  streetLamp(b, -13.4, 14.5, 1);
  streetLamp(b, 13.4, 14.5, 1);
  streetLamp(b, -24, 22.6, -1);
  streetLamp(b, 2, 22.6, -1);
  streetLamp(b, 26, 22.6, -1);
  tree(b, 14.3, 13.4, 3);
  tree(b, -14.4, 13.4, 7);
  if (full) {
    tree(b, -30, 23.6, 11);
    tree(b, -6, 23.6, 13);
    tree(b, 14, 23.6, 17);
    tree(b, 31, 23.6, 19);
    const poles = [-36, -18, 0, 18, 36];
    poles.forEach((x) => powerPole(b, x, 23.4));
    for (let k = 0; k < poles.length - 1; k++) for (const dx of [-0.8, 0, 0.8]) cable(b, poles[k] + dx, poles[k + 1] + dx, 8.55, 23.4, 0.45);
  }
  motorbike(b, -10.6, 12.5, Math.PI + 0.2, 'bikeRed');
  motorbike(b, -9.5, 12.6, Math.PI + 0.25, 'bikeBlack');
  motorbike(b, 8.5, 11.9, Math.PI - 0.2, 'bikeWhite');
  motorbike(b, 9.7, 12.0, Math.PI - 0.15, 'bikeBlue');
  return b.build();
}

/**
 * Material luar ruangan: pantulan IBL (yang dibuat untuk interior) diredam saat malam
 * agar fasad & jalan gelap, sementara interior tetap terang oleh lampunya sendiri.
 */
const OUTDOOR: MatKey[] = ['facade', 'facadeA', 'facadeB', 'facadeC', 'facadeD', 'facadeAccent', 'sidewalk', 'road', 'concrete', 'ground', 'curbWhite', 'curbBlack', 'roadPaint', 'terrace', 'stone', 'shutter', 'awningRed', 'awningBlue', 'awningGreen', 'glassDark', 'trunk', 'treeLeaf', 'treeLeafLight', 'tire', 'bikeRed', 'bikeBlack', 'bikeWhite', 'bikeBlue'];

/** Intensitas emisif mengikuti siang/malam: jendela, lampu jalan, downlight kanopi, tanda plus. */
function NightMaterials() {
  useFrame(({ scene }) => {
    const n = THREE.MathUtils.smoothstep(daylight.current.night, 0.15, 0.85);
    const env = (1 - n * 0.88) * 0.85;
    // envMapIntensity material hanya berlaku bila envMap dipasang langsung (bukan lewat scene.environment).
    const tex = scene.environment;
    for (const k of OUTDOOR) {
      const m = MAT[k] as THREE.MeshStandardMaterial;
      if (m.envMap !== tex) {
        m.envMap = tex;
        m.needsUpdate = true;
      }
      m.envMapIntensity = env;
    }
    MAT.windowLit.emissiveIntensity = 0.04 + n * 1.2;
    MAT.lampGlow.emissiveIntensity = 0.1 + n * 2.6;
    MAT.emissiveWarm.emissiveIntensity = 0.6 + n * 1.4;
    MAT.signGreen.emissiveIntensity = 0.9 + n * 0.9;
  });
  return null;
}

const LAMPS: [number, number, number][] = [
  [-13.4, 5.9, 13.2],
  [13.4, 5.9, 13.2],
  [-24, 5.9, 23.9],
  [2, 5.9, 23.9],
  [26, 5.9, 23.9],
];

export function Exterior() {
  const profile = useVisualProfile();
  const full = profile.quality !== 'low';
  const parts = useMemo(() => buildStreet(full), [full]);
  return (
    <group>
      <BuiltMeshes parts={parts} castShadow={profile.sunShadows} />
      <NightMaterials />
      {SHOPS.map((s) => (
        <CanvasLabel
          key={s.name}
          text={s.name}
          width={(s.x1 - s.x0) * 0.78}
          height={0.72}
          position={[(s.x0 + s.x1) / 2, 4.2, s.front + s.facing * 0.09]}
          rotation={s.facing === 1 ? undefined : [0, Math.PI, 0]}
          background={s.sign}
          fontSize={130}
        />
      ))}
      {profile.halos && LAMPS.map(([x, y, z]) => <LightHalo key={`${x},${z}`} position={[x, y, z]} size={2.6} warm nightOnly />)}
      {/* Genangan cahaya lampu jalan di tanah (malam). */}
      {LAMPS.map(([x, , z]) => (
        <LightHalo key={`pool-${x},${z}`} position={[x, 0.03, z]} size={9} color="#ffcf8a" facing="up" nightOnly intensity={1} />
      ))}
      {profile.halos && <LightHalo position={[11.55, 4.4, 10.85]} size={1.6} color="#7dffb8" nightOnly />}
    </group>
  );
}
