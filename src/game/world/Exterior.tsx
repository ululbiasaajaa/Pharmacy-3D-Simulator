import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GeoBuilder, floorQuad } from '@/game/visual/geometry';
import { BuiltMeshes } from '@/game/visual/Built';
import { LightHalo } from '@/game/visual/LightHalo';
import { daylight } from '@/game/visual/daylight';
import { useVisualProfile } from '@/game/visual/quality';
import { MAT, type MatKey } from './materials';
import { drawLeafAtlas, ketapangTree, scooterModel } from './streetModels';
import { Prop } from './SetDressing';
import { CanvasPlane } from './posters';
import { SignAtlas, type SignDef } from './SignAtlas';
import { alleyWalls, goodsAtlasTexture, shopModel, shopSign } from './shopModels';
import { DeliveryVan, StaffScooters, Traffic, VehicleShowroom, showroomEnabled } from './DistrictVehicles';
import { Interactable } from '@/game/objects/Interactable';
import { Pedestrians } from '@/game/npc/Pedestrians';
import { vehicles } from '@/game/npc/crowd';
import { TIME } from '@/domain/config';
import {
  BACKDROP_SHOPS,
  BACK_PIPES,
  BINS,
  CAFE_SET,
  CLOTHESLINE_Z,
  CLOTHESLINES,
  GATE_PILLAR_Z,
  GATES,
  HALTE,
  HOUSE_DOORS,
  LOADING,
  PALLET,
  PARKED_SCOOTERS,
  PARKING_BAYS,
  POLE_Z,
  POWER_POLES,
  SHOPS,
  STAFF_PARKING,
  STREET,
  STREET_LAMPS,
  TREES,
  type Gate,
} from './district';

/**
 * Kawasan di sekitar apotek (PROJECT_STATUS.md "World building"): deret ruko bervariasi, kios terbuka dengan
 * meja di garis muka (jelas dilayani dari depan, tidak dimasuki), toko tutup ber-rolling door, jalan + zebra cross,
 * trotoar, gang samping & gang belakang, area bongkar muat, gerbang kawasan, dan latar di luar gerbang.
 * Geometri statis digabung per material; posisi & collider dari district.ts (satu sumber kebenaran).
 */
type B = GeoBuilder<MatKey>;

/** Panjang jalan yang dirender (melewati gerbang sebagai latar). */
const ROAD_X = 70;

/** Lantai atas apotek dilihat dari gang: jendela di sisi samping & belakang (lantai atas bukan area permainan). */
function pharmacyUpperWindows(b: B) {
  const y = 5.3;
  for (const side of [-1, 1]) {
    const x = side * 12.1;
    for (const z of [6.5, 0.5, -5.5, -11.5, -16]) {
      b.box('aluminum', 0.06, 1.3, 1.5, x + side * 0.02, y, z, { r: 0.004 });
      b.box(Math.round(z) % 2 === 0 ? 'windowLit' : 'glassDark', 0.02, 1.2, 1.4, x + side * 0.05, y, z, { r: 0 });
      b.box('facade', 0.16, 0.07, 1.65, x + side * 0.07, y - 0.7, z, { r: 0.006 });
    }
  }
  for (const x of [-9, -3, 3, 9]) {
    b.box('aluminum', 1.5, 1.3, 0.06, x, y, STREET.backLaneNear - 0.02, { r: 0.004 });
    b.box(x === 3 ? 'windowLit' : 'glassDark', 1.4, 1.2, 0.02, x, y, STREET.backLaneNear - 0.05, { r: 0 });
    b.box('facade', 1.65, 0.07, 0.16, x, y - 0.7, STREET.backLaneNear - 0.07, { r: 0.006 });
  }
}

// ------------------------------------------------------------------ Gerbang kawasan

