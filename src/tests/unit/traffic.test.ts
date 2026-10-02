import { describe, expect, it } from 'vitest';
import { LOADING, STREET, TRAFFIC } from '@/game/world/district';
import { TRAFFIC_HALF, TrafficSim, VAN_HALF, VanSim, laneZ, type Mover, type Person } from '@/game/world/traffic';

const DT = 1 / 30;

/** Menjalankan simulasi lalu lintas `seconds` detik dengan daftar orang tetap. */
function run(sim: TrafficSim, seconds: number, people: Person[] = [], others: Mover[] = []) {
  for (let t = 0; t < seconds; t += DT) sim.step(DT, people, others);
}

function singleCar(kind: 'car' | 'angkot', dir: 1 | -1, x: number) {
  const sim = new TrafficSim([kind], 3, false);
  const c = sim.cars[0];
  Object.assign(c, { active: true, dir, x, speed: 7, dwell: 0, halteDone: true, respawn: 0 });
  return sim;
}

describe('Lalu lintas kawasan', () => {
  it('berhenti di garis henti saat ada orang di zebra cross, lalu jalan lagi', () => {
    const sim = singleCar('car', 1, -30);
    const walker: Person = { x: (STREET.zebraX0 + STREET.zebraX1) / 2, z: STREET.centerLine + 1.5 };
    run(sim, 8, [walker]);
    const c = sim.cars[0];
    const front = c.x + TRAFFIC_HALF.car;
    expect(c.speed).toBeLessThan(0.05);
    expect(front).toBeLessThanOrEqual(TRAFFIC.stopLineEast + 0.01);
    expect(front).toBeGreaterThan(TRAFFIC.stopLineEast - 1.5);
    run(sim, 3, []);
    expect(sim.cars[0].x).toBeGreaterThan(STREET.zebraX1);
  });

  it('berhenti sebelum menabrak orang yang berdiri di lajurnya', () => {
    const sim = singleCar('car', -1, 30);
    const person: Person = { x: 12, z: laneZ(-1) };
    run(sim, 10, [person]);
    const c = sim.cars[0];
    expect(c.x - TRAFFIC_HALF.car).toBeGreaterThan(person.x + 0.5);
  });

  it('menjaga jarak dengan kendaraan diam di depannya (tidak tumpang tindih)', () => {
    const sim = singleCar('car', 1, -40);
    const parked: Mover = { id: 'van', x: -10, z: laneZ(1), dir: 1, half: VAN_HALF };
    run(sim, 10, [], [parked]);
    const c = sim.cars[0];
    expect(c.x + TRAFFIC_HALF.car).toBeLessThan(parked.x - parked.half - 1);
  });

  it('angkot arah barat berhenti sejenak di halte lalu melanjutkan perjalanan', () => {
    const sim = singleCar('angkot', -1, 20);
    sim.cars[0].halteDone = false;
    let dwelt = false;
    for (let t = 0; t < 30; t += DT) {
      sim.step(DT, [], []);
      if (sim.halteDwelling) {
        dwelt = true;
        expect(Math.abs(sim.cars[0].x - TRAFFIC.halteStopX)).toBeLessThan(0.6);
      }
    }
    expect(dwelt).toBe(true);
    expect(sim.halteArrivals).toBe(1);
    expect(sim.cars[0].x < TRAFFIC.halteStopX - 20 || !sim.cars[0].active).toBe(true);
  });

  it('dua arah lajur tidak pernah tumpang tindih dalam simulasi panjang', () => {
    const sim = new TrafficSim(['car', 'car', 'car', 'angkot', 'angkot'], 11);
    for (let t = 0; t < 240; t += DT) {
      sim.step(DT, [], []);
      const act = sim.cars.filter((c) => c.active);
      for (let i = 0; i < act.length; i++)
        for (let j = i + 1; j < act.length; j++) {
          if (act[i].dir !== act[j].dir) continue;
          const gap = Math.abs(act[i].x - act[j].x) - TRAFFIC_HALF[act[i].kind] - TRAFFIC_HALF[act[j].kind];
          expect(gap).toBeGreaterThan(0.5);
        }
    }
  });
});

describe('Mobil boks PBF', () => {
  function runVan(van: VanSim, seconds: number, wanted: boolean, people: Person[] = [], movers: Mover[] = []) {
    for (let t = 0; t < seconds; t += DT) van.step(DT, wanted, people, movers);
  }

  it('datang saat ada kiriman, parkir di area bongkar muat, lalu pergi setelah kiriman diterima', () => {
    const van = new VanSim();
    runVan(van, 1, false);
    expect(van.visible).toBe(false);
    runVan(van, 60, true);
    expect(van.phase).toBe('parked');
    expect(van.parked).toBe(true);
    expect(Math.hypot(van.x - LOADING.vanPark.x, van.z - LOADING.vanPark.z)).toBeLessThan(0.05);
    // Moncong ke ujung gang (−Z): bak belakang menghadap mulut gang.
    expect(Math.abs(Math.abs(van.heading) - Math.PI)).toBeLessThan(0.1);
    runVan(van, 80, false);
    expect(van.visible).toBe(false);
  });

  it('menunggu lajur timur kosong sebelum mundur ke jalan (tanpa kebuntuan)', () => {
    const van = new VanSim();
    runVan(van, 60, true);
    expect(van.parked).toBe(true);
    const car: Mover = { id: 'traffic-0', x: -25, z: STREET.laneEast, dir: 1, half: 2.1 };
    runVan(van, 40, false, [], [car]);
    expect(van.phase).toBe('reverseOut');
    // Buritan belum masuk jalan.
    expect(van.z).toBeLessThan(12.5);
    runVan(van, 60, false, [], []);
    expect(van.visible).toBe(false);
  });

  it('berhenti bila ada orang di jalurnya di dalam gang', () => {
    const van = new VanSim();
    const person: Person = { x: -14.6, z: 4 };
    runVan(van, 60, true, [person]);
    expect(van.phase).toBe('arrive');
    expect(van.z - VAN_HALF).toBeGreaterThan(person.z + 0.3);
    runVan(van, 30, true, []);
    expect(van.phase).toBe('parked');
  });
});
