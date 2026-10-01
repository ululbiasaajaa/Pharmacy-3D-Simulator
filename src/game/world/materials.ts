import * as THREE from 'three';
import { disposeTexturesExcept, getTextureSet, type TextureName } from '@/game/visual/textures';
import type { VisualProfile } from '@/game/visual/quality';

/**
 * Material bersama (dibuat sekali) agar scene ringan. Semua aset 3D dibuat dari kode sendiri.
 * Palet mengikuti ART_DIRECTION.md §7.
 */
const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });

export const MAT = {
  floorFront: std('#ffffff', { roughness: 0.3 }),
  floorBack: std('#d2cfc8', { roughness: 0.55 }),
  floorLab: std('#e2ebe7', { roughness: 0.3 }),
  floorExpansion: std('#c6c3bb', { roughness: 0.6 }),
  wall: std('#efeae0', { roughness: 0.88 }),
  wallBack: std('#e8e2d6', { roughness: 0.88 }),
  ceiling: std('#f5f3ee', { roughness: 0.9 }),
  sidewalk: std('#bcb7ae', { roughness: 0.88 }),
  road: std('#e4e4e4', { roughness: 0.92 }),
  glass: new THREE.MeshStandardMaterial({ color: '#d9eef2', transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0, envMapIntensity: 1.6, depthWrite: false }),
  counterTop: std('#f2f0ea', { roughness: 0.3 }),
  counterBody: std('#0e655b', { roughness: 0.55 }),
  wood: std('#b5895c', { roughness: 0.5 }),
  woodDark: std('#6e4e36', { roughness: 0.55 }),
  metalDark: std('#454c51', { metalness: 0.6, roughness: 0.45 }),
  white: std('#f4f3ef', { roughness: 0.45 }),
  black: std('#25292b', { roughness: 0.45 }),
  lightPanel: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fffaf0', emissiveIntensity: 1.6 }),
  lightWarm: new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd08a', emissiveIntensity: 1.4 }),
  door: std('#ddd6c6', { roughness: 0.6 }),
  doorLocked: std('#8a6b5c', { roughness: 0.6 }),
  fabric: std('#2f6f8f', { roughness: 0.9 }),
  cardboard: std('#b98e5c', { roughness: 0.9 }),
  paper: std('#fbfaf5', { roughness: 0.9 }),
  barrier: std('#e9a93b', { roughness: 0.6 }),
  // --- Arsitektur (V3)
  skirting: std('#56524c', { roughness: 0.5 }),
  facade: std('#ece6da', { roughness: 0.9 }),
  facadeAccent: std('#0e7c6b', { roughness: 0.32, metalness: 0.25 }),
  stone: std('#7a746c', { roughness: 0.4 }),
  terrace: std('#d9d1c4', { roughness: 0.35 }),
  aluminum: std('#b4b8ba', { metalness: 0.85, roughness: 0.32 }),
  glassDark: std('#26343a', { roughness: 0.08, metalness: 0.3, envMapIntensity: 1.4 }),
  curtain: std('#d8cdbd', { roughness: 0.95 }),
  emissiveWarm: new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#ffe2b0', emissiveIntensity: 1.6 }),
  signGreen: new THREE.MeshStandardMaterial({ color: '#1f9d63', emissive: '#22c27a', emissiveIntensity: 1.4, roughness: 0.4 }),
  // --- Perabot (V4)
  steel: std('#d4d7d9', { metalness: 1, roughness: 0.32 }),
  cabinet: std('#bfc3bf', { metalness: 0.45, roughness: 0.45 }),
  pegboard: std('#f1efe9', { roughness: 0.6 }),
  shelfWhite: std('#eeece6', { roughness: 0.35, metalness: 0.2 }),
  seat: std('#2c5f69', { roughness: 0.45, metalness: 0.35 }),
  chrome: std('#dfe3e6', { metalness: 1, roughness: 0.18 }),
  cork: std('#b48a5c', { roughness: 0.95 }),
  rackBlue: std('#1f4e8c', { roughness: 0.45, metalness: 0.3 }),
  rackOrange: std('#e2731f', { roughness: 0.45, metalness: 0.3 }),
  porcelain: std('#f6f4ef', { roughness: 0.25 }),
  rubber: std('#2b2d2f', { roughness: 0.9 }),
  tape: std('#c9a46a', { roughness: 0.6 }),
  plantLeaf: std('#3f7d3a', { roughness: 0.6 }),
  plantLeafLight: std('#9bbf4a', { roughness: 0.6 }),
  soil: std('#3d2d22', { roughness: 1 }),
  ledStrip: new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffd79a', emissiveIntensity: 2 }),
  screenOn: new THREE.MeshStandardMaterial({ color: '#0d2530', emissive: '#2bb3c9', emissiveIntensity: 0.9, roughness: 0.15 }),
  // --- Eksterior (V6)
  shutter: std('#9aa1a6', { metalness: 0.4, roughness: 0.5 }),
  concrete: std('#a9a59c', { roughness: 0.9 }),
  curbWhite: std('#e9e7e1', { roughness: 0.8 }),
  curbBlack: std('#2a2b2d', { roughness: 0.8 }),
  roadPaint: std('#f2f1ea', { roughness: 0.7 }),
  ground: std('#8e8a82', { roughness: 0.95 }),
  awningRed: std('#b8433a', { roughness: 0.85 }),
  awningBlue: std('#2f5d8a', { roughness: 0.85 }),
  awningGreen: std('#3b7d4f', { roughness: 0.85 }),
  facadeA: std('#e6d6b8', { roughness: 0.9 }),
  facadeB: std('#cfdcd6', { roughness: 0.9 }),
  facadeC: std('#e3c7b6', { roughness: 0.9 }),
  facadeD: std('#d9d4e4', { roughness: 0.9 }),
  shopDark: std('#1c1f22', { roughness: 0.9 }),
  windowLit: new THREE.MeshStandardMaterial({ color: '#2b3236', emissive: '#ffd59a', emissiveIntensity: 0.05, roughness: 0.2, metalness: 0.2 }),
  lampGlow: new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe1a8', emissiveIntensity: 0.1 }),
  tire: std('#1b1c1e', { roughness: 0.85 }),
  bikeRed: std('#b3262a', { roughness: 0.35, metalness: 0.2 }),
  bikeBlack: std('#222428', { roughness: 0.35, metalness: 0.2 }),
  bikeWhite: std('#e9eaea', { roughness: 0.35, metalness: 0.2 }),
  bikeBlue: std('#2a5aa8', { roughness: 0.35, metalness: 0.2 }),
  trunk: std('#5b4636', { roughness: 0.95 }),
  treeLeaf: std('#3f7d3a', { roughness: 0.7 }),
  treeLeafLight: std('#7fae45', { roughness: 0.7 }),
};