function gateModel(b: B, g: Gate) {
  const x = g.x;
  for (const z of GATE_PILLAR_Z) {
    b.box('facade', 0.7, 5.6, 0.7, x, 2.8, z, { r: 0.02 });
    b.box('stone', 0.8, 0.5, 0.8, x, 0.25, z, { r: 0.02 });
    b.box('facadeAccent', 0.8, 0.2, 0.8, x, 5.7, z, { r: 0.02 });
    // Rumah mesin portal (di sisi luar gerbang; lengan portal di GateBooms).
    const hx = x - g.inward * 0.6;
    b.box('white', 0.3, 1.1, 0.36, hx, 0.55, z, { r: 0.02 });
    b.box('awningRed', 0.32, 0.12, 0.38, hx, 0.98, z, { r: 0.01 });
  }
  // Balok gapura di atas jalan (papan nama kawasan di SignAtlas).
  b.box('facadeAccent', 0.5, 1.0, GATE_PILLAR_Z[1] - GATE_PILLAR_Z[0] + 0.7, x, 5.25, (GATE_PILLAR_Z[0] + GATE_PILLAR_Z[1]) / 2, { r: 0.02 });
  // Pagar besi trotoar (dari muka ruko ke tiang).
  const fence = (z0: number, z1: number) => {
    for (let z = z0; z <= z1 + 1e-6; z += 0.4) b.box('metalDark', 0.04, 1.5, 0.04, x, 0.75, z, { r: 0 });
    for (const y of [0.15, 1.45]) b.box('metalDark', 0.05, 0.05, z1 - z0, x, y, (z0 + z1) / 2, { r: 0 });
  };
  fence(STREET.frontZ + 0.1, GATE_PILLAR_Z[0] - 0.4);
  fence(GATE_PILLAR_Z[1] + 0.4, STREET.farFrontZ - 0.1);
  // Pos satpam.
  const bb = g.booth;
  const bx = (bb.minX + bb.maxX) / 2;
  const bz = (bb.minZ + bb.maxZ) / 2;
  const bw = bb.maxX - bb.minX;
  const bd = bb.maxZ - bb.minZ;
  b.box('white', bw, 1.0, bd, bx, 0.5, bz, { r: 0.02 });
  b.box('glass', bw - 0.1, 1.0, bd - 0.1, bx, 1.5, bz, { r: 0 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('white', 0.08, 1.0, 0.08, bx + sx * (bw / 2 - 0.04), 1.5, bz + sz * (bd / 2 - 0.04), { r: 0 });
  b.box('facadeAccent', bw + 0.3, 0.16, bd + 0.3, bx, 2.08, bz, { r: 0.02 });
}

// ------------------------------------------------------------------ Jalan, trotoar, gang

function roadModel(b: B) {
  // Tanah dasar luas (latar).
  b.add('ground', floorQuad(-110, 110, -70, 90, -0.02));
  // Halaman/parkir deret ruko apotek & lanjutannya di luar gerbang, jalan, trotoar seberang.
  b.add('sidewalk', floorQuad(-ROAD_X, ROAD_X, STREET.frontZ, STREET.curbNear));
  b.add('road', floorQuad(-ROAD_X, ROAD_X, STREET.roadNear, STREET.roadFar));
  b.add('sidewalk', floorQuad(-ROAD_X, ROAD_X, STREET.curbFar, STREET.farFrontZ));
  // Ubin pemandu kuning di trotoar seberang (di luar jalur perabot & halte).
  b.add('tactile', floorQuad(-ROAD_X, ROAD_X, 23.95, 24.25, 0.004));
  // Gang samping & gang belakang (beton).
  for (const [x0, x1] of [
    [-STREET.alleyOuter, -STREET.alleyInner],
    [STREET.alleyInner, STREET.alleyOuter],
  ])
    b.add('concrete', floorQuad(x0, x1, STREET.backLaneNear, STREET.frontZ, 0.002));
  b.add('concrete', floorQuad(-STREET.alleyOuter, STREET.alleyOuter, STREET.backLaneFar, STREET.backLaneNear, 0.002));
  // Kanstin hitam-putih; mulut gang tanpa kanstin (akses kendaraan).
  const gap = (x: number) => Math.abs(x) > STREET.alleyInner - 0.2 && Math.abs(x) < STREET.alleyOuter + 0.2;
  for (let x = -ROAD_X; x < ROAD_X; x += 0.5) {
    const m: MatKey = Math.round((x + ROAD_X) / 0.5) % 2 === 0 ? 'curbWhite' : 'curbBlack';
    if (!gap(x + 0.25)) b.box(m, 0.5, 0.15, 0.2, x + 0.25, 0.075, STREET.curbNear + 0.1, { r: 0 });
    b.box(m, 0.5, 0.15, 0.2, x + 0.25, 0.075, STREET.curbFar - 0.1, { r: 0 });
  }
  // Marka: garis tepi, garis tengah putus-putus (terputus di zebra cross), zebra cross, garis henti.
  for (const z of [STREET.roadNear + 0.35, STREET.roadFar - 0.35]) b.box('roadPaint', ROAD_X * 2, 0.004, 0.1, 0, 0.002, z, { r: 0 });
  for (let x = -ROAD_X + 1; x < ROAD_X; x += 5) {
    if (x + 1.2 > STREET.zebraX0 - 2 && x - 1.2 < STREET.zebraX1 + 2) continue;
    b.box('roadPaint', 2.4, 0.004, 0.12, x, 0.002, STREET.centerLine, { r: 0 });
  }
  for (let z = STREET.roadNear + 0.55; z < STREET.roadFar - 0.3; z += 1.0) b.box('roadPaint', STREET.zebraX1 - STREET.zebraX0, 0.005, 0.5, (STREET.zebraX0 + STREET.zebraX1) / 2, 0.0025, z, { r: 0 });
  b.box('roadPaint', 0.3, 0.005, STREET.centerLine - STREET.roadNear - 0.4, STREET.zebraX0 - 1.6, 0.0025, (STREET.roadNear + STREET.centerLine) / 2, { r: 0 });
  b.box('roadPaint', 0.3, 0.005, STREET.roadFar - STREET.centerLine - 0.4, STREET.zebraX1 + 1.6, 0.0025, (STREET.centerLine + STREET.roadFar) / 2, { r: 0 });
  // Garis petak parkir motor (garis bersama antar-petak tidak digandakan).
  const bayLines = new Set<string>();
  for (const [x, z] of PARKING_BAYS) for (const sx of [-1, 1]) bayLines.add(`${(x + sx * 0.45).toFixed(2)},${z}`);
  for (const key of bayLines) {
    const [x, z] = key.split(',').map(Number);
    b.box('roadPaint', 0.06, 0.004, 1.9, x, 0.004, z, { r: 0 });
  }
  // Area bongkar muat: bingkai & arsir kuning.
  const L = LOADING.zone;
  b.box('paintYellow', L.maxX - L.minX, 0.004, 0.1, (L.minX + L.maxX) / 2, 0.005, L.minZ, { r: 0 });
  b.box('paintYellow', L.maxX - L.minX, 0.004, 0.1, (L.minX + L.maxX) / 2, 0.005, L.maxZ, { r: 0 });
  b.box('paintYellow', 0.1, 0.004, L.maxZ - L.minZ, L.minX, 0.005, (L.minZ + L.maxZ) / 2, { r: 0 });
  for (let z = L.minZ + 0.8; z < L.maxZ - 0.3; z += 1.2) b.box('paintYellow', 0.9, 0.004, 0.1, L.minX + 0.45, 0.005, z, { r: 0, rotY: 0.6 });
  // Garis parkir motor karyawan (gang kanan).
  const staffLines = new Set<number>();
  for (const [, z] of STAFF_PARKING) for (const sz of [-0.5, 0.5]) staffLines.add(Number((z + sz).toFixed(2)));
  for (const z of staffLines) b.box('roadPaint', 1.9, 0.004, 0.05, STAFF_PARKING[0][0], 0.004, z, { r: 0 });
}

/** Area bongkar muat: kanopi seng di atas pintu gudang, lampu dinding, palet & kardus. */
function loadingDockModel(b: B) {
  const d = LOADING.door;
  b.box('zinc', 1.1, 0.05, d.width + 0.9, d.x - 0.12 - 0.55, 2.62, d.z, { r: 0.004, rotZ: 0.08 });
  for (const sz of [-1, 1]) b.box('metalDark', 0.9, 0.04, 0.04, d.x - 0.55, 2.42, d.z + sz * (d.width / 2 + 0.3), { rotZ: -0.4, r: 0 });
  b.box('metalDark', 0.12, 0.1, 0.24, d.x - 0.18, 2.42, LOADING.panel.z, { r: 0.02 });
  b.box('lampGlow', 0.08, 0.02, 0.2, d.x - 0.2, 2.365, LOADING.panel.z, { r: 0 });
  // Palet kayu (papan atas + kaki) dengan dua kardus.
  const P = PALLET;
  const pcx = (P.minX + P.maxX) / 2;
  const pcz = (P.minZ + P.maxZ) / 2;
  for (let k = 0; k < 5; k++) b.box('wood', P.maxX - P.minX, 0.022, 0.13, pcx, 0.131, P.minZ + 0.07 + k * ((P.maxZ - P.minZ - 0.14) / 4), { r: 0.003 });
  for (const sx of [-1, 0, 1]) b.box('wood', 0.1, 0.12, P.maxZ - P.minZ, pcx + sx * ((P.maxX - P.minX) / 2 - 0.05), 0.06, pcz, { r: 0.003 });
  b.box('cardboard', 0.55, 0.38, 0.45, pcx, 0.33, pcz - 0.3, { r: 0.008, rotY: 0.05 });
  b.box('cardboard', 0.5, 0.32, 0.42, pcx, 0.3, pcz + 0.28, { r: 0.008, rotY: -0.08 });
  b.box('tape', 0.54, 0.004, 0.06, pcx, 0.522, pcz - 0.3, { r: 0, rotY: 0.05 });
}

/** Gang belakang: punggung apotek (plester, pipa), tembok & rumah warga, jemuran, tong sampah. */
function backLaneModel(b: B) {
  const z = STREET.backLaneFar;
  // Kulit luar dinding belakang apotek + pipa air hujan.
  b.box('facade', 24.2, 3.32, 0.02, 0, 1.66, STREET.backLaneNear - 0.01, { r: 0 });
  for (const x of BACK_PIPES) b.cylinder('plasticWhite', 0.055, 0.055, 7.0, x, 3.5, STREET.backLaneNear - 0.07, { seg: 10 });
  // Tembok rumah warga (punggung) dengan pintu & jendela berteralis.
  b.box('houseWall', STREET.alleyOuter * 2, 2.7, 0.3, 0, 1.35, z - 0.15, { r: 0 });
  b.box('stone', STREET.alleyOuter * 2, 0.3, 0.32, 0, 0.15, z - 0.14, { r: 0 });
  for (const x of HOUSE_DOORS) {
    b.box('woodDark', 0.9, 2.0, 0.06, x, 1.0, z + 0.02, { r: 0.006 });
    b.box('aluminum', 0.05, 0.02, 0.05, x + 0.33, 1.0, z + 0.07, { r: 0 });
    b.box('stone', 1.2, 0.05, 0.4, x, 0.025, z + 0.2, { r: 0.01 });
  }
  for (const x of [-13.5, -5, 5.5, 13.5]) {
    b.box('aluminum', 1.1, 0.8, 0.05, x, 1.65, z + 0.01, { r: 0.004 });
    b.box('glassDark', 1.0, 0.7, 0.02, x, 1.65, z + 0.03, { r: 0 });
    for (let t = -2; t <= 2; t++) b.box('metalDark', 0.016, 0.7, 0.016, x + t * 0.2, 1.65, z + 0.07, { r: 0 });
  }
  // Rumah warga di balik tembok (atap pelana genteng & seng), juga di belakang ruko pengapit gang.
  const houses = 7;
  const span = 47.8 / houses;
  for (let k = 0; k < houses; k++) {
    const cx = -23.9 + span * (k + 0.5);
    const h = 3.2 + (k % 2) * 0.6;
    b.box(k % 2 ? 'houseWall' : 'facadeA', span - 0.15, h, 7, cx, h / 2, z - 3.8, { r: 0 });
    for (const sx of [-1, 1]) b.box(k % 3 === 1 ? 'zinc' : 'roofTile', span + 0.6, 0.07, 4.2, cx, h + 0.85, z - 3.8 + sx * 1.85, { rotX: sx * 0.45, r: 0 });
  }
  // Jemuran: dua tiang + tali dengan pakaian.
  const clothes: MatKey[] = ['awningRed', 'awningBlue', 'white', 'paintYellow'];
  for (const x of CLOTHESLINES) {
    for (const sx of [-1, 1]) b.box('metalDark', 0.04, 2.1, 0.04, x + sx * 1.6, 1.05, CLOTHESLINE_Z, { r: 0 });
    b.box('black', 3.2, 0.01, 0.01, x, 2.0, CLOTHESLINE_Z, { r: 0 });
    for (let k = 0; k < 4; k++) b.box(clothes[k], 0.45, 0.6, 0.01, x - 1.1 + k * 0.72, 1.68, CLOTHESLINE_Z, { r: 0 });
  }
  // Tong sampah plastik bertutup.
  BINS.forEach(([x, bz], k) => {
    b.cylinder(k ? 'tankBlue' : 'awningGreen', 0.27, 0.24, 0.85, x, 0.425, bz, { seg: 16 });
    b.cylinder('black', 0.29, 0.29, 0.05, x, 0.875, bz, { seg: 16 });
  });
}

/** Latar di luar gerbang: jalan berlanjut dengan deretan bangunan sederhana & pohon (tanpa collider). */
function backdropModel(b: B, full: boolean) {
  // Ruko latar bergaya sama dengan kawasan (tertutup, tanpa interior), indeks bergeser agar AC/toren bervariasi.
  BACKDROP_SHOPS.forEach((s, i) => shopModel(b, s, i + 1, 1));
  for (const side of [-1, 1]) if (full) for (const x of [side * 46, side * 58]) ketapangTree(b, x, STREET.nearFurnitureZ, Math.abs(x), 1);
}

// ------------------------------------------------------------------ Properti jalan

/** Lampu jalan; `facing` = arah lengan (+1 ke +Z). Kepala lampu menjorok ke atas jalan. */
function streetLamp(b: B, x: number, z: number, facing: 1 | -1) {
  b.cylinder('metalDark', 0.07, 0.1, 6.2, x, 3.1, z, { seg: 12 });
  b.cylinder('concrete', 0.18, 0.2, 0.4, x, 0.2, z, { seg: 12 });
  b.box('metalDark', 0.08, 0.08, 1.4, x, 6.1, z + facing * 0.65, { rotX: -facing * 0.12, r: 0.02 });
  b.box('metalDark', 0.32, 0.12, 0.6, x, 6.0, z + facing * 1.3, { r: 0.03 });
  b.box('lampGlow', 0.26, 0.03, 0.5, x, 5.93, z + facing * 1.3, { r: 0 });
}

function powerPole(b: B, x: number, z: number) {
  b.cylinder('concrete', 0.12, 0.17, 9, x, 4.5, z, { seg: 10 });
  b.box('metalDark', 1.8, 0.1, 0.1, x, 8.4, z, { r: 0 });
  for (const dx of [-0.8, 0, 0.8]) b.cylinder('white', 0.04, 0.05, 0.12, x + dx, 8.52, z, { seg: 8 });
}

/** Kabel listrik melendut di antara dua tiang (beberapa segmen lurus). */
function cable(b: B, x0: number, x1: number, y: number, z: number, sag: number) {
  const segs = 6;
  let prev = new THREE.Vector3(x0, y, z);
  for (let k = 1; k <= segs; k++) {
    const t = k / segs;
    const p = new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(Math.PI * t) * sag, z);
    const mid = prev.clone().add(p).multiplyScalar(0.5);
    const len = prev.distanceTo(p);
    const ang = Math.atan2(p.y - prev.y, p.x - prev.x);
    b.cylinder('black', 0.012, 0.012, len, mid.x, mid.y, mid.z, { rotZ: ang - Math.PI / 2, seg: 4 });
    prev = p;
  }
}

/** Halte angkot: tiang, atap seng, panel kaca belakang, bangku, papan nama. */
function halteModel(b: B) {
  const { x0, x1, z0, z1 } = HALTE;
  const cx = (x0 + x1) / 2;
  for (const x of [x0 + 0.1, x1 - 0.1]) {
    b.box('metalDark', 0.08, 2.6, 0.08, x, 1.3, z1 - 0.1, { r: 0 });
    b.box('metalDark', 0.08, 2.55, 0.08, x, 1.275, z0 + 0.06, { r: 0 });
  }
  b.box('zinc', x1 - x0 + 0.4, 0.06, z1 - z0 + 0.75, cx, 2.6, (z0 + z1) / 2 - 0.3, { rotX: 0.06, r: 0.004 });
  b.box('glass', x1 - x0 - 0.3, 1.6, 0.02, cx, 1.3, z1 - 0.08, { r: 0 });
  b.box('steel', x1 - x0 - 0.6, 0.06, 0.45, cx, 0.46, z1 - 0.38, { r: 0.01 });
  for (const x of [x0 + 0.6, cx, x1 - 0.6]) b.box('metalDark', 0.05, 0.44, 0.3, x, 0.22, z1 - 0.38, { r: 0 });
  b.box('metalDark', 1.7, 0.42, 0.04, cx, 2.86, 23.74, { r: 0.01 });
}

function buildDistrict(full: boolean) {
  const b = new GeoBuilder<MatKey>();
  // Geometri latar: tepi membulat < 3 cm (kusen, ambang, pilaster) tak terlihat dari jarak pandang kawasan,
  // padahal RoundedBox ±50–300 segitiga per kotak → kotak biasa (12 segitiga). Motor parkir tetap membulat.
  const rawBox = b.box.bind(b);
  let flat = true;
  b.box = ((mat, w, h, d, x, y, z, o = {}) => rawBox(mat, w, h, d, x, y, z, flat && (o.r ?? 0.01) < 0.03 ? { ...o, r: 0 } : o)) as typeof b.box;
  roadModel(b);
  SHOPS.forEach((s, i) => shopModel(b, s, i));
  alleyWalls(b);
  pharmacyUpperWindows(b);
  for (const g of GATES) gateModel(b, g);
  loadingDockModel(b);
  backLaneModel(b);
  backdropModel(b, full);
  for (const [x, z, facing] of STREET_LAMPS) streetLamp(b, x, z, facing);
  for (const [x, z, seed, scale] of TREES) ketapangTree(b, x, z, seed, scale);
  POWER_POLES.forEach((x) => powerPole(b, x, POLE_Z));
  for (let k = 0; k < POWER_POLES.length - 1; k++) for (const dx of [-0.8, 0, 0.8]) cable(b, POWER_POLES[k] + dx, POWER_POLES[k + 1] + dx, 8.55, POLE_Z, 0.45);
  halteModel(b);
  flat = false;
  for (const [i, color] of PARKED_SCOOTERS) {
    const [x, z] = PARKING_BAYS[i];
    scooterModel(b, x, z, Math.PI + ((i * 37) % 7) * 0.02 - 0.06, color);
  }
  return b.build();
}

/**
 * Material luar ruangan: pantulan IBL (yang dibuat untuk interior) diredam saat malam
 * agar fasad & jalan gelap, sementara interior tetap terang oleh lampunya sendiri.
 */
const OUTDOOR: MatKey[] = ['facade', 'facadeA', 'facadeB', 'facadeC', 'facadeD', 'facadeAccent', 'sidewalk', 'road', 'concrete', 'ground', 'curbWhite', 'curbBlack', 'roadPaint', 'terrace', 'stone', 'shutter', 'awningRed', 'awningBlue', 'awningGreen', 'glassDark', 'trunk', 'treeLeaf', 'treeLeafLight', 'leafCard', 'tactile', 'tire', 'bikeRed', 'bikeBlack', 'bikeWhite', 'bikeBlue', 'roofTile', 'zinc', 'tankBlue', 'tankOrange', 'paintYellow', 'houseWall', 'kioskWall', 'carPaint', 'vanPaint', 'carGlass', 'carTrim', 'tireRubber', 'rimAlloy', 'brickWall', 'stoneClad', 'zincSheet', 'woodPlank', 'ceramicWall'];

/**
 * Urutan gambar kawasan: permukaan latar besar (tanah, jalan, trotoar, lantai gang, dinding fasad) digambar
 * setelah detail di depannya, tanah paling akhir — fragmen yang tertutup ditolak uji kedalaman sebelum
 * di-shade. Diukur di Iris Xe (A/B dalam satu halaman, 10 pengukuran): hemat 0,05–0,7 ms per frame.
 */
const LATE_DRAW: Partial<Record<MatKey, number>> = { ground: 2, road: 1, sidewalk: 1, concrete: 1, facade: 1, facadeA: 1, facadeB: 1, facadeC: 1, facadeD: 1 };

/** Pengali pantulan lingkungan per material luar (kaca & cat kendaraan lebih memantul). */
const ENV_BOOST: Partial<Record<MatKey, number>> = { carGlass: 2.4, carPaint: 1.35, vanPaint: 1.2, rimAlloy: 1.4 };

/** Intensitas emisif mengikuti siang/malam: jendela, lampu jalan, downlight kanopi, tanda plus, lampu kios. */
function NightMaterials() {
  useFrame(({ scene }) => {
    const n = THREE.MathUtils.smoothstep(daylight.current.night, 0.15, 0.85);
    const env = (1 - n * 0.88) * 0.85;
    // envMapIntensity material hanya berlaku bila envMap dipasang langsung (bukan lewat scene.environment).
    const tex = scene.environment;
    for (const k of OUTDOOR) {
      const m = MAT[k] as THREE.MeshStandardMaterial;
      if (m.envMap !== tex) {
        m.envMap = tex;
        m.needsUpdate = true;
      }
      m.envMapIntensity = env * (ENV_BOOST[k] ?? 1);
    }
    MAT.windowLit.emissiveIntensity = 0.04 + n * 1.2;
    MAT.lampGlow.emissiveIntensity = 0.1 + n * 2.6;
    MAT.emissiveWarm.emissiveIntensity = 0.6 + n * 1.4;
    MAT.signGreen.emissiveIntensity = 0.9 + n * 0.9;
    (MAT.kioskLight as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + n * 1.2;
    // Lampu kendaraan menyala saat gelap (lampu depan & belakang).
    MAT.carLamp.emissiveIntensity = 0.12 + n * 2.4;
    MAT.ledRed.emissiveIntensity = 0.6 + n * 1.2;
  });
  return null;
}

/** Kepala lampu jalan (posisi halo & genangan cahaya). */
const LAMPS: [number, number, number][] = STREET_LAMPS.map(([x, z, f]) => [x, 5.9, z + f * 1.3]);

/** Papan nama statis kawasan (satu atlas, satu draw call). */
const DISTRICT_SIGNS: SignDef[] = [
  ...[...SHOPS, ...BACKDROP_SHOPS].map<SignDef>((s) => {
    const p = shopSign(s);
    return {
      text: s.name,
      sub: s.tagline,
      // Ruko latar (di luar gerbang, selalu jauh) cukup setengah resolusi.
      density: s.id.startsWith('BG') ? 0.5 : 1,
      width: p.width,
      height: p.height,
      background: s.sign,
      position: [(s.x0 + s.x1) / 2, p.y, p.z],
      rotationY: s.facing === 1 ? 0 : Math.PI,
    };
  }),
  ...GATES.flatMap<SignDef>((g) => [
    { text: 'KAWASAN RUKO MELATI', width: 6.2, height: 0.7, background: '#0e655b', position: [g.x + g.inward * 0.26, 5.25, 18.5], rotationY: g.inward * (Math.PI / 2) },
    { text: 'KAWASAN RUKO MELATI', width: 6.2, height: 0.7, background: '#0e655b', position: [g.x - g.inward * 0.26, 5.25, 18.5], rotationY: -g.inward * (Math.PI / 2) },
    { text: 'POS SATPAM', width: 1.2, height: 0.22, background: '#1e3a8a', position: [(g.booth.minX + g.booth.maxX) / 2, 1.86, g.booth.maxZ + 0.012] },
  ]),
  { text: 'HALTE', width: 1.6, height: 0.36, background: '#1d4ed8', position: [(HALTE.x0 + HALTE.x1) / 2, 2.86, 23.715], rotationY: Math.PI },
  { text: 'GANG MELATI I', width: 1.6, height: 0.3, background: '#14532d', position: [-STREET.alleyOuter + 0.02, 2.6, 8.6], rotationY: Math.PI / 2 },
  { text: 'GANG MELATI II', width: 1.6, height: 0.3, background: '#14532d', position: [STREET.alleyOuter - 0.02, 2.6, 8.6], rotationY: -Math.PI / 2 },
  { text: 'AREA BONGKAR MUAT', width: 2.2, height: 0.34, background: '#b45309', position: [-STREET.alleyOuter + 0.02, 2.5, -3.6], rotationY: Math.PI / 2 },
  { text: 'PARKIR KARYAWAN', width: 2.0, height: 0.32, background: '#1e3a8a', position: [STREET.alleyOuter - 0.02, 2.4, -3.5], rotationY: -Math.PI / 2 },
];

/** Tulisan kapur di papan berdiri teras apotek (jam buka dari konfigurasi permainan). */
function drawChalkboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const open = String(Math.floor(TIME.openMinute / 60)).padStart(2, '0');
  const close = String(Math.floor(TIME.closeMinute / 60)).padStart(2, '0');
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(245,245,240,0.92)';
  ctx.font = '800 ' + Math.round(h * 0.095) + 'px "Segoe Print", "Comic Sans MS", cursive';
  ctx.fillText('APOTEK BUKA', w / 2, h * 0.2);
  ctx.font = '600 ' + Math.round(h * 0.066) + 'px "Segoe Print", "Comic Sans MS", cursive';
  ctx.fillText('Setiap hari', w / 2, h * 0.38);
  ctx.fillText(open + '.00 – ' + close + '.00', w / 2, h * 0.52);
  ctx.fillStyle = 'rgba(134,239,172,0.9)';
  ctx.fillText('Melayani resep dokter', w / 2, h * 0.72);
  ctx.strokeStyle = 'rgba(245,245,240,0.6)';
  ctx.lineWidth = h * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.84);
  ctx.lineTo(w * 0.8, h * 0.84);
  ctx.stroke();
}

