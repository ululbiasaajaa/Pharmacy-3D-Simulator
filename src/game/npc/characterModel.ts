import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIRST_NAMES_F } from '@/data/names';
import type { Employee, Patient } from '@/domain/types';

/**
 * Karakter "stylized realistic" prosedural (ART_DIRECTION.md §5):
 * satu SkinnedMesh per karakter, rangka 12 tulang, skinning kaku, warna per verteks
 * sehingga SEMUA karakter berbagi satu material (1 draw call per karakter).
 */

export type HairStyle = 'short' | 'crop' | 'long' | 'bun' | 'ponytail' | 'balding';
export type TopStyle = 'tshirt' | 'shirt' | 'blouse' | 'polo' | 'coat' | 'vest' | 'dress';

export interface CharacterStyle {
  key: string;
  female: boolean;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  hijab?: string;
  peci?: boolean;
  glasses?: boolean;
  top: TopStyle;
  topColor: string;
  /** Kemeja di balik jas/rompi. */
  innerColor?: string;
  longSleeves: boolean;
  bottom: 'pants' | 'skirt';
  bottomColor: string;
  shoes: string;
  nameTag?: boolean;
  /** Skala tinggi (1 = ±1,72 m). */
  height: number;
  elderly: boolean;
}

// ------------------------------------------------------------------ Rangka

export const BONE = { root: 0, spine: 1, chest: 2, head: 3, upperArmL: 4, foreArmL: 5, upperArmR: 6, foreArmR: 7, thighL: 8, shinL: 9, thighR: 10, shinR: 11 } as const;

/** Posisi sendi absolut (ruang mesh, pose ikat). Karakter menghadap +Z; sisi kiri = +X. */
export const BONE_DEFS: { parent: number; pos: [number, number, number] }[] = [
  { parent: -1, pos: [0, 0.95, 0] },
  { parent: 0, pos: [0, 1.02, 0] },
  { parent: 1, pos: [0, 1.22, 0] },
  { parent: 2, pos: [0, 1.47, 0] },
  { parent: 2, pos: [0.2, 1.42, 0] },
  { parent: 4, pos: [0.212, 1.15, 0] },
  { parent: 2, pos: [-0.2, 1.42, 0] },
  { parent: 6, pos: [-0.212, 1.15, 0] },
  { parent: 0, pos: [0.09, 0.92, 0] },
  { parent: 8, pos: [0.09, 0.5, 0] },
  { parent: 0, pos: [-0.09, 0.92, 0] },
  { parent: 10, pos: [-0.09, 0.5, 0] },
];

// ------------------------------------------------------------------ Builder geometri

type V3 = [number, number, number];
const up = new THREE.Vector3(0, 1, 0);

/** Bobot skinning per verteks (maks. 4 tulang). */
type Weigh = (x: number, y: number, z: number) => { i: [number, number, number, number]; w: [number, number, number, number] };

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Bobot kain rok/jas: bagian pinggang ikut panggul, bagian atas lutut ikut paha, bagian bawah ikut
 * tulang kering — dibagi kiri/kanan secara halus. Saat duduk kain jatuh di pangkuan, saat berjalan ikut melambai.
 */
export const clothWeights: Weigh = (x, y) => {
  const left = smoothstep(-0.07, 0.07, x);
  if (y >= 0.5) {
    const th = smoothstep(0.92, 0.62, y);
    return { i: [BONE.root, BONE.thighL, BONE.thighR, 0], w: [1 - th, th * left, th * (1 - left), 0] };
  }
  const sh = smoothstep(0.5, 0.36, y);
  return { i: [BONE.thighL, BONE.thighR, BONE.shinL, BONE.shinR], w: [(1 - sh) * left, (1 - sh) * (1 - left), sh * left, sh * (1 - left)] };
};

