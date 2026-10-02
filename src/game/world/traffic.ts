import type { Vec2 } from './layout';
import { GATES, STREET, TRAFFIC, VAN_REVERSE_OUT, VAN_ROUTE_IN, VAN_ROUTE_OUT } from './district';

/**
 * Logika lalu lintas kawasan (murni, tanpa React/Three — diuji di traffic.test.ts):
 * - mobil & angkot di lajur kiri (timur z 16,75, barat z 20,25), muncul/hilang jauh di balik gerbang;
 * - menjaga jarak dengan kendaraan di depan; berhenti untuk orang di lajurnya;
 * - berhenti di garis henti bila ada orang di zebra cross;
 * - melambat melewati portal gerbang; angkot arah barat kadang berhenti di halte;
 * - mobil boks PBF: datang, mundur ke area bongkar muat, parkir selama ada kiriman, lalu pergi.
 */

/** Jenis lalu lintas: MPV ('car'), hatchback, angkot. Setengah panjang keseluruhan = VEHICLES.length / 2 (vehicleModels.ts). */
export type TrafficKind = 'car' | 'hatch' | 'angkot';
export const TRAFFIC_HALF: Record<TrafficKind, number> = { car: 2.25, hatch: 1.905, angkot: 2.09 };
const CRUISE: Record<TrafficKind, number> = { car: 7.5, hatch: 7.8, angkot: 6.2 };
/** Laju di sekitar portal gerbang (m/s). */
const GATE_SPEED = 4.5;
const ACCEL = 2.5;
const BRAKE = 7;
const COMFORT_DECEL = 3.5;

export interface Person {
  x: number;
  z: number;
}

/** Kendaraan lain (dari registri `vehicles`): `half` = setengah panjang. */
export interface Mover {
  id: string;
  x: number;
  z: number;
  dir: number;
  half: number;
}

export const laneZ = (dir: 1 | -1) => (dir > 0 ? STREET.laneEast : STREET.laneWest);

/** Orang yang sedang berada di zebra cross (termasuk tepat di bibir kanstin). */
export function onCrossing(p: Person) {
  return p.x > STREET.zebraX0 - 0.4 && p.x < STREET.zebraX1 + 0.4 && p.z > STREET.curbNear - 0.3 && p.z < STREET.curbFar + 0.3;
}

const approachSpeed = (speed: number, desired: number, dt: number) => (desired > speed ? Math.min(desired, speed + ACCEL * dt) : Math.max(desired, speed - BRAKE * dt));
/** Laju yang masih bisa berhenti dalam jarak `free` (m). */
const stoppable = (free: number) => Math.sqrt(2 * COMFORT_DECEL * Math.max(0, free));

/**
 * Jarak bebas (m) di depan ujung kendaraan yang melaju di lajur `dir`: orang di lajur, kendaraan di depan,
 * dan garis henti zebra cross bila ada orang menyeberang.
 */
export function laneFreeDistance(selfId: string, dir: 1 | -1, x: number, half: number, people: Person[], movers: Mover[]): number {
  let free = Infinity;
  const front = x + dir * half;
  const lz = laneZ(dir);
  for (const p of people) {
    if (Math.abs(p.z - lz) > 1.7) continue;
    const ahead = dir * (p.x - front);
    if (ahead < -half * 2) continue;
    free = Math.min(free, Math.max(0, ahead - 0.9));
  }
  if (people.some(onCrossing)) {
    const stop = dir > 0 ? TRAFFIC.stopLineEast : TRAFFIC.stopLineWest;
    const d = dir * (stop - front);
    if (d > -0.3) free = Math.min(free, Math.max(0, d));
  }
  for (const m of movers) {
    if (m.id === selfId || Math.abs(m.z - lz) > 1.6) continue;
    const ahead = dir * (m.x - x);
    if (ahead <= 0) continue;
    free = Math.min(free, Math.max(0, ahead - half - m.half - TRAFFIC.gap));
  }
  return free;
}

export interface TrafficCar {
  slot: number;
  kind: TrafficKind;
  active: boolean;
  dir: 1 | -1;
  x: number;
  speed: number;
  /** Detik sampai muncul kembali (saat tidak aktif). */
  respawn: number;
  /** Sisa waktu berhenti di halte (angkot). */
  dwell: number;
  /** Sudah (atau tidak akan) berhenti di halte pada perjalanan ini. */
  halteDone: boolean;
  color: number;
}

