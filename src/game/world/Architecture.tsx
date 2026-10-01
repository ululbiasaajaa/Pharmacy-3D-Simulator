import { useMemo } from 'react';
import { GeoBuilder, floorQuad } from '@/game/visual/geometry';
import { BuiltMeshes } from '@/game/visual/Built';
import { useVisualProfile } from '@/game/visual/quality';
import { LightHalo } from '@/game/visual/LightHalo';
import { CanvasLabel } from './CanvasLabel';
import { EXPANSION_ROOMS, WALL_H, WALLS } from './layout';
import type { MatKey } from './materials';
import type { RoomId } from '@/domain/types';

/** Posisi panel lampu plafon (juga dipakai untuk genangan cahaya terpanggang di lantai). */
export const CEILING_LIGHTS: [number, number][] = [
  [-6, 6],
  [0, 6],
  [6, 6],
  [-3, 0],
  [3, 0],
  [-8, -6],
  [0, -6],
  [8, -6],
];

const isFront = (w: { minZ: number; maxZ: number }) => Math.abs((w.minZ + w.maxZ) / 2 - 10) < 0.01;

/** Plint dinding, fixture panel LED, dan dinding merek — digabung per material. */
function buildInterior(lights: [number, number][], warm: boolean) {
  const b = new GeoBuilder<MatKey>();
  // Plint 10 cm di kedua sisi setiap dinding (menonjol 1,5 cm).
  for (const w of WALLS) {
    if (isFront(w)) continue;
    const width = w.maxX - w.minX;
    const depth = w.maxZ - w.minZ;
    const alongX = width >= depth;
    b.box('skirting', alongX ? width : width + 0.03, 0.1, alongX ? depth + 0.03 : depth, (w.minX + w.maxX) / 2, 0.05, (w.minZ + w.maxZ) / 2, { r: 0.004 });
  }
  // Panel LED 60×120 dengan bingkai aluminium tipis.
  for (const [x, z] of lights) {
    b.box('aluminum', 1.26, 0.03, 0.66, x, WALL_H - 0.012, z, { r: 0.006 });
    b.box(warm ? 'lightWarm' : 'lightPanel', 1.18, 0.012, 0.58, x, WALL_H - 0.03, z, { r: 0 });
  }
  // Dinding merek: pita teal di atas rak resep (terlihat dari area pelanggan).
  b.box('facadeAccent', 13.2, 0.62, 0.04, 0, 2.86, -1.88, { r: 0.008 });
  b.box('aluminum', 13.2, 0.03, 0.05, 0, 2.54, -1.87, { r: 0 });
  return b.build();
}

export function InteriorDetails({ unlocked, warm }: { unlocked: RoomId[]; warm: boolean }) {
  const profile = useVisualProfile();
  const lights = useMemo(() => {
    const extra = Object.entries(EXPANSION_ROOMS)
      .filter(([room]) => unlocked.includes(room as RoomId))
      .map(([, p]) => [p.x, p.z] as [number, number]);
    return [...CEILING_LIGHTS, ...extra];
  }, [unlocked]);
  const parts = useMemo(() => buildInterior(lights, warm), [lights, warm]);
  return (
    <group>
      <BuiltMeshes parts={parts} />
      {profile.halos && lights.map(([x, z]) => <LightHalo key={`${x},${z}`} position={[x, WALL_H - 0.04, z]} size={2.2} warm={warm} facing="down" />)}
    </group>
  );
}

// ------------------------------------------------------------------ Fasad ruko

const FRONT_Z = 10.1; // muka luar dinding depan
const DOOR_HALF = 1.2;
/** Pilaster (kolom) fasad: sudut dan pengapit pintu. */
const PILASTERS = [-12, -6.4, -DOOR_HALF - 0.18, DOOR_HALF + 0.18, 6.4, 12];