class RigBuilder {
  parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, bone: number, color: string, m: THREE.Matrix4, weigh?: Weigh) {
    const g = geo;
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    const n = g.getAttribute('position').count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const pos = g.getAttribute('position');
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      if (weigh) {
        const { i: idx, w } = weigh(pos.getX(i), pos.getY(i), pos.getZ(i));
        for (let k = 0; k < 4; k++) {
          si[i * 4 + k] = idx[k];
          sw[i * 4 + k] = w[k];
        }
      } else {
        si[i * 4] = bone;
        sw[i * 4] = 1;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.parts.push(g);
  }

  private mat(pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
    return new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(...scale));
  }

  /** Kapsul di antara dua titik. */
  capsule(bone: number, color: string, r: number, a: V3, b: V3, radial = 8) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = Math.max(0.001, dir.length());
    const g = new THREE.CapsuleGeometry(r, len, 2, radial);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
    const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.add(g, bone, color, m);
  }

  ellipsoid(bone: number, color: string, c: V3, r: V3, rot: V3 = [0, 0, 0], seg = 12) {
    this.add(new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7))), bone, color, this.mat(c, rot, r));
  }

  /** Bola parsial (topi rambut, kerudung) — sudut dalam radian (konvensi SphereGeometry). */
  shell(bone: number, color: string, c: V3, r: V3, phiStart: number, phiLen: number, thetaStart: number, thetaLen: number, rot: V3 = [0, 0, 0]) {
    const g = new THREE.SphereGeometry(1, 16, 8, phiStart, phiLen, thetaStart, thetaLen);
    this.add(g, bone, color, this.mat(c, rot, r));
  }

  box(bone: number, color: string, size: V3, c: V3, rot: V3 = [0, 0, 0]) {
    this.add(new THREE.BoxGeometry(...size), bone, color, this.mat(c, rot));
  }

  cylinder(bone: number, color: string, rTop: number, rBottom: number, h: number, c: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], seg = 14) {
    this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), bone, color, this.mat(c, rot, scale));
  }

  lathe(bone: number, color: string, profile: [number, number][], c: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], seg = 16, weigh?: Weigh) {
    this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), bone, color, this.mat(c, [0, 0, 0], scale), weigh);
  }

  build() {
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    merged.computeBoundingSphere();
    return merged;
  }
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** Membangun geometri karakter (pose ikat, ruang mesh). */
export function buildCharacterGeometry(s: CharacterStyle): THREE.BufferGeometry {
  const b = new RigBuilder();
  const B = BONE;
  const shoulderX = s.female ? 0.178 : 0.198;
  const hipW = s.female ? 0.172 : 0.158;
  const isCoat = s.top === 'coat';
  const sleeve = isCoat ? '#f3f2ee' : s.topColor;
  const torso = isCoat ? '#f3f2ee' : s.topColor;
  const skirt = s.bottom === 'skirt';
  const legColor = s.bottomColor;

  // Kaki & sepatu.
  for (const [x, thigh, shin] of [
    [0.09, B.thighL, B.shinL],
    [-0.09, B.thighR, B.shinR],
  ] as const) {
    b.capsule(thigh, legColor, 0.068, [x, 0.9, 0], [x, 0.54, 0]);
    b.capsule(shin, legColor, 0.052, [x, 0.5, 0], [x, 0.12, 0]);
    b.box(shin, s.shoes, [0.1, 0.07, 0.24], [x, 0.04, 0.035]);
    b.ellipsoid(shin, s.shoes, [x, 0.06, 0.12], [0.05, 0.035, 0.05], [0, 0, 0], 8);
  }
  // Panggul & perut & dada.
  b.ellipsoid(B.root, legColor, [0, 0.94, 0], [hipW + 0.012, 0.11, 0.11]);
  b.ellipsoid(B.spine, torso, [0, 1.12, 0.004], [hipW + 0.008, 0.16, 0.104]);
  b.ellipsoid(B.chest, torso, [0, 1.3, 0], [shoulderX - 0.018, 0.175, 0.112]);
  for (const sx of [1, -1]) b.ellipsoid(B.chest, sleeve, [sx * shoulderX, 1.405, 0], [0.062, 0.058, 0.062], [0, 0, 0], 8);

  if (skirt) {
    // Rok/gamis panjang (kaku mengikuti panggul).
    b.lathe(B.root, s.bottomColor, [[0, 0.09], [hipW + 0.07, 0.09], [hipW + 0.075, 0.12], [hipW + 0.07, 0.25], [hipW + 0.06, 0.4], [hipW + 0.05, 0.52], [hipW + 0.035, 0.74], [hipW + 0.02, 0.99], [0, 0.99]], [0, 0, 0], [1, 1, 0.82], 20, clothWeights);
  }
  if (isCoat) {
    // Jas apoteker: rok jas sampai paha + kerah V memperlihatkan kemeja + saku.
    b.lathe(B.root, '#f3f2ee', [[0, 0.58], [hipW + 0.075, 0.58], [hipW + 0.065, 0.7], [hipW + 0.05, 0.82], [hipW + 0.03, 1.03], [0, 1.03]], [0, 0, 0], [1, 1, 0.9], 18, clothWeights);
    b.box(B.chest, s.innerColor ?? '#9cc3e6', [0.08, 0.15, 0.012], [0, 1.37, 0.106], [-0.12, 0, 0]);
    b.box(B.chest, '#d9d7d1', [0.012, 0.3, 0.012], [0.035, 1.25, 0.11], [0, 0, -0.05]);
    b.box(B.spine, '#e6e4de', [0.09, 0.07, 0.01], [-0.08, 1.06, 0.103]);
  }
  if (s.top === 'vest') {
    b.ellipsoid(B.chest, '#f07c1f', [0, 1.3, 0], [shoulderX - 0.006, 0.178, 0.12]);
    b.ellipsoid(B.spine, '#f07c1f', [0, 1.1, 0.005], [hipW + 0.016, 0.13, 0.112]);
    b.box(B.chest, '#e6e9ea', [0.36, 0.025, 0.24], [0, 1.24, 0.0]);
    b.box(B.spine, '#e6e9ea', [0.35, 0.025, 0.23], [0, 1.08, 0.0]);
  }
  if (s.top === 'polo' || s.top === 'shirt') {
    // Kerah.
    for (const sx of [1, -1]) b.box(B.chest, shade(s.topColor, 0.85), [0.07, 0.025, 0.05], [sx * 0.04, 1.465, 0.06], [0.4, sx * 0.4, 0]);
    if (s.top === 'shirt') for (let i = 0; i < 4; i++) b.ellipsoid(B.chest, '#f4f4f0', [0, 1.4 - i * 0.07, 0.112], [0.006, 0.006, 0.004], [0, 0, 0], 6);
  }
  if (s.nameTag) b.box(B.chest, '#ffffff', [0.07, 0.025, 0.006], [0.085, 1.33, 0.112], [-0.08, 0, 0]);

  // Lengan & tangan.
  for (const [sx, upper, fore] of [
    [1, B.upperArmL, B.foreArmL],
    [-1, B.upperArmR, B.foreArmR],
  ] as const) {
    if (s.longSleeves) {
      b.capsule(upper, sleeve, 0.047, [sx * 0.203, 1.4, 0], [sx * 0.212, 1.16, 0]);
      b.capsule(fore, sleeve, 0.04, [sx * 0.213, 1.14, 0], [sx * 0.218, 0.92, 0]);
    } else {
      b.capsule(upper, sleeve, 0.05, [sx * 0.203, 1.4, 0], [sx * 0.207, 1.3, 0]);
      b.capsule(upper, s.skin, 0.042, [sx * 0.206, 1.3, 0], [sx * 0.212, 1.16, 0]);
      b.capsule(fore, s.skin, 0.037, [sx * 0.213, 1.14, 0], [sx * 0.218, 0.92, 0]);
    }
    b.ellipsoid(fore, s.skin, [sx * 0.221, 0.85, 0.008], [0.031, 0.062, 0.044], [0, 0, 0], 8);
  }

  // Leher & kepala.
  b.cylinder(B.head, s.skin, 0.044, 0.048, 0.12, [0, 1.5, 0.0]);
  b.ellipsoid(B.head, s.skin, [0, 1.637, 0.006], [0.1, 0.118, 0.11], [0, 0, 0], 14);
  for (const sx of [1, -1]) b.ellipsoid(B.head, s.skin, [sx * 0.099, 1.632, -0.002], [0.016, 0.03, 0.022], [0, 0, 0], 6);
  b.ellipsoid(B.head, shade(s.skin, 0.9), [0, 1.624, 0.111], [0.016, 0.026, 0.017], [0, 0, 0], 6);
  for (const sx of [1, -1]) {
    b.ellipsoid(B.head, '#1b1511', [sx * 0.036, 1.652, 0.099], [0.011, 0.013, 0.006], [0, 0, 0], 6);
    b.box(B.head, s.hijab ? '#2a211b' : shade(s.hair, 0.9), [0.036, 0.008, 0.01], [sx * 0.037, 1.684, 0.102], [0, 0, sx * -0.1]);
  }
  b.box(B.head, '#8f4a46', [0.038, 0.007, 0.008], [0, 1.584, 0.104]);

  if (s.hijab) {
    // Kerudung: penutup atas + sisi dengan bukaan wajah + juntaian ke bahu.
    b.shell(B.head, s.hijab, [0, 1.645, 0.0], [0.122, 0.13, 0.124], 0, Math.PI * 2, 0, 0.95);
    b.shell(B.head, s.hijab, [0, 1.645, 0.0], [0.122, 0.13, 0.124], Math.PI / 2 + 0.66, Math.PI * 2 - 1.32, 0.94, 1.75);
    b.lathe(B.chest, s.hijab, [[0, 1.3], [0.2, 1.3], [0.205, 1.33], [0.165, 1.4], [0.1, 1.48], [0.075, 1.53], [0, 1.53]], [0, 0, 0.012], [1, 1, 0.78]);
  } else {
    const capR: V3 = s.hairStyle === 'crop' ? [0.106, 0.122, 0.116] : [0.112, 0.128, 0.122];
    if (s.hairStyle === 'balding') {
      b.shell(B.head, s.hair, [0, 1.64, 0], [0.106, 0.122, 0.116], 0, Math.PI * 2, 1.0, 0.6, [-0.25, 0, 0]);
    } else {
      b.shell(B.head, s.hair, [0, 1.648, -0.004], capR, 0, Math.PI * 2, 0, 1.38, [-0.32, 0, 0]);
    }
    if (s.hairStyle === 'short' || s.hairStyle === 'crop') b.ellipsoid(B.head, s.hair, [0, 1.6, -0.045], [0.098, 0.075, 0.08]);
    if (s.hairStyle === 'long') b.ellipsoid(B.head, s.hair, [0, 1.53, -0.075], [0.108, 0.17, 0.058]);
    if (s.hairStyle === 'bun') b.ellipsoid(B.head, s.hair, [0, 1.725, -0.085], [0.05, 0.045, 0.05]);
    if (s.hairStyle === 'ponytail') b.ellipsoid(B.head, s.hair, [0, 1.585, -0.13], [0.038, 0.1, 0.04], [0.35, 0, 0]);
  }
  if (s.peci) b.cylinder(B.head, '#16181b', 0.1, 0.104, 0.085, [0, 1.735, -0.006], [-0.08, 0, 0], [1, 1, 0.92], 18);
  if (s.glasses) {
    for (const sx of [1, -1]) {
      b.box(B.head, '#2b2b2b', [0.05, 0.006, 0.006], [sx * 0.037, 1.672, 0.108]);
      b.box(B.head, '#2b2b2b', [0.05, 0.006, 0.006], [sx * 0.037, 1.636, 0.108]);
      b.box(B.head, '#2b2b2b', [0.006, 0.036, 0.006], [sx * 0.062, 1.654, 0.106]);
      b.box(B.head, '#2b2b2b', [0.005, 0.005, 0.1], [sx * 0.1, 1.664, 0.06]);
    }
    b.box(B.head, '#2b2b2b', [0.024, 0.005, 0.006], [0, 1.664, 0.11]);
  }
  return b.build();
}

