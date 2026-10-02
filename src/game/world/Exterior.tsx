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
import { DeliveryVan, StaffScooters, Traffic } from './DistrictVehicles';
import { Interactable } from '@/game/objects/Interactable';
import { Pedestrians } from '@/game/npc/Pedestrians';
import { vehicles } from '@/game/npc/crowd';
import { TIME } from '@/domain/config';
import {
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
  isOpenShop,
  type Gate,
  type Shop,
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
const KIOSK_DEPTH = 2.6;

// ------------------------------------------------------------------ Ruko

/** Tinggi bangunan dari jumlah lantai (lantai dasar 3,6 m, lantai atas 3,2 m). */
const shopHeight = (s: Shop) => 3.6 + (s.floors - 1) * 3.2;

/** Interior kios (ceruk 2,6 m): lantai, dinding, plafon berlampu, rak barang, dan meja/etalase di garis muka. */
function kioskInterior(b: B, s: Shop, cx: number, openW: number) {
  const f = s.facing;
  const zF = s.front;
  const zMid = zF - (f * KIOSK_DEPTH) / 2;
  const zBack = zF - f * KIOSK_DEPTH;
  b.add('terrace', floorQuad(cx - openW / 2, cx + openW / 2, Math.min(zF, zBack), Math.max(zF, zBack), 0.012));
  b.box('kioskWall', openW, 3.4, 0.1, cx, 1.7, zBack + f * 0.05, { r: 0 });
  for (const sx of [-1, 1]) b.box('kioskWall', 0.1, 3.4, KIOSK_DEPTH, cx + sx * (openW / 2 - 0.05), 1.7, zMid, { r: 0 });
  b.box('kioskWall', openW, 0.08, KIOSK_DEPTH, cx, 3.42, zMid, { r: 0 });
  b.box('kioskLight', Math.min(2.4, openW * 0.4), 0.03, 0.5, cx, 3.37, zMid, { r: 0 });
  const counterZ = zF - f * 0.3;
  if (s.kind === 'bengkel') {
    // Bengkel: tumpukan ban di garis muka sebagai pembatas, motor yang sedang diservis, lemari alat & meja kerja.
    const n = Math.floor((openW - 0.4) / 0.62);
    for (let k = 0; k < n; k++) for (let t = 0; t < 3; t++) b.add('tire', new THREE.TorusGeometry(0.26, 0.09, 6, 12), cx - openW / 2 + 0.5 + k * 0.62, 0.09 + t * 0.18, counterZ, { rotX: Math.PI / 2 });
    scooterModel(b, cx - 0.4, zMid - f * 0.15, Math.PI / 2, 'bikeBlue');
    b.box('awningRed', 1.0, 1.4, 0.5, cx + openW / 2 - 0.75, 0.7, zBack + f * 0.32, { r: 0.02 });
    b.box('metalDark', 2.2, 0.85, 0.55, cx - openW / 2 + 1.4, 0.43, zBack + f * 0.35, { r: 0.01 });
    return;
  }
  // Rak dinding belakang berisi barang (kemasan generik berwarna).
  const goods: MatKey[] = s.kind === 'hardware' ? ['cardboard', 'zinc', 'paintYellow', 'awningRed'] : ['awningRed', 'awningBlue', 'awningGreen', 'paintYellow', 'white', 'cardboard'];
  for (let lv = 0; lv < 4; lv++) {
    const y = 0.55 + lv * 0.62;
    b.box('woodDark', openW - 0.5, 0.03, 0.4, cx, y, zBack + f * 0.3, { r: 0 });
    const n = Math.floor((openW - 0.6) / 0.24);
    for (let k = 0; k < n; k++) {
      const h = 0.18 + ((k * 7 + lv * 3) % 5) * 0.04;
      b.box(goods[(k + lv * 2) % goods.length], 0.18, h, 0.22, cx - (openW - 0.6) / 2 + 0.12 + k * 0.24, y + 0.015 + h / 2, zBack + f * 0.3, { r: 0 });
    }
  }
  if (s.kind === 'warung') {
    // Etalase kaca berisi piring lauk (rumah makan / warung) di sepanjang garis muka.
    b.box('white', openW - 0.2, 0.8, 0.6, cx, 0.4, counterZ, { r: 0.01 });
    b.box('glass', openW - 0.2, 0.55, 0.6, cx, 1.08, counterZ, { r: 0 });
    const plates: MatKey[] = ['awningRed', 'paintYellow', 'awningGreen', 'cardboard'];
    for (let k = 0; k < Math.floor((openW - 0.4) / 0.32); k++) {
      for (const [j, y] of [0.86, 1.14].entries()) b.cylinder(plates[(k + j) % plates.length], 0.12, 0.12, 0.04, cx - (openW - 0.6) / 2 + k * 0.32, y, counterZ, { seg: 14 });
    }
    return;
  }
  // Meja kios / kasir di garis muka.
  b.box('woodDark', openW - 0.2, 1.0, 0.55, cx, 0.5, counterZ, { r: 0.01 });
  b.box('counterTop', openW - 0.1, 0.04, 0.62, cx, 1.02, counterZ, { r: 0.008 });
  if (s.kind === 'cafe') {
    b.box('steel', 0.45, 0.45, 0.4, cx - 0.8, 1.27, counterZ, { r: 0.03 });
    b.box('black', 0.3, 0.12, 0.25, cx + 0.6, 1.1, counterZ, { r: 0.02 });
  } else {
    b.box('black', 0.32, 0.22, 0.04, cx + openW / 4, 1.16, counterZ, { r: 0.01, rotX: -0.3 });
  }
  if (s.kind === 'hardware') for (let k = 0; k < 5; k++) b.box('cardboard', 0.5, 0.18, 0.36, cx - openW / 2 + 0.5 + k * 0.55, 0.09 + (k % 2) * 0.18, zMid, { r: 0.01 });
}

/**
 * Isi khas tiap kios (dibaca dari luar): renteng sachet & tabung gas 3 kg di kelontong, mesin fotokopi & rim kertas,
 * etalase ponsel di konter pulsa, kaleng cat & pipa di toko bangunan, roti, printer besar & gulungan kertas,
 * papan menu kedai kopi. Semua memakai material yang sudah ada (tanpa draw call tambahan).
 */
function kioskExtras(b: B, s: Shop, cx: number, openW: number) {
  const f = s.facing;
  const zF = s.front;
  const zMid = zF - f * 1.35;
  const zBack = zF - f * KIOSK_DEPTH;
  const counterTopY = 1.04;
  const right = cx + openW / 2;
  const left = cx - openW / 2;
  switch (s.id) {
    case 'S1': {
      // Renteng sachet kopi/sampo bergantung di atas meja + tabung gas 3 kg ("melon") di sisi kanan.
      const cols: MatKey[] = ['awningRed', 'paintYellow', 'awningBlue', 'white', 'awningGreen'];
      for (let k = 0; k < 9; k++) b.box(cols[k % cols.length], 0.11, 0.85, 0.008, left + 0.6 + k * ((openW - 1.2) / 8), 2.45, zF - f * 0.7, { r: 0 });
      b.box('metalDark', openW - 1.0, 0.02, 0.02, cx, 2.88, zF - f * 0.7, { r: 0 });
      for (let k = 0; k < 3; k++) {
        const x = right - 0.35 - (k % 2) * 0.34;
        const z = zMid - f * (k === 2 ? 0.34 : 0);
        b.cylinder('awningGreen', 0.15, 0.15, 0.34, x, 0.2, z, { seg: 14 });
        b.cylinder('metalDark', 0.05, 0.05, 0.08, x, 0.41, z, { seg: 8 });
      }
      break;
    }
    case 'S3': {
      // Mesin fotokopi + rim kertas di meja.
      const x = right - 0.75;
      b.box('plasticWhite', 0.9, 0.95, 0.65, x, 0.475, zMid, { r: 0 });
      b.box('metalDark', 0.86, 0.06, 0.6, x, 0.98, zMid, { r: 0 });
      b.box('black', 0.3, 0.05, 0.14, x + 0.22, 1.02, zMid + f * 0.2, { r: 0, rotX: -f * 0.3 });
      b.box('white', 0.5, 0.08, 0.3, x - 0.6, 0.6, zMid, { r: 0 });
      for (let k = 0; k < 4; k++) b.box(k % 2 ? 'white' : 'paintYellow', 0.3, 0.06, 0.21, left + 0.6 + (k % 2) * 0.34, counterTopY + 0.03 + Math.floor(k / 2) * 0.06, zF - f * 0.3, { r: 0 });
      break;
    }
    case 'S4': {
      // Etalase kaca berisi ponsel di atas meja + spanduk promo di dinding belakang.
      b.box('glass', 1.4, 0.32, 0.42, cx - 0.8, counterTopY + 0.16, zF - f * 0.3, { r: 0 });
      for (let k = 0; k < 8; k++) b.box('black', 0.07, 0.14, 0.012, cx - 1.38 + k * 0.165, counterTopY + 0.11, zF - f * 0.3, { r: 0, rotX: -f * 0.35 });
      b.box('awningRed', 1.3, 0.5, 0.01, cx - 0.9, 3.0, zBack + f * 0.06, { r: 0 });
      b.box('paintYellow', 1.3, 0.5, 0.01, cx + 0.9, 3.0, zBack + f * 0.06, { r: 0 });
      break;
    }
    case 'S5': {
      // Kaleng cat bertumpuk & pipa PVC bersandar di dinding samping.
      const cans: MatKey[] = ['paintYellow', 'white', 'awningBlue', 'awningRed'];
      for (let k = 0; k < 8; k++) b.cylinder(cans[k % 4], 0.11, 0.11, 0.2, left + 0.35 + (k % 4) * 0.25, 0.1 + Math.floor(k / 4) * 0.21, zMid + f * 0.1, { seg: 12 });
      for (let k = 0; k < 5; k++) b.cylinder('plasticWhite', 0.04, 0.04, 2.6, right - 0.2 - k * 0.09, 1.3, zMid - f * 0.2, { rotZ: 0.12, seg: 8 });
      break;
    }
    case 'F1': {
      // Roti di rak & etalase kaca roti di meja.
      for (let lv = 0; lv < 3; lv++) for (let k = 0; k < 12; k++) b.sphere('cardboard', 0.09, left + 0.5 + k * ((openW - 1.0) / 11), 0.62 + lv * 0.62, zBack + f * 0.3, { sx: 1.4, sy: 0.75, sz: 1, seg: 8 });
      b.box('glass', openW - 1.2, 0.4, 0.45, cx, counterTopY + 0.2, zF - f * 0.3, { r: 0 });
      for (let k = 0; k < 10; k++) b.sphere('cardboard', 0.07, cx - (openW - 1.6) / 2 + k * ((openW - 1.6) / 9), counterTopY + 0.07, zF - f * 0.3, { sx: 1.5, sy: 0.8, seg: 8 });
      break;
    }
    case 'F6': {
      // Printer format besar & gulungan kertas.
      b.box('plasticWhite', 1.9, 0.5, 0.62, cx - 0.4, 0.95, zMid, { r: 0 });
      for (const sx of [-0.8, 0.8]) b.box('metalDark', 0.06, 0.7, 0.5, cx - 0.4 + sx, 0.35, zMid, { r: 0 });
      b.box('black', 1.7, 0.06, 0.1, cx - 0.4, 1.0, zMid + f * 0.32, { r: 0 });
      for (let k = 0; k < 4; k++) b.cylinder('white', 0.08, 0.08, 1.1, right - 0.3, 0.55 + k * 0.17, zMid - f * 0.25, { rotZ: Math.PI / 2 - 0.2, seg: 10 });
      break;
    }
    case 'F5': {
      // Papan menu di dinding belakang (baris tulisan sebagai garis).
      b.box('black', 1.6, 0.9, 0.03, cx, 2.6, zBack + f * 0.07, { r: 0 });
      for (let k = 0; k < 5; k++) b.box('white', 0.9 - (k % 2) * 0.25, 0.035, 0.005, cx - 0.2, 2.92 - k * 0.14, zBack + f * 0.09, { r: 0 });
      for (let k = 0; k < 5; k++) b.box('paintYellow', 0.18, 0.035, 0.005, cx + 0.55, 2.92 - k * 0.14, zBack + f * 0.09, { r: 0 });
      break;
    }
  }
}

/** Jendela lantai atas: kusen, kaca (sebagian menyala malam), ambang, teralis opsional. */
function upperWindows(b: B, s: Shop, i: number, y: number) {
  const f = s.facing;
  const z = s.front;
  const w = s.x1 - s.x0;
  const n = Math.max(2, Math.round(w / 2.4));
  for (let k = 0; k < n; k++) {
    const x = s.x0 + (w / n) * (k + 0.5);
    b.box('aluminum', 1.4, 1.45, 0.06, x, y, z + f * 0.01, { r: 0.004 });
    b.box((k + i + Math.round(y)) % 3 === 0 ? 'windowLit' : 'glassDark', 1.3, 1.35, 0.02, x, y, z + f * 0.04, { r: 0 });
    b.box(s.facade, 1.55, 0.08, 0.16, x, y - 0.78, z + f * 0.06, { r: 0.006 });
    if (s.teralis) for (let t = -2; t <= 2; t++) b.box('metalDark', 0.018, 1.35, 0.018, x + t * 0.26, y, z + f * 0.09, { r: 0 });
  }
}

/**
 * Unit AC luar ruko (latar, dilihat dari jauh): model sederhana yang digabung ke mesh kawasan — bodi, kisi kipas,
 * ventilasi samping, braket, pipa ke dinding. Unit AC dekat pemain (apotek) memakai model GLB detail.
 * Diletakkan di antara jendela pertama & kedua lantai 2 (tidak menutupi papan nama).
 */
function shopAcUnit(b: B, s: Shop) {
  const f = s.facing;
  const cx = s.x0 + (s.x1 - s.x0) / 3;
  const y = 5.3;
  const z = s.front;
  b.box('plasticWhite', 0.8, 0.58, 0.28, cx, y, z + f * 0.15, { r: 0 });
  b.cylinder('metalDark', 0.2, 0.2, 0.012, cx - 0.1, y, z + f * 0.295, { rotX: Math.PI / 2, seg: 16 });
  b.cylinder('plasticWhite', 0.05, 0.05, 0.016, cx - 0.1, y, z + f * 0.3, { rotX: Math.PI / 2, seg: 8 });
  for (let k = -2; k <= 2; k++) b.box('metalDark', 0.012, 0.42, 0.008, cx + 0.22 + k * 0.03, y, z + f * 0.292, { r: 0 });
  for (const sx of [-1, 1]) b.box('metalDark', 0.04, 0.04, 0.34, cx + sx * 0.3, y - 0.31, z + f * 0.17, { r: 0 });
  b.box('plasticWhite', 0.05, 0.05, 0.3, cx + 0.43, y - 0.18, z + f * 0.15, { r: 0 });
}

function shopModel(b: B, s: Shop, i: number) {
  const w = s.x1 - s.x0;
  const cx = (s.x0 + s.x1) / 2;
  const f = s.facing;
  const zF = s.front;
  const H = shopHeight(s);
  const open = isOpenShop(s);
  const openW = w - 1.0;
  const recess = open ? KIOSK_DEPTH : 0;
  // Massa: lantai atas penuh; lantai dasar di belakang ceruk kios; pilar samping di depan.
  b.box(s.facade, w, H - 3.6, s.depth, cx, 3.6 + (H - 3.6) / 2, zF - (f * s.depth) / 2, { r: 0 });
  b.box(s.facade, w, 3.6, s.depth - recess, cx, 1.8, zF - f * (recess + (s.depth - recess) / 2), { r: 0 });
  if (open) for (const sx of [-1, 1]) b.box(s.facade, 0.5, 3.6, recess, cx + sx * (w / 2 - 0.25), 1.8, zF - (f * recess) / 2, { r: 0 });
  else b.box('shutter', openW, 2.9, 0.06, cx, 1.45, zF + f * 0.03, { r: 0 });
  // Pilaster ujung (dinding bersama) & lis lantai.
  for (const px of [s.x0 + 0.15, s.x1 - 0.15]) b.box(s.facade, 0.3, H, 0.22, px, H / 2, zF + f * 0.09, { r: 0.01 });
  b.box(s.facade, w, 0.22, 0.3, cx, 3.6, zF + f * 0.12, { r: 0.01 });
  // Kotak rolling door (tergulung bila toko buka).
  b.box('metalDark', openW + 0.2, 0.32, 0.3, cx, 3.06, zF + f * 0.15, { r: 0.01 });
  if (open) {
    kioskInterior(b, s, cx, openW);
    kioskExtras(b, s, cx, openW);
  }
  // Kanopi: kain miring atau seng datar bertopang.
  if (s.awning === 'fabric') {
    b.box(s.awningMat, w - 0.4, 0.04, 1.3, cx, 3.35, zF + f * 0.62, { rotX: f * 0.32, r: 0 });
  } else {
    b.box('zinc', w - 0.3, 0.05, 1.15, cx, 3.32, zF + f * 0.58, { r: 0.004 });
    for (const sx of [-1, 1]) b.box('metalDark', 0.04, 0.04, 1.2, cx + sx * (w / 2 - 0.5), 3.08, zF + f * 0.55, { rotX: f * -0.45, r: 0 });
  }
  // Rangka papan nama (teks di SignAtlas).
  b.box('metalDark', w * 0.82, 0.86, 0.08, cx, 4.15, zF + f * 0.05, { r: 0.02 });
  // Lantai atas: balkon (lantai 2) & jendela.
  if (s.balcony) {
    const bw = w - 1.0;
    const posts = Math.round(bw / 0.6);
    b.box(s.facade, bw, 0.14, 0.95, cx, 4.75, zF + f * 0.47, { r: 0.01 });
    for (let k = 0; k <= posts; k++) b.box('metalDark', 0.025, 0.9, 0.025, cx - bw / 2 + (k * bw) / posts, 5.27, zF + f * 0.92, { r: 0 });
    b.box('metalDark', bw, 0.04, 0.05, cx, 5.72, zF + f * 0.92, { r: 0 });
  }
  for (let fl = 1; fl < s.floors; fl++) upperWindows(b, s, i, 3.6 + (fl - 1) * 3.2 + 1.75 + (fl === 1 ? 0.4 : 0));
  if (i % 3 === 0) shopAcUnit(b, s);
  // Atap: parapet datar atau pelana genteng menghadap jalan (dengan dinding pelana depan & belakang).
  if (s.roof === 'flat') {
    b.box(s.facade, w + 0.06, 0.9, 0.24, cx, H + 0.45, zF + f * 0.05, { r: 0.01 });
    b.box(s.facade, w + 0.1, 0.08, 0.32, cx, H + 0.94, zF + f * 0.05, { r: 0.004 });
  } else {
    const rise = 2.2;
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
    const gable = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
    b.add(s.facade, gable, cx, H, f > 0 ? zF - 0.2 : zF);
    b.add(s.facade, gable, cx, H, f > 0 ? zF - s.depth : zF + s.depth - 0.2);
    const slope = Math.atan2(rise, w / 2);
    const len = Math.hypot(w / 2, rise) + 0.25;
    for (const sx of [-1, 1]) b.box('roofTile', len, 0.08, s.depth + 0.5, cx + (sx * w) / 4, H + rise / 2 + 0.05, zF - (f * s.depth) / 2 + f * 0.25, { rotZ: -sx * slope, r: 0 });
  }
  // Toren air di atap (khas rumah & ruko Indonesia).
  if (s.tank) {
    const tx = s.x1 - 1.4;
    const tz = zF - f * 3.2;
    const ty = s.roof === 'flat' ? H : H + 0.4;
    for (const [dx, dz] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [0.45, 0.45],
    ])
      b.box('metalDark', 0.05, 1.2, 0.05, tx + dx, ty + 0.6, tz + dz, { r: 0 });
    b.box('metalDark', 1.05, 0.06, 1.05, tx, ty + 1.2, tz, { r: 0 });
    b.cylinder(i % 2 ? 'tankOrange' : 'tankBlue', 0.5, 0.52, 1.3, tx, ty + 1.88, tz, { seg: 20 });
  }
  // Teras keramik di depan ruko.
  b.add('terrace', floorQuad(s.x0, s.x1, f > 0 ? zF : zF - 1.0, f > 0 ? zF + 1.0 : zF, 0.016));
}

