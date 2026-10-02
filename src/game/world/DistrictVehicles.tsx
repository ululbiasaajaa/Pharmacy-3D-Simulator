import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GeoBuilder } from '@/game/visual/geometry';
import { BuiltMeshes } from '@/game/visual/Built';
import { useVisualProfile } from '@/game/visual/quality';
import { useGame } from '@/stores/gameStore';
import type { GameState } from '@/domain/types';
import { Character, type CharacterAnim } from '@/game/npc/Character';
import { patientStyle } from '@/game/npc/characterModel';
import { crowd, streetState, vehicles } from '@/game/npc/crowd';
import { CanvasLabel } from './CanvasLabel';
import { MAT, type MatKey } from './materials';
import { scooterModel } from './streetModels';
import { angkotModel, boxVanModel, carModel } from './vehicleModels';
import { useWorld } from './worldStore';
import { LOADING, STAFF_PARKING } from './district';
import { TRAFFIC_HALF, TrafficSim, VAN_HALF, VanSim, laneZ, type Mover, type Person, type TrafficKind } from './traffic';
import { outsideVisible } from '@/game/visual/InteriorCull';

const STAFF_COLORS: MatKey[] = ['bikeBlack', 'bikeRed', 'bikeWhite', 'bikeBlue', 'bikeBlack'];

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
  return <BuiltMeshes parts={parts} castShadow />;
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
 * Collider parkirnya aktif lewat worldStore.vanParked hanya saat van benar-benar berhenti di tempat parkir.
 */
export function DeliveryVan() {
  const wanted = useGame((s) => deliveryWanted(s.game));
  const wantedRef = useRef(wanted);
  wantedRef.current = wanted;
  const sim = useMemo(() => new VanSim(), []);
  const group = useRef<THREE.Group>(null);
  const [courier, setCourier] = useState(false);
  const parts = useMemo(() => {
    const b = new GeoBuilder<MatKey>();
    boxVanModel(b);
    return b.build();
  }, []);
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
        <BuiltMeshes parts={parts} castShadow />
        {/* Nama fiktif & generik (bukan merek nyata). */}
        <CanvasLabel text="DISTRIBUSI FARMASI · PBF" width={2.9} height={0.5} position={[0.99, 1.68, -0.82]} rotation={[0, Math.PI / 2, 0]} background="#ffffff" color="#0f766e" fontSize={80} />
        <CanvasLabel text="DISTRIBUSI FARMASI · PBF" width={2.9} height={0.5} position={[-0.99, 1.68, -0.82]} rotation={[0, -Math.PI / 2, 0]} background="#ffffff" color="#0f766e" fontSize={80} />
      </group>
      {courier && <Courier />}
    </group>
  );
}

// ------------------------------------------------------------------ Lalu lintas

const PALETTE: Record<TrafficKind, string[]> = {
  car: ['#c4c8cc', '#f1f1ee', '#202326', '#8f1d1d', '#284a7a', '#6b7178'],
  angkot: ['#2f74c0', '#2f8f5b', '#d9622b', '#2f74c0', '#2f8f5b', '#2f74c0'],
};

/** Jumlah & jenis kendaraan menurut profil kualitas (performa lebih penting daripada keramaian). */
function trafficKinds(quality: string): TrafficKind[] {
  if (quality === 'low') return ['car', 'angkot'];
  if (quality === 'medium') return ['car', 'car', 'angkot'];
  return ['car', 'car', 'car', 'angkot', 'angkot'];
}

/**
 * Mobil & angkot yang lewat (TrafficSim). Setiap jenis kendaraan dirender sebagai InstancedMesh per material
 * (≈7 draw call per jenis, berapa pun jumlah kendaraannya); warna cat lewat instanceColor.
 */
export function Traffic() {
  const profile = useVisualProfile();
  const kinds = useMemo(() => trafficKinds(profile.quality), [profile.quality]);
  const sim = useMemo(() => new TrafficSim(kinds, 7), [kinds]);
  const meshes = useMemo(() => {
    const out: Record<TrafficKind, THREE.InstancedMesh[]> = { car: [], angkot: [] };
    for (const kind of ['car', 'angkot'] as TrafficKind[]) {
      const max = Math.max(1, kinds.filter((k) => k === kind).length);
      const b = new GeoBuilder<MatKey>();
      if (kind === 'car') carModel(b, 'carPaint');
      else angkotModel(b, 'carPaint');
      for (const part of b.build()) {
        const m = new THREE.InstancedMesh(part.geometry, MAT[part.mat], max);
        m.count = 0;
        m.castShadow = profile.sunShadows;
        m.receiveShadow = true;
        if (part.mat === 'carPaint') m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
        out[kind].push(m);
      }
    }
    return out;
  }, [kinds, profile.sunShadows]);
  useEffect(
    () => () => {
      for (const list of Object.values(meshes)) for (const m of list) m.geometry.dispose();
      for (const c of sim.cars) vehicles.delete(`traffic-${c.slot}`);
    },
    [meshes, sim],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => Object.fromEntries(Object.entries(PALETTE).map(([k, list]) => [k, list.map((c) => new THREE.Color(c))])) as Record<TrafficKind, THREE.Color[]>, []);
  useFrame(({ camera }, rawDt) => {
    sim.step(rawDt, peopleNow(), moversExcept('traffic-'));
    streetState.halteDwelling = sim.halteDwelling;
    streetState.halteArrivals = sim.halteArrivals;
    for (const c of sim.cars) {
      if (c.active) vehicles.set(`traffic-${c.slot}`, { x: c.x, z: laneZ(c.dir), dir: c.dir, half: TRAFFIC_HALF[c.kind], speed: c.speed });
      else vehicles.delete(`traffic-${c.slot}`);
    }
    for (const kind of ['car', 'angkot'] as TrafficKind[]) {
      let k = 0;
      for (const c of sim.cars) {
        if (c.kind !== kind || !c.active) continue;
        // Kendaraan yang terhalang dinding (kamera di dalam apotek) tidak dimasukkan ke daftar instance.
        if (!outsideVisible(camera.position.x, camera.position.z, c.x, laneZ(c.dir))) continue;
        dummy.position.set(c.x, 0, laneZ(c.dir));
        dummy.rotation.set(0, c.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
        dummy.updateMatrix();
        for (const m of meshes[kind]) {
          m.setMatrixAt(k, dummy.matrix);
          if (m.instanceColor) m.setColorAt(k, colors[kind][c.color % colors[kind].length]);
        }
        k++;
      }
      for (const m of meshes[kind]) {
        m.count = k;
        m.visible = k > 0;
        if (!k) continue;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere();
      }
    }
  });
  return (
    <group name="traffic">
      {[...meshes.car, ...meshes.angkot].map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </group>
  );
}