/** Papan prosedur penerimaan barang di dinding samping pintu bongkar muat. */
const RECEIVING_STEPS = ['1. Cocokkan faktur & surat pesanan', '2. Cek nama, jumlah, bentuk sediaan', '3. Catat no. batch & kedaluwarsa', '4. Cek kemasan & suhu produk dingin'];
function drawReceivingBoard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0f3d36';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, w, h * 0.22);
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(h * 0.11)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText('PENERIMAAN BARANG', w / 2, h * 0.115);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e5f6f2';
  let size = Math.round(h * 0.075);
  const font = (px: number) => `600 ${px}px "Segoe UI", system-ui, sans-serif`;
  ctx.font = font(size);
  const longest = RECEIVING_STEPS.reduce((a, s) => (s.length > a.length ? s : a));
  while (ctx.measureText(longest).width > w * 0.88 && size > 8) ctx.font = font((size -= 1));
  RECEIVING_STEPS.forEach((t, i) => ctx.fillText(t, w * 0.06, h * (0.36 + i * 0.165)));
}

/** Papan "Penerimaan Barang" (dapat diinteraksikan) di sisi gang pintu bongkar muat. */
function LoadingPanel() {
  const { x, z } = LOADING.panel;
  return (
    <Interactable id="loading-dock" position={[x - 0.03, 0, z]}>
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[0.04, 0.86, 1.06]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>
      <CanvasPlane draw={drawReceivingBoard} width={1.0} height={0.8} px={420} position={[-0.025, 1.45, 0]} rotation={[0, -Math.PI / 2, 0]} />
    </Interactable>
  );
}

