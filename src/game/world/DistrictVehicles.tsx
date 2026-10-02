import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GeoBuilder } from '@/game/visual/geometry';
import { BuiltMeshes, type BuiltPart } from '@/game/visual/Built';
import { useVisualProfile } from '@/game/visual/quality';
import { useGame } from '@/stores/gameStore';
import type { GameState } from '@/domain/types';
import { Character, type CharacterAnim } from '@/game/npc/Character';
import { patientStyle } from '@/game/npc/characterModel';
import { crowd, streetState, vehicles } from '@/game/npc/crowd';
import { CanvasLabel } from './CanvasLabel';
import { MAT, type MatKey } from './materials';
import { scooterModel } from './streetModels';
import { VEHICLES, angkotSignTexture, plateTexture, vehicleBody, type VehicleKind, type VehicleSpec } from './vehicleModels';
import { WHEEL_BASE_R, contactShadowTexture, wheelGeometries, type WheelGeometries } from './wheelModels';
import { useWorld } from './worldStore';
import { LOADING, STAFF_PARKING } from './district';
import { TRAFFIC_HALF, TrafficSim, VAN_HALF, VanSim, laneZ, type Mover, type Person, type TrafficKind } from './traffic';
import { outsideVisible } from '@/game/visual/InteriorCull';

const STAFF_COLORS: MatKey[] = ['bikeBlack', 'bikeRed', 'bikeWhite', 'bikeBlue', 'bikeBlack'];

// ------------------------------------------------------------------ Roda, bayangan kontak, tekstur bersama

const WHEEL_PARTS: (keyof WheelGeometries)[] = ['tire', 'rim', 'dark'];
const WHEEL_MAT: Record<keyof WheelGeometries, MatKey> = { tire: 'tireRubber', rim: 'rimAlloy', dark: 'metalDark' };

let wheelGeo: WheelGeometries | null = null;
/** Geometri roda dibuat sekali & dipakai bersama semua kendaraan (diskalakan per jenis). */
function sharedWheel() {
  // Detail 0,55: 22 segmen putar, tanpa alur tapak (tak terlihat dari trotoar) — ±870 segitiga per roda;
  // 4 roda × kendaraan digambar instanced.
  if (!wheelGeo) wheelGeo = wheelGeometries(undefined, undefined, 0.66, 5, 0.55);
  return wheelGeo;
}