function buildFacade() {
  const b = new GeoBuilder<MatKey>();
  const z = FRONT_Z;
  // Pilaster lantai dasar + lantai atas.
  for (const x of PILASTERS) {
    const w = Math.abs(x) === 12 ? 0.42 : 0.34;
    const cx = Math.abs(x) === 12 ? x - Math.sign(x) * 0.09 : x;
    b.box('facade', w, 7.05, 0.2, cx, 3.525, z + 0.1, { r: 0.01 });
  }
  // Bentang etalase di antara pilaster (tanpa pintu masuk).
  const bays: [number, number][] = [
    [-11.79, -6.57],
    [-6.23, -DOOR_HALF - 0.35],
    [DOOR_HALF + 0.35, 6.23],
    [6.57, 11.79],
  ];
  for (const [x0, x1] of bays) {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    // Kaki etalase berlapis batu.
    b.box('stone', w, 0.5, 0.06, cx, 0.25, z + 0.03, { r: 0.004 });
    // Kusen aluminium: ambang bawah, atas, palang transom, dan mullion.
    b.box('aluminum', w, 0.06, 0.12, cx, 0.53, z, { r: 0.004 });
    b.box('aluminum', w, 0.06, 0.12, cx, 2.75, z, { r: 0.004 });
    b.box('aluminum', w, 0.045, 0.1, cx, 2.22, z, { r: 0.004 });
    const n = Math.max(1, Math.round(w / 1.6));
    for (let i = 0; i <= n; i++) b.box('aluminum', 0.05, 2.22, 0.1, x0 + (w * i) / n, 1.64, z, { r: 0.004 });
    // Sisi interior: dinding rendah di bawah kaca + plint.
    b.box('wall', w, 0.53, 0.18, cx, 0.265, z - 0.11, { r: 0 });
    b.box('skirting', w, 0.1, 0.03, cx, 0.05, z - 0.21, { r: 0.004 });
    // Kotak rolling door + rel pemandu.
    b.box('metalDark', w, 0.36, 0.34, cx, 2.97, z + 0.17, { r: 0.012 });
    for (const x of [x0 + 0.04, x1 - 0.04]) b.box('metalDark', 0.06, 2.8, 0.07, x, 1.4, z + 0.04, { r: 0.004 });
  }
  // Rangka pintu masuk otomatis: kusen, transom kaca, kotak sensor.
  b.box('aluminum', 0.08, 2.75, 0.14, -DOOR_HALF - 0.04, 1.375, z, { r: 0.004 });
  b.box('aluminum', 0.08, 2.75, 0.14, DOOR_HALF + 0.04, 1.375, z, { r: 0.004 });
  b.box('aluminum', DOOR_HALF * 2 + 0.16, 0.08, 0.16, 0, 2.24, z, { r: 0.004 });
  b.box('aluminum', DOOR_HALF * 2 + 0.16, 0.06, 0.14, 0, 2.75, z, { r: 0.004 });
  b.box('glass', DOOR_HALF * 2, 0.46, 0.02, 0, 2.5, z, { r: 0 });
  b.box('metalDark', 0.5, 0.08, 0.1, 0, 2.15, z + 0.1, { r: 0.01 });
  b.box('metalDark', DOOR_HALF * 2 + 0.3, 0.36, 0.34, 0, 2.97, z + 0.17, { r: 0.012 });
  // Sisi interior: dinding di atas kusen etalase hingga plafon (seluruh lebar fasad).
  b.box('wall', 24, WALL_H - 2.78, 0.2, 0, (WALL_H + 2.78) / 2, z - 0.1, { r: 0 });
  // Kanopi beton + lis teal (fascia) + lampu downlight.
  b.box('facade', 24.6, 0.14, 1.3, 0, 3.25, z + 0.65, { r: 0.01 });
  b.box('facadeAccent', 24.7, 0.42, 0.06, 0, 3.2, z + 1.32, { r: 0.008 });
  for (let x = -10.5; x <= 10.5; x += 3) b.cylinder('emissiveWarm', 0.07, 0.07, 0.01, x, 3.175, z + 0.7, { seg: 16 });
  // Lantai atas: dinding, pita lantai, ambang atap.
  b.box('facade', 24.2, 3.8, 0.12, 0, 5.2, z - 0.02, { r: 0 });
  b.box('facade', 24.5, 0.12, 0.3, 0, 3.62, z + 0.08, { r: 0.008 });
  b.box('facade', 24.6, 0.3, 0.36, 0, 7.1, z + 0.08, { r: 0.01 });
  // Massa bangunan lantai atas (di atas plafon; bidang bawahnya tertutup plafon dari dalam).
  b.box('facade', 24.2, 3.8, 28.1, 0, 5.2, -4.05, { r: 0 });
  // Kulit plester sisi luar dinding samping lantai dasar.
  for (const x of [-12.11, 12.11]) b.box('facade', 0.02, 3.25, 28.1, x, 1.625, -4.05, { r: 0 });
  // Jendela lantai atas: kusen, kaca gelap, tirai, ambang.
  for (const x of [-9.4, -6.6, 6.6, 9.4]) {
    b.box('aluminum', 1.9, 1.5, 0.08, x, 5.55, z + 0.03, { r: 0.006 });
    b.box('glassDark', 1.78, 1.38, 0.02, x, 5.55, z + 0.07, { r: 0 });
    b.box('curtain', 0.5, 1.3, 0.02, x - 0.6, 5.55, z + 0.05, { r: 0 });
    b.box('aluminum', 0.035, 1.38, 0.04, x, 5.55, z + 0.08, { r: 0 });
    b.box('facade', 2.05, 0.07, 0.16, x, 4.76, z + 0.1, { r: 0.008 });
  }
  // Unit AC luar di samping jendela.
  b.box('white', 0.8, 0.55, 0.3, 8, 4.35, z + 0.2, { r: 0.02 });
  b.cylinder('metalDark', 0.2, 0.2, 0.02, 7.9, 4.35, z + 0.36, { rotX: Math.PI / 2, seg: 20 });
  // Papan nama (kotak sign) di tengah fasad atas.
  b.box('facadeAccent', 9.6, 1.25, 0.24, 0, 4.42, z + 0.16, { r: 0.03 });
  b.box('aluminum', 9.7, 0.05, 0.26, 0, 3.78, z + 0.16, { r: 0 });
  // Tanda plus menyala yang menonjol tegak lurus fasad.
  b.box('metalDark', 0.06, 0.06, 0.55, 11.55, 4.4, z + 0.3, { r: 0 });
  b.box('signGreen', 0.16, 0.9, 0.16, 11.55, 4.4, z + 0.75, { r: 0.015 });
  b.box('signGreen', 0.16, 0.3, 0.9, 11.55, 4.4, z + 0.75, { r: 0.015 });
  // Teras keramik di bawah kanopi + bibir tangga.
  b.add('terrace', floorQuad(-12.2, 12.2, z, z + 1.25, 0.015));
  b.box('stone', 24.4, 0.03, 0.06, 0, 0.0, z + 1.25, { r: 0.004 });
  return b.build();
}

