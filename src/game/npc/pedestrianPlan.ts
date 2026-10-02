import { CAFE_SET, HALTE, pedestrianGraph, type PedNode } from '@/game/world/district';
import type { Vec2 } from '@/game/world/layout';

/**
 * Perencanaan pejalan kaki ambient (murni, diuji di pedestrians.test.ts): graf jalur dari district.ts,
 * rute terpendek (Dijkstra), dan rencana kegiatan — mampir ke kios, melihat etalase, duduk di kafe,
 * menunggu angkot di halte, lalu pulang ke rumah warga di gang belakang.
 */

export interface PedGraph {
  nodes: PedNode[];
  byId: Map<string, PedNode>;
  adj: Map<string, { to: string; w: number }[]>;
}

export function buildPedGraph(): PedGraph {
  const { nodes, edges } = pedestrianGraph();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, { to: string; w: number }[]>();
  for (const [a, b] of edges) {
    const pa = byId.get(a)!.p;
    const pb = byId.get(b)!.p;
    const w = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    adj.set(a, [...(adj.get(a) ?? []), { to: b, w }]);
    adj.set(b, [...(adj.get(b) ?? []), { to: a, w }]);
  }
  return { nodes, byId, adj };
}

/** Rute terpendek (daftar id simpul, termasuk awal & akhir); kosong bila tak terjangkau. */
export function shortestPath(g: PedGraph, from: string, to: string): string[] {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set([from]);
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const id of open) {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        cur = id;
      }
    }
    open.delete(cur);
    if (cur === to) break;
    for (const { to: nb, w } of g.adj.get(cur) ?? []) {
      const nd = best + w;
      if (nd < (dist.get(nb) ?? Infinity)) {
        dist.set(nb, nd);
        prev.set(nb, cur);
        open.add(nb);
      }
    }
  }
  if (!dist.has(to)) return [];
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

/** Simpul jalur (bukan simpul tujuan) terdekat dari sebuah titik. */
export function nearestWalkNode(g: PedGraph, p: Vec2): string {
  let best = '';
  let bd = Infinity;
  for (const n of g.nodes) {
    if (n.kind) continue;
    const d = Math.hypot(n.p[0] - p[0], n.p[1] - p[1]);
    if (d < bd) {
      bd = d;
      best = n.id;
    }
  }
  return best;
}

export type PedMode = 'idle' | 'talk' | 'sit';

/** Titik & pose kegiatan di simpul tujuan. `seat` = posisi duduk (panggul) bila duduk. */
export interface Activity {
  /** Titik berdiri/berjalan terakhir sebelum kegiatan. */
  stand: Vec2;
  face: number;
  mode: PedMode;
  seat?: Vec2;
  /** Rentang lama kegiatan (detik). */
  duration: [number, number];
}

/** Kursi bangku halte (pusat dudukan) — 3 tempat duduk. */
export const HALTE_SEATS: Vec2[] = [HALTE.x0 + 0.9, (HALTE.x0 + HALTE.x1) / 2, HALTE.x1 - 0.9].map((x) => [x, HALTE.z1 - 0.38] as Vec2);
/** Kursi teras kafe yang kosong (kursi lain ditempati pengunjung tetap). */
export const CAFE_SEAT: Vec2 = [CAFE_SET.x - 0.7, CAFE_SET.z];

export function activityAt(node: PedNode, seatIndex = 0): Activity {
  switch (node.kind) {
    case 'shop':
      return { stand: node.p, face: node.face ?? 0, mode: 'talk', duration: [6, 12] };
    case 'window':
      return { stand: node.p, face: node.face ?? 0, mode: 'idle', duration: [3, 6] };
    case 'cafe':
      return { stand: node.p, face: Math.PI / 2, mode: 'sit', seat: CAFE_SEAT, duration: [20, 40] };
    case 'halte': {
      const seat = HALTE_SEATS[seatIndex % HALTE_SEATS.length];
      return { stand: [seat[0], HALTE.z0 - 0.05], face: Math.PI, mode: 'sit', seat, duration: [35, 55] };
    }
    default:
      return { stand: node.p, face: node.face ?? 0, mode: 'idle', duration: [0, 0] };
  }
}

/**
 * Rencana kegiatan: 1–3 tujuan (kios, etalase, kafe) lalu berakhir di rumah warga atau halte (naik angkot).
 * `rnd` ∈ [0,1). `exclude` = tujuan yang sedang dipakai pejalan kaki lain (kafe).
 */
export function planDestinations(g: PedGraph, rnd: () => number, exclude: Set<string> = new Set()): string[] {
  const pick = (kind: PedNode['kind']) => {
    const list = g.nodes.filter((n) => n.kind === kind && !exclude.has(n.id));
    return list.length ? list[Math.floor(rnd() * list.length)].id : null;
  };
  const out: string[] = [];
  const stops = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < stops; i++) {
    const r = rnd();
    const id = r < 0.5 ? pick('shop') : r < 0.82 ? pick('window') : pick('cafe');
    if (id && out[out.length - 1] !== id && !(id === 'cafe' && out.includes('cafe'))) out.push(id);
  }
  out.push(rnd() < 0.35 ? 'halte' : (pick('home') ?? 'home0'));
  return out;
}