/** Dinding samping ruko pengapit gang (S3/S4): jendela lantai atas agar gang tidak berupa tembok polos. */
function alleyWalls(b: B) {
  for (const s of SHOPS) {
    if (s.facing !== 1 || s.depth < 30) continue;
    const side = Math.abs(s.x1 + STREET.alleyOuter) < 0.01 ? 1 : -1;
    const x = side > 0 ? s.x1 : s.x0;
    for (let fl = 1; fl < s.floors; fl++) {
      const y = 3.6 + (fl - 1) * 3.2 + 1.75 + (fl === 1 ? 0.4 : 0);
      for (let z = 6; z > s.front - s.depth + 2; z -= 4.5) {
        b.box('aluminum', 0.06, 1.45, 1.4, x + side * 0.01, y, z, { r: 0.004 });
        b.box((Math.round(z) + fl) % 3 === 0 ? 'windowLit' : 'glassDark', 0.02, 1.35, 1.3, x + side * 0.04, y, z, { r: 0 });
        b.box(s.facade, 0.16, 0.08, 1.55, x + side * 0.06, y - 0.78, z, { r: 0.006 });
      }
    }
  }
}

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
  const facades: MatKey[] = ['facadeA', 'facadeB', 'facadeC', 'facadeD', 'houseWall'];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const x0 = side * (STREET.gateX + 0.2 + k * 8);
      const cx = x0 + side * 3.8;
      for (const row of [1, -1] as const) {
        const zF = row === 1 ? STREET.frontZ : STREET.farFrontZ;
        const h = 6.6 + ((k + (row > 0 ? 0 : 1)) % 3) * 1.8;
        b.box(facades[(k + (row > 0 ? 0 : 2)) % facades.length], 7.6, h, 9, cx, h / 2, zF - row * 4.5, { r: 0 });
        b.box('shutter', 6.4, 2.8, 0.05, cx, 1.4, zF + row * 0.03, { r: 0 });
        for (let w = 0; w < 3; w++) b.box(w % 2 ? 'glassDark' : 'windowLit', 1.3, 1.2, 0.04, cx - 2.4 + w * 2.4, 5.2, zF + row * 0.03, { r: 0 });
      }
    }
    if (full) for (const x of [side * 46, side * 58]) ketapangTree(b, x, STREET.nearFurnitureZ, Math.abs(x), 1);
  }
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
const OUTDOOR: MatKey[] = ['facade', 'facadeA', 'facadeB', 'facadeC', 'facadeD', 'facadeAccent', 'sidewalk', 'road', 'concrete', 'ground', 'curbWhite', 'curbBlack', 'roadPaint', 'terrace', 'stone', 'shutter', 'awningRed', 'awningBlue', 'awningGreen', 'glassDark', 'trunk', 'treeLeaf', 'treeLeafLight', 'leafCard', 'tactile', 'tire', 'bikeRed', 'bikeBlack', 'bikeWhite', 'bikeBlue', 'roofTile', 'zinc', 'tankBlue', 'tankOrange', 'paintYellow', 'houseWall', 'kioskWall', 'carPaint'];

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
      m.envMapIntensity = env;
    }
    MAT.windowLit.emissiveIntensity = 0.04 + n * 1.2;
    MAT.lampGlow.emissiveIntensity = 0.1 + n * 2.6;
    MAT.emissiveWarm.emissiveIntensity = 0.6 + n * 1.4;
    MAT.signGreen.emissiveIntensity = 0.9 + n * 0.9;
    (MAT.kioskLight as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + n * 1.2;
  });
  return null;
}

/** Kepala lampu jalan (posisi halo & genangan cahaya). */
const LAMPS: [number, number, number][] = STREET_LAMPS.map(([x, z, f]) => [x, 5.9, z + f * 1.3]);

/** Papan nama statis kawasan (satu atlas, satu draw call). */
const DISTRICT_SIGNS: SignDef[] = [
  ...SHOPS.map<SignDef>((s) => ({
    text: s.name,
    width: (s.x1 - s.x0) * 0.78,
    height: 0.72,
    background: s.sign,
    position: [(s.x0 + s.x1) / 2, 4.15, s.front + s.facing * 0.1],
    rotationY: s.facing === 1 ? 0 : Math.PI,
  })),
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
      <BuiltMeshes parts={parts} castShadow={profile.sunShadows} />
      <NightMaterials />
      <ExteriorProps />
      <SignAtlas signs={DISTRICT_SIGNS} />
      <GateBooms />
      <LoadingPanel />
      <StaffScooters />
      <DeliveryVan />
      <Traffic />
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