function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class TrafficSim {
  cars: TrafficCar[];
  /** Ada angkot yang sedang berhenti di halte (penumpang naik/turun). */
  halteDwelling = false;
  /** Bertambah setiap kali angkot mulai berhenti di halte (pemicu penumpang turun). */
  halteArrivals = 0;
  private rnd: () => number;

  constructor(kinds: TrafficKind[], seed = 7, prefill = true) {
    this.rnd = lcg(seed);
    this.cars = kinds.map((kind, slot) => ({ slot, kind, active: false, dir: 1, x: 0, speed: 0, respawn: 2 + slot * 3.5, dwell: 0, halteDone: true, color: 0 }));
    if (prefill) {
      // Sebagian kendaraan sudah di jalan saat dimuat (berjarak, kedua arah), agar jalan tidak kosong.
      this.cars.forEach((c, i) => {
        if (i % 2) return;
        this.activate(c, i % 4 === 0 ? 1 : -1, (this.rnd() - 0.5) * 70);
      });
    }
  }

  private activate(c: TrafficCar, dir: 1 | -1, x: number) {
    c.active = true;
    c.dir = dir;
    c.x = x;
    c.speed = CRUISE[c.kind];
    c.dwell = 0;
    // Angkot arah barat berhenti di halte pada ±65% perjalanan.
    c.halteDone = !(c.kind === 'angkot' && dir < 0 && this.rnd() < 0.65);
    c.color = Math.floor(this.rnd() * 6);
  }

  /** Daftar kendaraan aktif sebagai Mover (untuk registri bersama & kendaraan lain). */
  movers(): Mover[] {
    return this.cars.filter((c) => c.active).map((c) => ({ id: `traffic-${c.slot}`, x: c.x, z: laneZ(c.dir), dir: c.dir, half: TRAFFIC_HALF[c.kind] }));
  }

  step(rawDt: number, people: Person[], others: Mover[]) {
    const dt = Math.min(rawDt, 0.1);
    this.halteDwelling = false;
    for (const c of this.cars) {
      const half = TRAFFIC_HALF[c.kind];
      const movers = [...this.movers(), ...others];
      if (!c.active) {
        c.respawn -= dt;
        if (c.respawn > 0) continue;
        const dir: 1 | -1 = this.rnd() < 0.5 ? 1 : -1;
        const x0 = -dir * TRAFFIC.spawnX;
        if (movers.some((m) => Math.abs(m.z - laneZ(dir)) < 1.6 && Math.abs(m.x - x0) < 14)) {
          c.respawn = 1;
          continue;
        }
        this.activate(c, dir, x0);
        continue;
      }
      if (c.dwell > 0) {
        c.dwell -= dt;
        c.speed = 0;
        this.halteDwelling = true;
        continue;
      }
      let free = laneFreeDistance(`traffic-${c.slot}`, c.dir, c.x, half, people, movers);
      let cap = CRUISE[c.kind];
      for (const g of GATES) if (Math.abs(c.x - g.x) < 12) cap = Math.min(cap, GATE_SPEED);
      if (!c.halteDone) {
        const d = c.dir * (TRAFFIC.halteStopX - c.x);
        if (d >= -0.5) free = Math.min(free, Math.max(0, d));
        if (d < 0.3 && c.speed < 0.3) {
          c.halteDone = true;
          c.dwell = 4 + this.rnd() * 4;
          this.halteArrivals++;
          this.halteDwelling = true;
          continue;
        }
      }
      c.speed = approachSpeed(c.speed, Math.min(cap, stoppable(free - 0.2) + (free > 0.4 ? 0.25 : 0)), dt);
      c.x += c.dir * Math.min(c.speed * dt, free);
      if (c.dir * c.x > TRAFFIC.spawnX + 2) {
        c.active = false;
        c.respawn = 4 + this.rnd() * 10;
      }
    }
  }
}

// ------------------------------------------------------------------ Mobil boks PBF

export type VanPhase = 'away' | 'arrive' | 'parked' | 'closing' | 'reverseOut' | 'leave';
/** Setengah panjang mobil boks termasuk bemper & lampu belakang (VEHICLES.van.length / 2). */
export const VAN_HALF = 2.6;
/** Jarak sumbu roda mobil boks (VEHICLES.van). */
const VAN_WHEELBASE = 3.22;
const VAN_HALF_W = 0.95;

