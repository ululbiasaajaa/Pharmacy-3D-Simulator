import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Character, type CharacterAnim } from './Character';
import { patientStyle } from './characterModel';
import { crowd, streetState, vehicles } from './crowd';
import { useWorld } from '@/game/world/worldStore';
import { useVisualProfile } from '@/game/visual/quality';
import { CAFE_SET, GATES, HOUSE_DOORS, SHOPS, STREET, TRAFFIC } from '@/game/world/district';
import { crossingClear, entersRoad } from '@/game/world/traffic';
import type { Vec2 } from '@/game/world/layout';
import { outsideVisible } from '@/game/visual/InteriorCull';
import { HALTE_SEATS, activityAt, buildPedGraph, planDestinations, shortestPath, type Activity } from './pedestrianPlan';

/**
 * Kehidupan jalan (world building P4): pejalan kaki yang keluar dari rumah warga di gang belakang atau turun
 * dari angkot, mampir ke kios/etalase/kafe, menunggu angkot di halte, lalu pulang. Mereka menyeberang lewat
 * zebra cross (menunggu kendaraan yang masih melaju), menepi ke kiri saat berpapasan, dan berhenti/menghindar
 * bila pemain menghalangi. Ditambah penjaga kios & satpam yang menoleh saat pemain mendekat.
 * Murni latar: tidak memengaruhi simulasi. Jumlahnya dibatasi menurut profil kualitas.
 */

const GRAPH = buildPedGraph();
const WALK_SPEED = 1.25;
const EXIT_Z = STREET.backLaneFar + 0.15;
/** Pintu geser angkot yang berhenti di halte (sisi kiri = sisi trotoar; pintu 0,55 m di depan pusat). */
const ANGKOT_DOOR: Vec2 = [TRAFFIC.halteStopX - 0.55, STREET.curbFar + 0.3];

/** Reservasi tempat duduk bersama (kafe & bangku halte). */
const seats = { cafe: -1, halte: [-1, -1, -1] };
/** Posisi & arah pejalan kaki aktif (untuk menepi saat berpapasan). */
const peds = new Map<number, { x: number; z: number; hx: number; hz: number }>();

type Phase = 'hidden' | 'walk' | 'act' | 'waitBus';

interface PedState {
  serial: number;
  pos: Vec2;
  heading: number;
  route: Vec2[];
  plan: string[];
  /** Simpul graf tempat pejalan kaki berada/terakhir dituju. */
  at: string;
  phase: Phase;
  timer: number;
  act: Activity | null;
  speed: number;
  blocked: number;
  side: number;
  /** Tempat duduk kegiatan terakhir (dipertahankan saat berdiri agar transisi halus). */
  seat: Vec2 | null;
  seatBlend: number;
  /** Akan menghilang di ujung rute (masuk rumah / naik angkot). */
  vanish: boolean;
}

let seed = 1234567;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function nodePos(id: string): Vec2 {
  return GRAPH.byId.get(id)!.p;
}

/** Menyusun rute dari simpul `from` ke tujuan pertama rencana. */
function routeToNext(p: PedState, slot: number) {
  const target = p.plan[0];
  const node = GRAPH.byId.get(target);
  if (!node) {
    p.phase = 'hidden';
    return;
  }
  const ids = shortestPath(GRAPH, p.at, target);
  const pts = ids.slice(1).map(nodePos);
  let act: Activity | null = null;
  if (node.kind === 'halte') {
    const free = seats.halte.findIndex((s) => s < 0);
    if (free >= 0) {
      seats.halte[free] = slot;
      act = activityAt(node, free);
    } else act = { ...activityAt(node), mode: 'idle', seat: undefined, stand: node.p };
  } else if (node.kind === 'cafe') {
    if (seats.cafe < 0) {
      seats.cafe = slot;
      act = activityAt(node);
    } else act = { ...activityAt(node), mode: 'idle', seat: undefined, duration: [3, 5] };
  } else if (node.kind === 'home') {
    act = null;
    pts.push([node.p[0], EXIT_Z]);
    p.vanish = true;
  } else act = activityAt(node);
  if (act && (act.stand[0] !== node.p[0] || act.stand[1] !== node.p[1])) pts.push(act.stand);
  p.route = pts;
  p.act = act;
  p.at = target;
  p.phase = 'walk';
}

function releaseSeats(slot: number) {
  if (seats.cafe === slot) seats.cafe = -1;
  seats.halte = seats.halte.map((s) => (s === slot ? -1 : s));
}