const APOTEK_AC = [
  { x: 8, y: 3.95, z: 10.33, rot: 0 },
  { x: -6, y: 2.2, z: STREET.backLaneNear - 0.22, rot: Math.PI },
  { x: 6.5, y: 2.2, z: STREET.backLaneNear - 0.22, rot: Math.PI },
];

/** Properti CC0 di luar: unit AC apotek, papan kapur teras apotek, panel listrik di mulut gang, meja-kursi kafe. */
function ExteriorProps() {
  return (
    <group name="exterior-props">
      {/* Unit AC apotek (dekat pemain): model GLB detail; AC ruko latar ada di mesh kawasan (shopAcUnit). */}
      {APOTEK_AC.map((a) => (
        <Prop key={`${a.x},${a.z}`} name="ac_outdoor" position={[a.x, a.y, a.z]} rotation={a.rot} />
      ))}
      <group position={[-3.2, 0, 11.4]}>
        <Prop name="chalkboard" position={[0, 0, 0]} />
        {/* Bidang tulisan mengikuti kemiringan papan bingkai-A (±12°), sedikit di depan permukaan. */}
        <CanvasPlane draw={drawChalkboard} width={0.58} height={0.8} px={500} position={[0, 0.9, 0.205]} rotation={[-0.21, 0, 0]} transparent />
      </group>
      <Prop name="utility_box" position={[-17.3, 0, 10.32]} rotation={0} />
      <Prop name="cafe_set" position={[CAFE_SET.x, 0, CAFE_SET.z]} rotation={Math.PI / 2} />
    </group>
  );
}