const geometryCache = new Map<string, THREE.BufferGeometry>();

/** Geometri dibagikan antarkarakter bergaya sama (rangka tetap per instance). */
export function characterGeometry(s: CharacterStyle): THREE.BufferGeometry {
  let g = geometryCache.get(s.key);
  if (!g) {
    g = buildCharacterGeometry(s);
    geometryCache.set(s.key, g);
    if (geometryCache.size > 80) {
      const first = geometryCache.keys().next().value as string;
      geometryCache.get(first)?.dispose();
      geometryCache.delete(first);
    }
  }
  return g;
}

/** Satu material untuk semua karakter (warna per verteks). */
export const characterMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0 });

// ------------------------------------------------------------------ Gaya dari data domain

const SKIN = ['#f0c8a2', '#e2b48a', '#d29f74', '#bd8659', '#a87149', '#8d5a3a', '#c9926a', '#e8bf98'];
const HAIR = ['#1b1612', '#241a14', '#2e2119', '#3a2a1e', '#151313', '#4a3424'];
const GRAY_HAIR = ['#9a9790', '#bdbab3', '#7c7a75'];
const HIJAB = ['#2f4858', '#7a4b6b', '#c08b5c', '#3e6b5a', '#8a3b3b', '#d8c7b0', '#4a4e8a', '#1f2a37', '#b56576'];
const MEN_TOPS = ['#3d5a80', '#7c8b91', '#2f6f6a', '#9a3b3b', '#d9d4c7', '#384252', '#6b5b95', '#c47f2c', '#2e4a2f'];
const WOMEN_TOPS = ['#c8a2c8', '#e5989b', '#6d9dc5', '#d9b26f', '#7fb3a6', '#b56576', '#f2e6d9', '#5c6d8f', '#9e7bb5'];
const PANTS = ['#2b2f38', '#3b3f46', '#2d3b55', '#4a4237', '#1f2329', '#55606e'];
const SKIRTS = ['#3a3f4b', '#5a4a6a', '#2f4858', '#6b4f3a', '#45556b', '#7a6a58'];
const SHOES = ['#1f1f1f', '#3b2a20', '#4a4a4a', '#6b5444', '#2a2f3a'];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFrom<T>(list: T[], h: number, salt: number): T {
  return list[(h >>> (salt % 24)) % list.length];
}