/** Memunculkan pejalan kaki: dari pintu rumah warga, dari angkot di halte, atau (awal) di jalur mana pun. */
function spawn(p: PedState, slot: number, where: 'home' | 'halte' | 'anywhere') {
  releaseSeats(slot);
  p.serial++;
  p.speed = WALK_SPEED * (0.88 + rnd() * 0.22);
  p.blocked = 0;
  p.side = 0;
  p.seat = null;
  p.seatBlend = 0;
  p.vanish = false;
  p.timer = 0;
  const exclude = new Set<string>(seats.cafe >= 0 ? ['cafe'] : []);
  if (where === 'home') {
    const i = Math.floor(rnd() * HOUSE_DOORS.length);
    p.pos = [HOUSE_DOORS[i], EXIT_Z];
    p.heading = 0;
    p.at = `home${i}`;
    exclude.add(`home${i}`);
  } else if (where === 'halte') {
    p.pos = [ANGKOT_DOOR[0], ANGKOT_DOOR[1]];
    p.heading = 0;
    p.at = 'halte';
  } else {
    const walk = GRAPH.nodes.filter((n) => !n.kind && !n.id.startsWith('b') && !n.id.startsWith('a'));
    const n = walk[Math.floor(rnd() * walk.length)];
    p.pos = [n.p[0], n.p[1]];
    p.heading = rnd() * Math.PI * 2;
    p.at = n.id;
  }
  p.plan = planDestinations(GRAPH, rnd, exclude).filter((id) => !(where === 'halte' && id === 'halte'));
  if (!p.plan.length) p.plan = ['home0'];
  routeToNext(p, slot);
}

/** Kendaraan (dengan laju) untuk keputusan menyeberang. */
function movingVehicles() {
  return [...vehicles.entries()].map(([id, v]) => ({ id, ...v }));
}

