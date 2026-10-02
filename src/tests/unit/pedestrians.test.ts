import { describe, expect, it } from 'vitest';
import { buildColliders, pointInBoxes } from '@/game/world/collision';
import { HALTE, HOUSE_DOORS, STREET } from '@/game/world/district';
import { HALTE_SEATS, activityAt, buildPedGraph, planDestinations, shortestPath } from '@/game/npc/pedestrianPlan';

const g = buildPedGraph();

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('Rencana pejalan kaki', () => {
  it('setiap tujuan dapat dicapai dari setiap pintu rumah warga, dan rute bersambung', () => {
    const targets = g.nodes.filter((n) => n.kind && n.kind !== 'home');
    for (let i = 0; i < HOUSE_DOORS.length; i++) {
      for (const t of targets) {
        const path = shortestPath(g, `home${i}`, t.id);
        expect(path.length, `home${i} → ${t.id}`).toBeGreaterThan(1);
        for (let k = 1; k < path.length; k++) expect(g.adj.get(path[k - 1])!.some((e) => e.to === path[k])).toBe(true);
      }
    }
  });

  it('rute terpendek menyeberang lewat zebra cross untuk tujuan di seberang jalan', () => {
    const path = shortestPath(g, 'home0', 'halte');
    const pts = path.map((id) => g.byId.get(id)!.p);
    // Satu-satunya ruas yang melintasi badan jalan adalah zebra cross.
    for (let k = 1; k < pts.length; k++) {
      const [a, b] = [pts[k - 1], pts[k]];
      const crosses = (a[1] < STREET.roadNear && b[1] > STREET.roadFar) || (b[1] < STREET.roadNear && a[1] > STREET.roadFar);
      if (crosses) {
        expect(a[0]).toBeGreaterThan(STREET.zebraX0);
        expect(a[0]).toBeLessThan(STREET.zebraX1);
      }
    }
    expect(pts.some(([, z]) => z > STREET.roadFar)).toBe(true);
  });

  it('rencana berakhir di rumah atau halte dan tidak memakai kafe dua kali', () => {
    const rnd = lcg(42);
    for (let i = 0; i < 200; i++) {
      const plan = planDestinations(g, rnd);
      const last = plan[plan.length - 1];
      expect(last === 'halte' || last.startsWith('home')).toBe(true);
      expect(plan.filter((id) => id === 'cafe').length).toBeLessThanOrEqual(1);
      for (const id of plan) expect(g.byId.has(id), id).toBe(true);
    }
  });

  it('titik berdiri kegiatan tidak berada di dalam collider (kursi halte/kafe boleh di balik properti)', () => {
    const boxes = buildColliders({ doorsOpen: {}, unlockedRooms: [], upgrades: {}, vanParked: true, staffScooters: 5 });
    for (const n of g.nodes.filter((x) => x.kind && x.kind !== 'home')) {
      const a = activityAt(n);
      // Kegiatan duduk: titik pijak tepat di depan bangku/kursi (menempel tapak properti) → cek titiknya saja.
      expect(pointInBoxes(a.stand[0], a.stand[1], a.seat ? 0 : 0.2, boxes), `${n.id} ${a.stand}`).toBe(false);
    }
    for (const s of HALTE_SEATS) {
      expect(s[0]).toBeGreaterThan(HALTE.x0);
      expect(s[0]).toBeLessThan(HALTE.x1);
    }
  });
});