let shadowMat: THREE.MeshBasicMaterial | null = null;
/** Bayangan kontak lembut di bawah kendaraan — di semua profil, juga tanpa bayangan matahari. */
function contactShadowMaterial() {
  if (!shadowMat) {
    shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.6, depthWrite: false, alphaMap: contactShadowTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  return shadowMat;
}
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Peta kanvas pelat nomor & papan trayek dipasang sekali ke material bersama. */
function useVehicleTextures() {
  useMemo(() => {
    const set = (m: THREE.MeshStandardMaterial, t: THREE.Texture | null) => {
      if (m.map || !t) return;
      m.map = t;
      m.needsUpdate = true;
    };
    set(MAT.carPlate, plateTexture('white'));
    set(MAT.plateYellow, plateTexture('yellow'));
    set(MAT.angkotSign, angkotSignTexture());
  }, []);
}

const bodyCache = new Map<string, BuiltPart[]>();
/** Bodi kendaraan per jenis & material cat (dibuat sekali). */
function bodyParts(kind: VehicleKind, paint: MatKey) {
  const key = `${kind}:${paint}`;
  let parts = bodyCache.get(key);
  if (!parts) {
    const b = new GeoBuilder<MatKey>();
    vehicleBody(b, kind, paint);
    parts = b.build();
    bodyCache.set(key, parts);
  }
  return parts;
}

const tmpW = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const spinQ = new THREE.Quaternion();
const steerQ = new THREE.Quaternion();
const mirrorQ = new THREE.Quaternion().setFromAxisAngle(AXIS_Y, Math.PI);

/** Rotasi roda: belok (Y) · putar (X) · cermin (roda kanan menghadap −X). */
function wheelQuat(out: THREE.Quaternion, spec: VehicleSpec, i: number, spin: number, steer: number) {
  out.identity();
  if (steer && spec.steer.includes(i)) out.multiply(steerQ.setFromAxisAngle(AXIS_Y, steer));
  out.multiply(spinQ.setFromAxisAngle(AXIS_X, spin));
  if (spec.wheels[i][0] < 0) out.multiply(mirrorQ);
  return out;
}

/** Matriks roda dunia = matriks kendaraan · (posisi roda, rotasi, skala jari-jari). */
function wheelMatrix(out: THREE.Matrix4, vehicle: THREE.Matrix4, spec: VehicleSpec, i: number, spin: number, steer: number) {
  const [wx, wz] = spec.wheels[i];
  const s = spec.wheelR / WHEEL_BASE_R;
  tmpW.compose(tmpP.set(wx, spec.wheelR, wz), wheelQuat(tmpQ, spec, i, spin, steer), tmpS.set(s, s, s));
  return out.multiplyMatrices(vehicle, tmpW);
}

/** Kendaraan statis lengkap (bodi + roda + bayangan) — untuk van & showroom pengembangan. */
function VehicleVisual({ kind, paint, spin, steer, children }: { kind: VehicleKind; paint: MatKey; spin?: () => number; steer?: () => number; children?: React.ReactNode }) {
  const spec = VEHICLES[kind];
  const parts = useMemo(() => bodyParts(kind, paint), [kind, paint]);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const wg = sharedWheel();
  useFrame(() => {
    const sp = spin?.() ?? 0;
    const st = steer?.() ?? 0;
    wheels.current.forEach((g, i) => g && wheelQuat(g.quaternion, spec, i, sp, st));
  });
  const s = spec.wheelR / WHEEL_BASE_R;
  return (
    <>
      <BuiltMeshes parts={parts} castShadow />
      {spec.wheels.map(([wx, wz], i) => (
        <group
          key={i}
          ref={(el) => {
            wheels.current[i] = el;
          }}
          position={[wx, spec.wheelR, wz]}
          scale={s}
        >
          {WHEEL_PARTS.map((k) => (
            <mesh key={k} geometry={wg[k]} material={MAT[WHEEL_MAT[k]]} castShadow />
          ))}
        </group>
      ))}
      <mesh geometry={shadowGeo} material={contactShadowMaterial()} position={[0, 0.012, 0]} scale={[spec.width + 0.45, 1, spec.length + 0.5]} renderOrder={1} />
      {children}
    </>
  );
}

/**
 * Motor karyawan di parkir gang kanan: satu motor per pegawai yang sedang dalam shift (status ≠ 'off').
 * Jumlahnya sama dengan collider `staffScooters` di PlayerController (tidak ada penghalang tak terlihat).
 */
export function StaffScooters() {
  const count = useGame((s) => Math.min(STAFF_PARKING.length, s.game?.employees.filter((e) => e.status !== 'off').length ?? 0));
  const parts = useMemo(() => {
    if (!count) return null;
    const b = new GeoBuilder<MatKey>();
    // Moncong menghadap tembok ruko (+X), tegak lurus tembok.
    for (let i = 0; i < count; i++) scooterModel(b, STAFF_PARKING[i][0], STAFF_PARKING[i][1], Math.PI / 2 + (i % 2 ? 0.05 : -0.04), STAFF_COLORS[i]);
    return b.build();
  }, [count]);
  if (!parts) return null;
  return (
    <group>
      <BuiltMeshes parts={parts} castShadow />
      {STAFF_PARKING.slice(0, count).map(([x, z]) => (
        <mesh key={`${x},${z}`} geometry={shadowGeo} material={contactShadowMaterial()} position={[x, 0.012, z]} scale={[2.1, 1, 0.55]} renderOrder={1} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ Masukan bersama

/** Orang di luar (pasien, pejalan kaki) + pemain — dibaca kendaraan agar berhenti. */
function peopleNow(): Person[] {
  const list: Person[] = [...crowd.values()];
  const p = useWorld.getState().player;
  list.push({ x: p.x, z: p.z });
  return list;
}

function moversExcept(prefix: string): Mover[] {
  const out: Mover[] = [];
  for (const [id, v] of vehicles) if (!id.startsWith(prefix)) out.push({ id, x: v.x, z: v.z, dir: v.dir, half: v.half });
  return out;
}

// ------------------------------------------------------------------ Mobil boks PBF

/** Kiriman sudah tiba, atau sedang dikirim & tiba ≤ 8 menit permainan lagi (van datang tepat waktu). */
function deliveryWanted(g: GameState | null | undefined) {
  if (!g) return false;
  return g.purchaseOrders.some((o) => o.status === 'arrived' || (o.status === 'shipping' && o.eta !== undefined && o.eta - g.time.now <= 8));
}

/** Kurir berdiri di belakang bak saat van parkir; menoleh & "berbicara" saat pemain mendekat. */
function Courier() {
  const group = useRef<THREE.Group>(null);
  const anim = useRef<CharacterAnim>({ moving: false, phase: 0, mode: 'idle' });
  const style = useMemo(() => {
    const s = patientStyle({ id: 'KURIR-PBF', gender: 'L', age: 32, appearance: 1 });
    return { ...s, avatar: 'Male_Adult_11', key: `${s.key}:kurir` };
  }, []);
  const home = useMemo(() => new THREE.Vector2(LOADING.vanPark.x + 0.35, LOADING.vanPark.z + 3.75), []);
  const root = useRef<THREE.Group>(null);
  useFrame(({ camera }, rawDt) => {
    const g = group.current;
    if (!g || !root.current) return;
    root.current.visible = outsideVisible(camera.position.x, camera.position.z, home.x, home.y);
    const dt = Math.min(rawDt, 0.1);
    const p = useWorld.getState().player;
    const dx = p.x - home.x;
    const dz = p.z - home.y;
    const near = Math.hypot(dx, dz) < 3.5;
    // Bawaan: menghadap pintu gudang (+X); saat pemain dekat: menghadap pemain & berbicara.
    const face = near ? Math.atan2(dx, dz) : Math.PI / 2;
    g.rotation.y += Math.atan2(Math.sin(face - g.rotation.y), Math.cos(face - g.rotation.y)) * Math.min(1, dt * 5);
    anim.current.mode = near ? 'talk' : 'idle';
  });
  const trolley = useMemo(() => {
    const b = new GeoBuilder<MatKey>();
    // Troli barang (hand truck) dengan tiga kardus kiriman.
    b.box('metalDark', 0.05, 1.15, 0.05, -0.22, 0.6, -0.18, { r: 0.01, rotX: -0.12 });
    b.box('metalDark', 0.05, 1.15, 0.05, 0.22, 0.6, -0.18, { r: 0.01, rotX: -0.12 });
    b.box('metalDark', 0.5, 0.03, 0.32, 0, 0.04, 0, { r: 0.006 });
    for (const s of [-1, 1]) b.cylinder('tire', 0.09, 0.09, 0.05, s * 0.26, 0.09, -0.22, { rotZ: Math.PI / 2, seg: 14 });
    b.box('cardboard', 0.46, 0.3, 0.3, 0, 0.21, 0.02, { r: 0.006 });
    b.box('cardboard', 0.42, 0.28, 0.28, 0, 0.5, 0.0, { r: 0.006, rotY: 0.06 });
    b.box('cardboard', 0.36, 0.22, 0.26, 0, 0.75, 0.01, { r: 0.006, rotY: -0.08 });
    b.box('tape', 0.47, 0.004, 0.06, 0, 0.362, 0.02, { r: 0 });
    return b.build();
  }, []);
  return (
    <group ref={root}>
      <group ref={group} position={[home.x, 0, home.y]} rotation={[0, Math.PI / 2, 0]}>
        <Character style={style} anim={anim} />
      </group>
      <group position={[home.x - 0.75, 0, home.y - 0.35]} rotation={[0, 0.3, 0]}>
        <BuiltMeshes parts={trolley} castShadow />
      </group>
    </group>
  );
}

/**
 * Mobil boks distributor (PBF) yang mengantar kiriman ke area bongkar muat (VanSim di traffic.ts).
 * Roda berputar mengikuti jarak tempuh dan roda depan berbelok mengikuti lintasan.
 * Collider parkirnya aktif lewat worldStore.vanParked hanya saat van benar-benar berhenti di tempat parkir.
 */
export function DeliveryVan() {
  useVehicleTextures();
  const wanted = useGame((s) => deliveryWanted(s.game));
  const wantedRef = useRef(wanted);
  wantedRef.current = wanted;
  const sim = useMemo(() => new VanSim(), []);
  const group = useRef<THREE.Group>(null);
  const [courier, setCourier] = useState(false);
  useEffect(
    () => () => {
      vehicles.delete('van');
      useWorld.getState().setVanParked(false);
    },
    [],
  );
  useFrame(({ camera }, rawDt) => {
    sim.step(rawDt, wantedRef.current, peopleNow(), moversExcept('van'));
    if (sim.visible) vehicles.set('van', { x: sim.x, z: sim.z, dir: sim.laneDir, half: VAN_HALF, speed: sim.speed });
    else vehicles.delete('van');
    const world = useWorld.getState();
    if (world.vanParked !== sim.parked) world.setVanParked(sim.parked);
    // Kurir hanya saat bongkar muat; naik ke kabin begitu van bersiap pergi (sebelum mundur).
    const unloading = sim.phase === 'parked';
    if (unloading !== courier) setCourier(unloading);
    const g = group.current;
    if (g) {
      g.position.set(sim.x, 0, sim.z);
      g.rotation.y = sim.heading;
      // Di gang & terhalang dinding saat kamera di dalam apotek (kecuali lewat pintu bongkar muat terbuka).
      g.visible = sim.visible && outsideVisible(camera.position.x, camera.position.z, sim.x, sim.z);
    }
  });
  return (
    <group name="delivery-van">
      <group ref={group} visible={false}>
        <VehicleVisual kind="van" paint="vanPaint" spin={() => sim.odometer / VEHICLES.van.wheelR} steer={() => sim.steer}>
          {/* Nama fiktif & generik (bukan merek nyata) pada bak. */}
          <CanvasLabel text="DISTRIBUSI FARMASI · PBF" width={2.5} height={0.46} position={[0.932, 1.7, -0.92]} rotation={[0, Math.PI / 2, 0]} background="#ffffff" color="#0f766e" fontSize={80} />
          <CanvasLabel text="DISTRIBUSI FARMASI · PBF" width={2.5} height={0.46} position={[-0.932, 1.7, -0.92]} rotation={[0, -Math.PI / 2, 0]} background="#ffffff" color="#0f766e" fontSize={80} />
        </VehicleVisual>
      </group>
      {courier && <Courier />}
    </group>
  );
}

// ------------------------------------------------------------------ Lalu lintas

const KIND_MODEL: Record<TrafficKind, VehicleKind> = { car: 'mpv', hatch: 'hatch', angkot: 'angkot' };
const TRAFFIC_KINDS: TrafficKind[] = ['car', 'hatch', 'angkot'];

/** Warna cat umum di jalan Indonesia (putih, perak, hitam, abu tua; sesekali merah/biru) & warna angkot per trayek. */
const PALETTE: Record<TrafficKind, string[]> = {
  car: ['#e9e9e6', '#b9bec3', '#1d2023', '#5e646b', '#e9e9e6', '#7a1a1f'],
  hatch: ['#c9cdd1', '#e9e9e6', '#8a1c22', '#24456f', '#3a3f45', '#e9e9e6'],
  angkot: ['#2c6db5', '#2c8a57', '#d65f28', '#2c6db5', '#2c8a57', '#2c6db5'],
};

/** Jumlah & jenis kendaraan menurut profil kualitas (performa lebih penting daripada keramaian). */
function trafficKinds(quality: string): TrafficKind[] {
  if (quality === 'low') return ['car', 'angkot'];
  if (quality === 'medium') return ['car', 'hatch', 'angkot'];
  return ['car', 'hatch', 'car', 'angkot', 'angkot'];
}

/** Bodi lalu lintas satu jenis: InstancedMesh per material yang berbagi satu buffer matriks instance. */
interface KindBodies {
  meshes: THREE.InstancedMesh[];
  matrix: THREE.InstancedBufferAttribute;
  paint: THREE.InstancedMesh | null;
}

/**
 * Mobil & angkot yang lewat (TrafficSim). Bodi tiap jenis = InstancedMesh per material yang berbagi **satu**
 * buffer matriks (diunggah sekali per frame per jenis, bukan per material); warna cat lewat instanceColor.
 * Roda semua kendaraan = 3 InstancedMesh (ban, velg, bagian gelap) yang juga berbagi satu buffer matriks dan
 * berputar sesuai jarak tempuh; bayangan kontak = 1 InstancedMesh.
 *
 * Catatan: BatchedMesh (1 draw call per material untuk semua jenis) sudah dicoba dan diukur lebih lambat di
 * ANGLE/D3D11 (multi-draw diemulasi, tekstur matriks/warna/indirect diunggah ulang tiap frame).
 */
export function Traffic() {
  useVehicleTextures();
  const profile = useVisualProfile();
  const kinds = useMemo(() => trafficKinds(profile.quality), [profile.quality]);
  const sim = useMemo(() => new TrafficSim(kinds, 7), [kinds]);
  const meshes = useMemo(() => {
    const bodies: Partial<Record<TrafficKind, KindBodies>> = {};
    for (const kind of TRAFFIC_KINDS) {
      const max = kinds.filter((k) => k === kind).length;
      if (!max) continue;
      const matrix = new THREE.InstancedBufferAttribute(new Float32Array(max * 16), 16);
      matrix.setUsage(THREE.DynamicDrawUsage);
      const list: THREE.InstancedMesh[] = [];
      let paint: THREE.InstancedMesh | null = null;
      for (const part of bodyParts(KIND_MODEL[kind], 'carPaint')) {
        const m = new THREE.InstancedMesh(part.geometry, MAT[part.mat], max);
        m.instanceMatrix = matrix;
        m.count = 0;
        m.castShadow = profile.sunShadows;
        m.receiveShadow = true;
        if (part.mat === 'carPaint') {
          m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
          paint = m;
        }
        list.push(m);
      }
      bodies[kind] = { meshes: list, matrix, paint };
    }
    const wg = sharedWheel();
    const wheelMatrixAttr = new THREE.InstancedBufferAttribute(new Float32Array(kinds.length * 4 * 16), 16);
    wheelMatrixAttr.setUsage(THREE.DynamicDrawUsage);
    const wheels = WHEEL_PARTS.map((k) => {
      const m = new THREE.InstancedMesh(wg[k], MAT[WHEEL_MAT[k]], kinds.length * 4);
      m.instanceMatrix = wheelMatrixAttr;
      m.count = 0;
      m.castShadow = profile.sunShadows;
      return m;
    });
    const shadows = new THREE.InstancedMesh(shadowGeo, contactShadowMaterial(), kinds.length);
    shadows.count = 0;
    shadows.renderOrder = 1;
    return { bodies, wheels, shadows };
  }, [kinds, profile.sunShadows]);
  useEffect(
    () => () => {
      for (const b of Object.values(meshes.bodies)) for (const m of b.meshes) m.dispose();
      for (const m of meshes.wheels) m.dispose();
      meshes.shadows.dispose();
      for (const c of sim.cars) vehicles.delete(`traffic-${c.slot}`);
    },
    [meshes, sim],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => Object.fromEntries(Object.entries(PALETTE).map(([k, list]) => [k, list.map((c) => new THREE.Color(c))])) as Record<TrafficKind, THREE.Color[]>, []);
  // Putaran roda per slot (rad) & posisi x sebelumnya.
  const spin = useRef<number[]>([]);
  const prevX = useRef<(number | null)[]>([]);
  const wheelM = useMemo(() => new THREE.Matrix4(), []);
  const shadowM = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ camera }, rawDt) => {
    sim.step(rawDt, peopleNow(), moversExcept('traffic-'));
    streetState.halteDwelling = sim.halteDwelling;
    streetState.halteArrivals = sim.halteArrivals;
    for (const c of sim.cars) {
      if (c.active) vehicles.set(`traffic-${c.slot}`, { x: c.x, z: laneZ(c.dir), dir: c.dir, half: TRAFFIC_HALF[c.kind], speed: c.speed });
      else vehicles.delete(`traffic-${c.slot}`);
      // Roda: sudut += jarak tempuh / jari-jari (maju searah moncong).
      const px = prevX.current[c.slot];
      if (c.active && px !== null && px !== undefined) spin.current[c.slot] = (spin.current[c.slot] ?? 0) + (Math.abs(c.x - px) < 5 ? ((c.x - px) * c.dir) / VEHICLES[KIND_MODEL[c.kind]].wheelR : 0);
      prevX.current[c.slot] = c.active ? c.x : null;
    }
    let w = 0;
    let sh = 0;
    for (const kind of TRAFFIC_KINDS) {
      const body = meshes.bodies[kind];
      if (!body) continue;
      const spec = VEHICLES[KIND_MODEL[kind]];
      let k = 0;
      for (const c of sim.cars) {
        if (c.kind !== kind || !c.active) continue;
        // Kendaraan yang terhalang dinding (kamera di dalam apotek) tidak dimasukkan ke daftar instance.
        if (!outsideVisible(camera.position.x, camera.position.z, c.x, laneZ(c.dir))) continue;
        dummy.position.set(c.x, 0, laneZ(c.dir));
        dummy.rotation.set(0, c.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        // Buffer matriks dipakai bersama semua material jenis ini → cukup ditulis sekali.
        dummy.matrix.toArray(body.matrix.array, k * 16);
        body.paint?.setColorAt(k, colors[kind][c.color % colors[kind].length]);
        for (let i = 0; i < 4; i++) {
          wheelMatrix(wheelM, dummy.matrix, spec, i, spin.current[c.slot] ?? 0, 0);
          meshes.wheels[0].setMatrixAt(w, wheelM);
          w++;
        }
        shadowM.compose(tmpP.set(0, 0.012, 0), tmpQ.identity(), tmpS.set(spec.width + 0.45, 1, spec.length + 0.5));
        meshes.shadows.setMatrixAt(sh++, wheelM.multiplyMatrices(dummy.matrix, shadowM));
        k++;
      }
      if (k) body.matrix.needsUpdate = true;
      if (k && body.paint?.instanceColor) body.paint.instanceColor.needsUpdate = true;
      for (const m of body.meshes) {
        m.count = k;
        m.visible = k > 0;
        if (k) m.computeBoundingSphere();
      }
    }
    if (w) meshes.wheels[0].instanceMatrix.needsUpdate = true;
    for (const m of [...meshes.wheels, meshes.shadows]) {
      const n = m === meshes.shadows ? sh : w;
      m.count = n;
      m.visible = n > 0;
      if (!n) continue;
      if (m === meshes.shadows) m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  });
  return (
    <group name="traffic">
      {[...Object.values(meshes.bodies).flatMap((b) => b.meshes), ...meshes.wheels, meshes.shadows].map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ Showroom (khusus mode pengembangan)

/**
 * Deretan kendaraan diam untuk pemeriksaan visual (tangkapan layar). Hanya di mode pengembangan bila
 * localStorage 'pharmacy3d.debugShowroom' = '1'; tidak ada di build produksi.
 */
export function showroomEnabled() {
  try {
    return import.meta.env.DEV && localStorage.getItem('pharmacy3d.debugShowroom') === '1';
  } catch {
    return false;
  }
}

export function VehicleShowroom() {
  useVehicleTextures();
  const enabled = useMemo(showroomEnabled, []);
  if (!enabled) return null;
  const row: [VehicleKind, MatKey, number, string][] = [
    ['mpv', 'carPaint', -9, '#b9bec3'],
    ['hatch', 'carPaint', -3, '#8a1c22'],
    ['angkot', 'carPaint', 3, '#2c6db5'],
    ['van', 'vanPaint', 9.5, ''],
  ];
  return (
    <group name="vehicle-showroom">
      {row.map(([kind, paint, x, color]) => (
        <ShowroomCar key={kind} kind={kind} paint={paint} x={x} color={color} />
      ))}
    </group>
  );
}

function ShowroomCar({ kind, paint, x, color }: { kind: VehicleKind; paint: MatKey; x: number; color: string }) {
  // Cat lalu lintas memakai instanceColor; di showroom diberi salinan material berwarna.
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!color || !ref.current) return;
    ref.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material === MAT.carPaint) {
        const m = (MAT.carPaint as THREE.MeshPhysicalMaterial).clone();
        m.color.set(color);
        mesh.material = m;
      }
    });
  }, [color]);
  return (
    <group ref={ref} position={[x, 0, STREET_SHOWROOM_Z]} rotation={[0, Math.PI / 2, 0]}>
      <VehicleVisual kind={kind} paint={paint} />
    </group>
  );
}

/** Lajur timur (dekat apotek) — kendaraan showroom diparkir di sini. */
const STREET_SHOWROOM_Z = 16.75;