const PedestrianSlot = memo(function PedestrianSlot({ slot, startVisible }: { slot: number; startVisible: boolean }) {
  const state = useRef<PedState>({
    serial: 0,
    pos: [0, 0],
    heading: 0,
    route: [],
    plan: [],
    at: 'n0',
    phase: 'hidden',
    timer: 1 + slot * 2.5,
    act: null,
    speed: WALK_SPEED,
    blocked: 0,
    side: 0,
    seat: null,
    seatBlend: 0,
    vanish: false,
  });
  const [serial, setSerial] = useState(0);
  const group = useRef<THREE.Group>(null);
  const anim = useRef<CharacterAnim>({ moving: false, phase: 0, mode: 'idle' });
  const style = useMemo(() => {
    const female = (slot + serial) % 2 === 0;
    return patientStyle({ id: `PJK-${slot}-${serial}`, gender: female ? 'P' : 'L', age: 22 + ((slot * 13 + serial * 7) % 45), appearance: (slot + serial) % 4 });
  }, [slot, serial]);
  const key = `ped-${slot}`;

  useEffect(() => {
    if (startVisible) {
      spawn(state.current, slot, 'anywhere');
      setSerial(state.current.serial);
    }
    return () => {
      crowd.delete(key);
      peds.delete(slot);
      releaseSeats(slot);
    };
  }, [slot, startVisible, key]);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const p = state.current;
    const g = group.current;
    if (!g) return;
    if (p.phase === 'hidden') {
      g.visible = false;
      crowd.delete(key);
      peds.delete(slot);
      p.timer -= dt;
      if (p.timer <= 0) {
        // Penumpang turun saat angkot berhenti di halte; selain itu keluar dari rumah warga.
        spawn(p, slot, streetState.halteDwelling && rnd() < 0.6 ? 'halte' : 'home');
        setSerial(p.serial);
      }
      return;
    }
    // Tidak dirender bila terhalang dinding (kamera di dalam apotek) atau terlalu jauh; logika tetap berjalan.
    g.visible = outsideVisible(camera.position.x, camera.position.z, p.pos[0], p.pos[1], 42);
    let moving = false;
    let mode: CharacterAnim['mode'] = 'idle';
    let face = p.heading;
    if (p.phase === 'walk') {
      const target = p.route[0];
      if (!target) {
        // Tiba di tujuan.
        if (p.vanish) {
          p.phase = 'hidden';
          p.timer = 4 + rnd() * 6;
          releaseSeats(slot);
        } else if (p.act) {
          p.seat = p.act.seat ?? null;
          p.seatBlend = 0;
          p.phase = p.at === 'halte' ? 'waitBus' : 'act';
          p.timer = lerp(p.act.duration[0], p.act.duration[1], rnd());
        }
      } else {
        const dx = target[0] - p.pos[0];
        const dz = target[1] - p.pos[1];
        const dist = Math.hypot(dx, dz);
        const hx = dx / (dist || 1);
        const hz = dz / (dist || 1);
        let wait = false;
        // Menyeberang hanya bila tak ada kendaraan yang masih melaju mendekat (kendaraan berhenti untuk penyeberang).
        if (entersRoad(p.pos, target) && !crossingClear(movingVehicles())) wait = true;
        // Pemain menghalangi (diukur dari posisi tampak, termasuk geser kiri): berhenti & menoleh; bila lama, menepi.
        const pl = useWorld.getState().player;
        const rx = pl.x - (p.pos[0] + hz * p.side);
        const rz = pl.z - (p.pos[1] - hx * p.side);
        const along = rx * hx + rz * hz;
        const lat = Math.abs(rx * hz - rz * hx);
        let sideTarget = 0;
        if (along > 0 && along < 0.95 && lat < 0.5) {
          wait = true;
          p.blocked += dt;
          face = Math.atan2(rx, rz);
          if (p.blocked > 1.4) p.side = 0.5;
        } else p.blocked = Math.max(0, p.blocked - dt);
        // Kendaraan (mis. mobil boks keluar gang) tepat di depan: tunggu.
        for (const v of vehicles.values()) {
          const vx = v.x - p.pos[0];
          const vz = v.z - p.pos[1];
          const va = vx * hx + vz * hz;
          if (va > 0 && va < v.half + 1.2 && Math.abs(vx * hz - vz * hx) < 1.4) wait = true;
        }
        // Berpapasan dengan pejalan kaki lain: menepi ke kiri (kebiasaan lajur kiri).
        for (const [other, o] of peds) {
          if (other === slot) continue;
          const ox = o.x - p.pos[0];
          const oz = o.z - p.pos[1];
          if (Math.hypot(ox, oz) < 3 && ox * hx + oz * hz > 0 && o.hx * hx + o.hz * hz < -0.5) sideTarget = 0.28;
        }
        if (p.blocked <= 1.4) p.side = THREE.MathUtils.damp(p.side, sideTarget, 4, dt);
        p.seatBlend = THREE.MathUtils.damp(p.seatBlend, 0, 6, dt);
        if (!wait) {
          const step = Math.min(dist, p.speed * dt);
          p.pos = [p.pos[0] + hx * step, p.pos[1] + hz * step];
          if (dist - step < 0.02) p.route.shift();
          moving = true;
          face = Math.atan2(hx, hz);
          p.heading = face;
        }
        peds.set(slot, { x: p.pos[0], z: p.pos[1], hx, hz });
      }
    } else if (p.phase === 'act' || p.phase === 'waitBus') {
      const a = p.act!;
      face = a.face;
      mode = a.mode;
      if (a.seat) p.seatBlend = THREE.MathUtils.damp(p.seatBlend, 1, 5, dt);
      // Penjaga/pelanggan menoleh bila pemain berdiri dekat (respons sederhana).
      const pl = useWorld.getState().player;
      const near = Math.hypot(pl.x - p.pos[0], pl.z - p.pos[1]) < 2.2;
      if (near && a.mode !== 'sit') {
        face = Math.atan2(pl.x - p.pos[0], pl.z - p.pos[1]);
        mode = 'talk';
      }
      p.timer -= dt;
      const boarding = p.phase === 'waitBus' && streetState.halteDwelling;
      if (boarding || p.timer <= 0) {
        releaseSeats(slot);
        if (boarding) {
          // Naik angkot: berjalan ke pintu angkot di tepi kanstin lalu menghilang.
          p.route = [[ANGKOT_DOOR[0], ANGKOT_DOOR[1]]];
          p.vanish = true;
          p.act = null;
          p.phase = 'walk';
        } else {
          p.plan.shift();
          if (!p.plan.length) p.plan = [`home${Math.floor(rnd() * HOUSE_DOORS.length)}`];
          // Menunggu terlalu lama di halte tanpa angkot: pulang.
          if (p.phase === 'waitBus') p.plan = [`home${Math.floor(rnd() * HOUSE_DOORS.length)}`];
          routeToNext(p, slot);
        }
      }
    }
    // Render: posisi + geser kiri saat berpapasan + transisi duduk.
    const lx = Math.cos(p.heading) * p.side;
    const lz = -Math.sin(p.heading) * p.side;
    const seat = p.seat;
    const sx = seat ? lerp(p.pos[0], seat[0], p.seatBlend) : p.pos[0];
    const sz = seat ? lerp(p.pos[1], seat[1], p.seatBlend) : p.pos[1];
    g.position.set(sx + lx, 0, sz + lz);
    g.rotation.y = wrap(g.rotation.y + wrap(face - g.rotation.y) * Math.min(1, dt * 6));
    anim.current.moving = moving;
    anim.current.speed = p.speed;
    anim.current.mode = moving ? 'idle' : seat && p.seatBlend > 0.5 ? 'sit' : mode;
    crowd.set(key, { x: sx + lx, z: sz + lz });
  });

  return (
    <group ref={group} visible={false}>
      <Character key={serial} style={style} anim={anim} />
    </group>
  );
});

// ------------------------------------------------------------------ Penjaga kios & satpam