/** Lengan portal gerbang (satu per lajur): terangkat saat kendaraan mendekat di lajurnya. */
const BOOM_LEN = 3.7;
const BOOMS = GATES.flatMap((g) => GATE_PILLAR_Z.map((z, k) => ({ gateX: g.x, x: g.x - g.inward * 0.6, z, dir: k === 0 ? 1 : -1 })));

function GateBooms() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const lift = useRef(BOOMS.map(() => 0));
  const { geometry, material } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? '#f8fafc' : '#dc2626';
      ctx.fillRect(0, k * 8, 4, 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Silinder rebah sepanjang +Z lokal, berporos di rumah mesin.
    const geo = new THREE.CylinderGeometry(0.045, 0.045, BOOM_LEN, 10).rotateX(Math.PI / 2).translate(0, 0, BOOM_LEN / 2 + 0.18);
    return { geometry: geo, material: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }) };
  }, []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    BOOMS.forEach((bm, i) => {
      let near = false;
      for (const v of vehicles.values()) {
        const inLane = bm.dir > 0 ? v.z < STREET.centerLine : v.z >= STREET.centerLine;
        if (inLane && Math.abs(v.x - bm.gateX) < 14) {
          near = true;
          break;
        }
      }
      lift.current[i] = THREE.MathUtils.damp(lift.current[i], near ? 1 : 0, 3, dt);
      // Lajur dekat: lengan ke +Z; lajur seberang: diputar π. Mengangkat = memutar ujung lengan ke atas.
      refs.current[i]?.rotation.set(-bm.dir * lift.current[i] * 1.45, bm.dir > 0 ? 0 : Math.PI, 0);
    });
  });
  return (
    <group name="gate-booms">
      {BOOMS.map((bm, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[bm.x, 1.0, bm.z]}
        >
          <mesh geometry={geometry} material={material} castShadow />
        </group>
      ))}
    </group>
  );
}

