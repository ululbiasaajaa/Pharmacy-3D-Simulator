import * as THREE from 'three';

/**
 * Model cahaya siang–malam sederhana yang mengikuti jam permainan (ART_DIRECTION.md §7).
 * Murni (tanpa React) agar dapat diuji; komponen scene membaca `daylight.current`.
 */
export interface Daylight {
  /** Vektor satuan dari tanah menuju matahari. */
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  /** 0 = siang penuh, 1 = malam penuh (untuk lampu jalan & papan nama). */
  night: number;
}

interface Key {
  m: number;
  skyTop: string;
  skyHorizon: string;
  sun: string;
  sunI: number;
  hemi: string;
  hemiI: number;
  night: number;
}

// Kunci warna sepanjang hari (menit sejak 00:00).
const KEYS: Key[] = [
  { m: 0, skyTop: '#0b1222', skyHorizon: '#1c2a44', sun: '#ffffff', sunI: 0, hemi: '#3a4c70', hemiI: 0.35, night: 1 },
  { m: 330, skyTop: '#0e1830', skyHorizon: '#2a3552', sun: '#ff9c5a', sunI: 0, hemi: '#3a4c70', hemiI: 0.35, night: 1 },
  { m: 375, skyTop: '#3a5584', skyHorizon: '#eaa278', sun: '#ff9f5e', sunI: 0.5, hemi: '#9fb2cc', hemiI: 0.5, night: 0.5 },
  { m: 450, skyTop: '#6ea3d8', skyHorizon: '#f1d9bb', sun: '#ffd4a6', sunI: 1.7, hemi: '#cfe0f0', hemiI: 0.6, night: 0 },
  { m: 600, skyTop: '#5c99da', skyHorizon: '#d3e6f3', sun: '#fff4e4', sunI: 2.3, hemi: '#dcebf7', hemiI: 0.65, night: 0 },
  { m: 900, skyTop: '#5f98d4', skyHorizon: '#d9e6ee', sun: '#fff0da', sunI: 2.2, hemi: '#dde8f0', hemiI: 0.62, night: 0 },
  { m: 1020, skyTop: '#6990c2', skyHorizon: '#f4c38f', sun: '#ffbe7a', sunI: 1.6, hemi: '#e6d8c6', hemiI: 0.55, night: 0 },
  { m: 1080, skyTop: '#44608f', skyHorizon: '#ee8f5c', sun: '#ff8b4d', sunI: 0.55, hemi: '#b49aa0', hemiI: 0.45, night: 0.35 },
  { m: 1140, skyTop: '#1d2b4d', skyHorizon: '#5f4a6a', sun: '#ff8b4d', sunI: 0, hemi: '#4b5878', hemiI: 0.38, night: 0.8 },
  { m: 1200, skyTop: '#0d1528', skyHorizon: '#22304d', sun: '#ffffff', sunI: 0, hemi: '#3a4c70', hemiI: 0.35, night: 1 },
  { m: 1440, skyTop: '#0b1222', skyHorizon: '#1c2a44', sun: '#ffffff', sunI: 0, hemi: '#3a4c70', hemiI: 0.35, night: 1 },
];

const SUNRISE = 360;
const SUNSET = 1080;
/** Matahari sedikit condong ke sisi etalase (+Z) agar sinarnya masuk ke apotek. */
const MAX_ELEVATION = THREE.MathUtils.degToRad(68);

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function mix(out: THREE.Color, a: string, b: string, t: number) {
  return out.copy(tmpA.set(a)).lerp(tmpB.set(b), t);
}

export function sunDirectionAt(minute: number, out = new THREE.Vector3()): THREE.Vector3 {
  const h = Math.PI * THREE.MathUtils.clamp((minute - SUNRISE) / (SUNSET - SUNRISE), 0, 1);
  // Timur (-X) → barat (+X), condong ke depan (+Z).
  out.set(-Math.cos(h), Math.max(0.05, Math.sin(h) * Math.sin(MAX_ELEVATION)), 0.45 + Math.sin(h) * Math.cos(MAX_ELEVATION) * 0.5);
  return out.normalize();
}

export function daylightAt(minute: number, out?: Daylight): Daylight {
  const m = ((minute % 1440) + 1440) % 1440;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].m <= m) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const raw = (m - a.m) / Math.max(1, b.m - a.m);
  const t = raw * raw * (3 - 2 * raw);
  const d: Daylight = out ?? {
    sunDir: new THREE.Vector3(),
    sunColor: new THREE.Color(),
    sunIntensity: 0,
    skyTop: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 0,
    night: 0,
  };
  sunDirectionAt(m, d.sunDir);
  mix(d.sunColor, a.sun, b.sun, t);
  d.sunIntensity = THREE.MathUtils.lerp(a.sunI, b.sunI, t);
  mix(d.skyTop, a.skyTop, b.skyTop, t);
  mix(d.skyHorizon, a.skyHorizon, b.skyHorizon, t);
  mix(d.hemiSky, a.hemi, b.hemi, t);
  d.hemiGround.set('#8c8578').lerp(tmpA.set('#2a2c33'), THREE.MathUtils.lerp(a.night, b.night, t));
  d.hemiIntensity = THREE.MathUtils.lerp(a.hemiI, b.hemiI, t);
  d.night = THREE.MathUtils.lerp(a.night, b.night, t);
  return d;
}

/** Nilai terkini yang dibagikan ke komponen scene (diperbarui oleh `DaylightDriver`). */
export const daylight = { current: daylightAt(600), minute: 600 };