function withKey(s: Omit<CharacterStyle, 'key'>): CharacterStyle {
  return { ...s, key: JSON.stringify(s) };
}

export function patientStyle(p: Pick<Patient, 'id' | 'gender' | 'age' | 'appearance'>): CharacterStyle {
  const h = hash(`${p.id}:${p.appearance}`);
  const female = p.gender === 'P';
  const elderly = p.age >= 60;
  const r = (salt: number) => ((h >>> salt) % 1000) / 1000;
  const hijab = female && r(3) < 0.5 ? pickFrom(HIJAB, h, 5) : undefined;
  const dress = !!hijab && r(7) < 0.4;
  const hairStyle: HairStyle = female ? pickFrom<HairStyle>(['long', 'bun', 'ponytail', 'long'], h, 9) : elderly && r(11) < 0.4 ? 'balding' : pickFrom<HairStyle>(['short', 'crop', 'short'], h, 13);
  const topColor = female ? pickFrom(WOMEN_TOPS, h, 2) : pickFrom(MEN_TOPS, h, 4);
  return withKey({
    female,
    skin: SKIN[(p.appearance + (h % 3)) % SKIN.length],
    hair: elderly && r(15) < 0.8 ? pickFrom(GRAY_HAIR, h, 6) : pickFrom(HAIR, h, 8),
    hairStyle,
    hijab,
    peci: !female && elderly && r(17) < 0.45,
    glasses: (elderly && r(19) < 0.6) || r(21) < 0.12,
    top: dress ? 'dress' : female ? (r(1) < 0.5 ? 'blouse' : 'tshirt') : pickFrom<TopStyle>(['tshirt', 'shirt', 'polo', 'shirt'], h, 10),
    topColor: dress ? pickFrom(SKIRTS, h, 12) : topColor,
    longSleeves: !!hijab || r(23) < 0.35,
    bottom: female && (hijab || r(25) < 0.4) ? 'skirt' : 'pants',
    bottomColor: female && (hijab || r(25) < 0.4) ? (dress ? pickFrom(SKIRTS, h, 12) : pickFrom(SKIRTS, h, 14)) : pickFrom(PANTS, h, 16),
    shoes: pickFrom(SHOES, h, 18),
    height: (female ? 0.94 : 0.99) + r(27) * 0.07 - (elderly ? 0.03 : 0),
    elderly,
  });
}