export function Facade({ pharmacyName, night }: { pharmacyName: string; night: boolean }) {
  const parts = useMemo(buildFacade, []);
  return (
    <group>
      <BuiltMeshes parts={parts} castShadow />
      {/* Kaca etalase (transparan, dirender terpisah agar urutan transparansi benar). */}
      {[
        [-11.79, -6.57],
        [-6.23, -DOOR_HALF - 0.35],
        [DOOR_HALF + 0.35, 6.23],
        [6.57, 11.79],
      ].map(([x0, x1]) => (
        <mesh key={x0} position={[(x0 + x1) / 2, 1.64, FRONT_Z - 0.01]} renderOrder={3}>
          <boxGeometry args={[x1 - x0, 2.2, 0.02]} />
          <meshStandardMaterial color="#d9eef2" transparent opacity={0.18} roughness={0.04} envMapIntensity={1.6} depthWrite={false} />
        </mesh>
      ))}
      <CanvasLabel text={`APOTEK ${pharmacyName.toUpperCase()}`} width={8.6} height={0.9} position={[0, 4.42, FRONT_Z + 0.29]} background={null} color={night ? '#ffffff' : '#f6fffb'} fontSize={150} />
      <CanvasLabel text="Melayani dengan sepenuh hati" width={4} height={0.26} position={[0, 3.98, FRONT_Z + 0.29]} background={null} color="#c9f5ea" fontSize={64} bold={false} />
      <CanvasLabel text="BUKA 08.00 – 20.00" width={1.3} height={0.2} position={[2.6, 1.95, FRONT_Z + 0.02]} background="#0e655b" fontSize={56} />
    </group>
  );
}