interface Keeper {
  id: string;
  avatar: string;
  female: boolean;
  pos: Vec2;
  face: number;
}

function keeperList(count: number): Keeper[] {
  const at = (id: string, dx: number, avatar: string, female: boolean): Keeper => {
    const s = SHOPS.find((x) => x.id === id)!;
    return { id: `PENJAGA-${id}`, avatar, female, pos: [(s.x0 + s.x1) / 2 + dx, s.front - s.facing * 0.95], face: s.facing === 1 ? 0 : Math.PI };
  };
  const g = GATES[0];
  const list: Keeper[] = [
    at('S3', -1.3, 'Male_Adult_10', false),
    { id: 'SATPAM', avatar: 'Male_Adult_04', female: false, pos: [(g.booth.minX + g.booth.maxX) / 2, (g.booth.minZ + g.booth.maxZ) / 2], face: 0 },
    at('F5', -1.0, 'Female_Adult_07', true),
    at('S4', 1.1, 'Female_Adult_03', true),
    at('F1', 0.6, 'Female_Adult_05', true),
  ];
  return list.slice(0, count);
}

/** Penjaga berdiri di balik meja kios; menoleh & berbicara bila pemain mendekat di depannya. */
const KeeperNPC = memo(function KeeperNPC({ k }: { k: Keeper }) {
  const group = useRef<THREE.Group>(null);
  const anim = useRef<CharacterAnim>({ moving: false, phase: 0, mode: 'idle' });
  const style = useMemo(() => {
    const s = patientStyle({ id: k.id, gender: k.female ? 'P' : 'L', age: 38, appearance: 1 });
    return { ...s, avatar: k.avatar, key: `${s.key}:${k.avatar}` };
  }, [k]);
  useFrame(({ camera }, rawDt) => {
    const g = group.current;
    if (!g) return;
    // Penjaga kios: figur kecil di balik meja — tidak dirender bila jauh (> 30 m) atau terhalang dinding.
    g.visible = outsideVisible(camera.position.x, camera.position.z, k.pos[0], k.pos[1], 30);
    if (!g.visible) return;
    const dt = Math.min(rawDt, 0.1);
    const pl = useWorld.getState().player;
    const dx = pl.x - k.pos[0];
    const dz = pl.z - k.pos[1];
    const inFront = dx * Math.sin(k.face) + dz * Math.cos(k.face) > 0;
    const near = inFront && Math.hypot(dx, dz) < 3.5;
    // Menoleh ke pemain (dibatasi ±70° dari arah meja).
    const toPlayer = Math.atan2(dx, dz);
    const face = near ? k.face + THREE.MathUtils.clamp(wrap(toPlayer - k.face), -1.2, 1.2) : k.face;
    g.rotation.y = wrap(g.rotation.y + wrap(face - g.rotation.y) * Math.min(1, dt * 5));
    anim.current.mode = near ? 'talk' : 'idle';
  });
  return (
    <group ref={group} position={[k.pos[0], 0, k.pos[1]]} rotation={[0, k.face, 0]}>
      <Character style={style} anim={anim} />
    </group>
  );
});

/** Pengunjung tetap di kursi teras kedai kopi. */
function CafeVisitor() {
  const anim = useRef<CharacterAnim>({ moving: false, phase: 0, mode: 'sit' });
  const style = useMemo(() => {
    const s = patientStyle({ id: 'SL-CAFE', gender: 'P', age: 28, appearance: 2 });
    return { ...s, avatar: 'Female_Adult_12', key: `${s.key}:cafe` };
  }, []);
  return (
    <group position={[CAFE_SET.x + 0.72, 0, CAFE_SET.z]} rotation={[0, -Math.PI / 2, 0]}>
      <Character style={style} anim={anim} />
    </group>
  );
}

/** Jumlah pejalan kaki & penjaga per profil kualitas (performa > keramaian). */
function budget(quality: string) {
  if (quality === 'low') return { walkers: 2, keepers: 1 };
  if (quality === 'medium') return { walkers: 3, keepers: 3 };
  return { walkers: 5, keepers: 5 };
}

export function Pedestrians() {
  const profile = useVisualProfile();
  const { walkers, keepers } = budget(profile.quality);
  const keeperDefs = useMemo(() => keeperList(keepers), [keepers]);
  return (
    <group name="street-life">
      <CafeVisitor />
      {keeperDefs.map((k) => (
        <KeeperNPC key={k.id} k={k} />
      ))}
      {Array.from({ length: walkers }, (_, i) => (
        <PedestrianSlot key={i} slot={i} startVisible={i % 2 === 0} />
      ))}
    </group>
  );
}

/** Untuk uji & debug: jumlah kursi halte. */
export const HALTE_SEAT_COUNT = HALTE_SEATS.length;