const ROLE_STYLE: Record<Employee['role'], { top: TopStyle; color: string; inner?: string }> = {
  pharmacist: { top: 'coat', color: '#f3f2ee', inner: '#9cc3e6' },
  assistant: { top: 'polo', color: '#0f8a7a' },
  cashier: { top: 'shirt', color: '#2f6fb3' },
  warehouse: { top: 'vest', color: '#6b7280' },
  manager: { top: 'shirt', color: '#1f2a44' },
};

export function staffStyle(e: Pick<Employee, 'id' | 'name' | 'role' | 'appearance'>): CharacterStyle {
  const h = hash(`${e.id}:${e.name}`);
  const female = FIRST_NAMES_F.includes(e.name.split(' ')[0]);
  const role = ROLE_STYLE[e.role];
  const r = (salt: number) => ((h >>> salt) % 1000) / 1000;
  const hijab = female && r(3) < 0.55 ? pickFrom(['#1f2a37', '#0e655b', '#2f4858', '#d8c7b0'], h, 5) : undefined;
  return withKey({
    female,
    skin: SKIN[(e.appearance + (h % 3)) % SKIN.length],
    hair: pickFrom(HAIR, h, 8),
    hairStyle: female ? pickFrom<HairStyle>(['bun', 'ponytail'], h, 9) : pickFrom<HairStyle>(['short', 'crop'], h, 13),
    hijab,
    glasses: r(21) < 0.25,
    top: role.top,
    topColor: role.color,
    innerColor: role.inner ?? (role.top === 'vest' ? '#6b7280' : undefined),
    longSleeves: role.top === 'coat' || role.top === 'shirt' || !!hijab,
    bottom: female && hijab && r(25) < 0.6 ? 'skirt' : 'pants',
    bottomColor: '#252a33',
    shoes: '#1c1c1c',
    nameTag: true,
    height: (female ? 0.95 : 1.0) + r(27) * 0.05,
    elderly: false,
  });
}

/** Avatar pemain (mode orang ketiga): apoteker berjas putih. */
export const PLAYER_STYLE: CharacterStyle = withKey({
  female: false,
  skin: '#c9926a',
  hair: '#1b1612',
  hairStyle: 'short',
  top: 'coat',
  topColor: '#f3f2ee',
  innerColor: '#0e655b',
  longSleeves: true,
  bottom: 'pants',
  bottomColor: '#252a33',
  shoes: '#1c1c1c',
  nameTag: true,
  height: 1,
  elderly: false,
});