export type MatKey = keyof typeof MAT;

/**
 * Material bertekstur prosedural. Geometri yang memakainya WAJIB ber-UV meter
 * (`meterBox`, `roundedBox`, `floorQuad`, atau `GeoBuilder` dengan `worldUV`).
 */
type TexSpec = {
  tex: TextureName;
  normalScale?: number;
  /** Tampil "menyala sendiri" (emisif) — untuk plafon agar tidak ada titik silau lampu. */
  selfLit?: number;
};

const TEXTURED: Partial<Record<MatKey, TexSpec>> = {
  floorFront: { tex: 'tile' },
  floorBack: { tex: 'vinyl' },
  floorLab: { tex: 'epoxy' },
  floorExpansion: { tex: 'vinyl' },
  wall: { tex: 'paint' },
  wallBack: { tex: 'paint' },
  ceiling: { tex: 'ceiling', selfLit: 0.78 },
  sidewalk: { tex: 'paving' },
  road: { tex: 'asphalt' },
  facade: { tex: 'plaster' },
  facadeA: { tex: 'plaster' },
  facadeB: { tex: 'plaster' },
  facadeC: { tex: 'plaster' },
  facadeD: { tex: 'plaster' },
  concrete: { tex: 'plaster' },
  ground: { tex: 'plaster' },
  shutter: { tex: 'shutter' },
  wood: { tex: 'wood' },
  woodDark: { tex: 'wood' },
  steel: { tex: 'brushed' },
  pegboard: { tex: 'pegboard' },
  seat: { tex: 'pegboard', normalScale: 0.6 },
  stone: { tex: 'tile' },
  terrace: { tex: 'tile' },
};

const baseRoughness = new Map<MatKey, number>();
const baseColor = new Map<MatKey, THREE.Color>();
let configuredFor = '';

/** Memasang tekstur prosedural sesuai profil kualitas (dipanggil sekali per perubahan kualitas). */
export function configureMaterials(profile: VisualProfile) {
  const key = `${profile.texSize}:${profile.detailMaps}:${profile.anisotropy}`;
  if (key === configuredFor) return;
  configuredFor = key;
  const keep = new Set<THREE.Texture>();
  for (const [name, spec] of Object.entries(TEXTURED) as [MatKey, TexSpec][]) {
    const m = MAT[name] as THREE.MeshStandardMaterial;
    if (!baseRoughness.has(name)) baseRoughness.set(name, m.roughness);
    if (!baseColor.has(name)) baseColor.set(name, m.color.clone());
    const set = getTextureSet(spec.tex, profile.texSize, profile.detailMaps, profile.anisotropy);
    m.map = set.map;
    m.roughnessMap = set.roughnessMap ?? null;
    m.normalMap = set.normalMap ?? null;
    // Dengan roughnessMap, nilai peta dipakai langsung (dikalikan 1).
    m.roughness = set.roughnessMap ? 1 : (baseRoughness.get(name) ?? 0.8);
    if (spec.selfLit) {
      // Albedo gelap + emisif bertekstur: warna tetap, tidak terpengaruh lampu titik di dekatnya.
      m.color.set('#000000');
      m.emissive.copy(baseColor.get(name)!).multiplyScalar(spec.selfLit);
      m.emissiveMap = set.map;
    }
    const ns = spec.normalScale ?? 1;
    m.normalScale.set(ns, ns);
    m.needsUpdate = true;
    [set.map, set.roughnessMap, set.normalMap].forEach((t) => t && keep.add(t));
  }
  disposeTexturesExcept(keep);
}