export function Exterior() {
  const profile = useVisualProfile();
  const full = profile.quality !== 'low';
  const parts = useMemo(() => buildDistrict(full), [full]);
  useMemo(() => {
    // Atlas kemasan/kain/poster/lauk untuk isi kios (sekali, material bersama).
    if (MAT.goodsAtlas.map) return;
    const t = goodsAtlasTexture();
    if (!t) return;
    MAT.goodsAtlas.map = t;
    MAT.goodsAtlas.needsUpdate = true;
  }, []);
  useMemo(() => {
    // Atlas daun dibuat sekali (kanvas) dan dipasang ke material bersama.
    if (MAT.leafCard.map) return;
    const canvas = drawLeafAtlas();
    if (!canvas) return;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    MAT.leafCard.map = t;
    MAT.leafCard.needsUpdate = true;
  }, []);
  return (
    <group>
      <BuiltMeshes parts={parts} castShadow={profile.sunShadows} renderOrder={LATE_DRAW} />
      <NightMaterials />
      <ExteriorProps />
      <SignAtlas signs={DISTRICT_SIGNS} />
      <GateBooms />
      <LoadingPanel />
      <StaffScooters />
      <DeliveryVan />
      {showroomEnabled() ? <VehicleShowroom /> : <Traffic />}
      <Pedestrians />
      {profile.halos && LAMPS.map(([x, y, z]) => <LightHalo key={`${x},${z}`} position={[x, y, z]} size={2.6} warm nightOnly />)}
      {/* Genangan cahaya lampu jalan & lampu dinding bongkar muat di tanah (malam). */}
      {LAMPS.map(([x, , z]) => (
        <LightHalo key={`pool-${x},${z}`} position={[x, 0.03, z]} size={9} color="#ffcf8a" facing="up" nightOnly intensity={1} />
      ))}
      <LightHalo position={[-13.1, 0.03, -2.4]} size={5} color="#ffd9a0" facing="up" nightOnly intensity={0.8} />
      {profile.halos && <LightHalo position={[11.55, 4.4, 10.85]} size={1.6} color="#7dffb8" nightOnly />}
    </group>
  );
}