/** Polyline dengan panjang kumulatif untuk interpolasi berdasarkan jarak tempuh. */
class Path {
  readonly cum: number[] = [0];
  constructor(readonly pts: Vec2[]) {
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  get total() {
    return this.cum[this.cum.length - 1];
  }
  at(s: number): Vec2 {
    const d = Math.max(0, Math.min(this.total, s));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    const t = (d - this.cum[i - 1]) / Math.max(1e-6, this.cum[i] - this.cum[i - 1]);
    const [a, b] = [this.pts[i - 1], this.pts[i]];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  /** Arah satuan gerak pada jarak s. */
  dirAt(s: number): Vec2 {
    const a = this.at(Math.min(s, this.total - 0.05));
    const b = this.at(Math.min(s + 0.05, this.total));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  }
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Ada kendaraan arah timur yang mendekat/berada di sekitar mulut gang kiri (van menunggu sebelum mundur ke jalan). */
export function eastLaneBusy(movers: Mover[]) {
  return movers.some((m) => m.id !== 'van' && Math.abs(m.z - STREET.laneEast) < 1.6 && m.x > -44 && m.x < -8);
}

/**
 * Mobil boks distributor (PBF): muncul saat ada kiriman tiba/akan tiba (`wanted`), masuk gang ke area bongkar muat,
 * parkir sampai semua kiriman diterima (minimal 8 detik agar terlihat), lalu mundur keluar & pergi ke timur.
 * Berhenti bila ada orang/kendaraan di jalur geraknya; menunggu lajur timur kosong sebelum mundur ke jalan.
 */
export class VanSim {
  phase: VanPhase = 'away';
  x = VAN_ROUTE_IN[0][0];
  z = VAN_ROUTE_IN[0][1];
  /** Rotasi Y (moncong = +Z lokal); π/2 = menghadap timur. */
  heading = Math.PI / 2;
  speed = 0;
  /** Jarak tempuh bertanda (m; negatif saat mundur) — memutar roda. */
  odometer = 0;
  /** Sudut belok roda depan (radian, + = ke kiri) dari laju perubahan arah (model sepeda). */
  steer = 0;
  /** Lama parkir / hitung mundur fase (s). */
  timer = 0;
  private cooldown = 0;
  private path = new Path(VAN_ROUTE_IN);
  private s = 0;
  private reversing = false;

  get visible() {
    return this.phase !== 'away';
  }
  /** Collider parkir aktif (van berhenti penuh di area bongkar muat). */
  get parked() {
    return this.phase === 'parked' || this.phase === 'closing';
  }
  /** Sedang bergerak mundur (lampu mundur). */
  get isReversing() {
    return this.phase === 'reverseOut';
  }
  /** +1 bila pusat van berada di pita lajur timur (portal gerbang & jaga jarak), selain itu 0. */
  get laneDir() {
    return this.visible && Math.abs(this.z - STREET.laneEast) < 1.6 ? 1 : 0;
  }

  private setPath(pts: Vec2[], reversing: boolean) {
    this.path = new Path(pts);
    this.s = 0;
    this.reversing = reversing;
  }

  /** Titik ujung yang memimpin gerak (moncong saat maju, buritan saat mundur). */
  private leadPoint(): Vec2 {
    const k = this.reversing ? -VAN_HALF : VAN_HALF;
    return [this.x + Math.sin(this.heading) * k, this.z + Math.cos(this.heading) * k];
  }

  /** Jarak bebas di depan arah gerak terhadap orang & kendaraan lain. */
  private freeAhead(people: Person[], movers: Mover[]) {
    const [mx, mz] = this.path.dirAt(this.s);
    const [lx, lz] = this.leadPoint();
    let free = Infinity;
    for (const p of people) {
      const rx = p.x - lx;
      const rz = p.z - lz;
      const along = rx * mx + rz * mz;
      if (along > -0.4 && along < 7 && Math.abs(rx * mz - rz * mx) < VAN_HALF_W + 0.55) free = Math.min(free, Math.max(0, along - 0.7));
    }
    for (const m of movers) {
      if (m.id === 'van') continue;
      const rx = m.x - lx;
      const rz = m.z - lz;
      const along = rx * mx + rz * mz;
      if (along > -m.half && along < 12 && Math.abs(rx * mz - rz * mx) < VAN_HALF_W + 1.0) free = Math.min(free, Math.max(0, along - m.half - 1.0));
    }
    return free;
  }

  /** Maju/mundur di lintasan; mengembalikan true bila sudah tiba di ujung. */
  private advance(dt: number, cruise: number, people: Person[], movers: Mover[], limit = Infinity) {
    const remaining = this.path.total - this.s;
    const free = Math.min(this.freeAhead(people, movers), limit);
    const desired = Math.min(cruise, stoppable(remaining) + 0.25, stoppable(free - 0.1) + (free > 0.3 ? 0.2 : 0));
    this.speed = approachSpeed(this.speed, desired, dt);
    const moved = Math.min(this.speed * dt, remaining, Math.max(0, free));
    this.s += moved;
    this.odometer += this.reversing ? -moved : moved;
    const prevHeading = this.heading;
    [this.x, this.z] = this.path.at(this.s);
    // Arah moncong: menuju titik 2,2 m di depan pada lintasan (maju) atau kebalikannya (mundur); diredam.
    const ahead = this.path.at(this.s + 2.2);
    let dx = ahead[0] - this.x;
    let dz = ahead[1] - this.z;
    if (Math.hypot(dx, dz) < 0.05) [dx, dz] = this.path.dirAt(this.s);
    const target = this.reversing ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
    this.heading = wrapAngle(this.heading + wrapAngle(target - this.heading) * Math.min(1, dt * 5));
    if (moved > 1e-4) {
      // Model sepeda: tan(δ) = L · (perubahan arah per meter); arah dibalik saat mundur.
      const want = Math.atan(VAN_WHEELBASE * (wrapAngle(this.heading - prevHeading) / moved)) * (this.reversing ? -1 : 1);
      this.steer += (Math.max(-0.6, Math.min(0.6, want)) - this.steer) * Math.min(1, dt * 6);
    }
    return this.path.total - this.s < 0.02;
  }

  step(rawDt: number, wanted: boolean, people: Person[], movers: Mover[]) {
    const dt = Math.min(rawDt, 0.1);
    switch (this.phase) {
      case 'away':
        this.cooldown -= dt;
        if (wanted && this.cooldown <= 0 && !movers.some((m) => Math.abs(m.z - STREET.laneEast) < 1.6 && Math.abs(m.x - VAN_ROUTE_IN[0][0]) < 14)) {
          this.setPath(VAN_ROUTE_IN, false);
          [this.x, this.z] = VAN_ROUTE_IN[0];
          this.heading = Math.PI / 2;
          this.speed = 7;
          this.phase = 'arrive';
        }
        break;
      case 'arrive': {
        // Melambat menjelang belokan ke gang; pelan di dalam gang.
        const turnAt = this.path.cum[1];
        const cruise = this.s < turnAt - 9 ? 7.5 : this.s < turnAt ? 3.2 : 2.4;
        if (this.advance(dt, cruise, people, movers)) {
          this.speed = 0;
          this.phase = 'parked';
          this.timer = 0;
        }
        break;
      }
      case 'parked':
        this.timer += dt;
        if (!wanted && this.timer > 8) {
          this.phase = 'closing';
          this.timer = 2;
        }
        break;
      case 'closing':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.setPath(VAN_REVERSE_OUT, true);
          this.phase = 'reverseOut';
        }
        break;
      case 'reverseOut': {
        // Tahan di mulut gang (buritan belum masuk jalan) selama lajur timur sibuk.
        const hold = this.path.cum[1];
        const limit = this.s <= hold + 0.01 && eastLaneBusy(movers) ? hold - this.s : Infinity;
        if (this.advance(dt, 1.6, people, movers, limit)) {
          this.setPath(VAN_ROUTE_OUT, false);
          this.speed = 0;
          this.phase = 'leave';
        }
        break;
      }
      case 'leave':
        if (this.advance(dt, 7.5, people, movers)) {
          this.phase = 'away';
          this.cooldown = 15;
          this.speed = 0;
        }
        break;
    }
  }
}

/**
 * Zebra cross aman untuk mulai menyeberang: tidak ada kendaraan yang masih melaju mendekati zebra dalam jarak
 * ±14 m. Kendaraan yang sudah berhenti (memberi jalan) tidak menahan penyeberang — mencegah saling tunggu.
 */
export function crossingClear(movers: (Mover & { speed: number })[]) {
  const cx = (STREET.zebraX0 + STREET.zebraX1) / 2;
  return !movers.some((m) => {
    if (m.dir === 0 || m.speed < 1) return false;
    const ahead = (cx - m.x) * m.dir - m.half;
    return ahead > -3 && ahead < 14;
  });
}

/** Segmen dari `a` ke `b` mulai memasuki badan jalan (zona zebra) dari trotoar. */
export function entersRoad(a: Vec2, b: Vec2) {
  const inside = (z: number) => z > STREET.curbNear - 0.3 && z < STREET.curbFar + 0.3;
  return !inside(a[1]) && inside(b[1]);
}
