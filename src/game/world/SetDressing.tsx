import { useEffect, useMemo, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '@/stores/gameStore';
import { BuiltMeshes, type BuiltPart } from '@/game/visual/Built';
import { useModel, type ModelKey } from '@/game/assets/models';
import { TIME } from '@/domain/config';
import { CanvasLabel } from './CanvasLabel';
import { CanvasPlane } from './posters';
import { newBuilder, plantModel, type B } from './furnitureModels';
import { queueSlot } from './layout';
import { BackRoomCull } from '@/game/visual/InteriorCull';

/**
 * Set dressing khas apotek Indonesia (ART_DIRECTION.md §4). Hanya dekorasi: tanpa sorotan,
 * prompt, maupun collider di jalur NPC. Perlengkapan "wajib" apotek nyata selalu ada; tanaman tetap
 * menjadi hadiah peningkatan Dekorasi agar peningkatan tidak kehilangan makna.
 */

function built(fn: (b: B) => void): BuiltPart[] {
  const b = newBuilder();
  fn(b);
  return b.build();
}

const font = (weight: number, size: number) => `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;

// ------------------------------------------------------------------ Properti CC0 (Poly Haven)

/** Model CC0; selama memuat (atau bila gagal) menampilkan `fallback`. */
export function Prop({ name, position, rotation = 0, scale = 1, fallback = null }: { name: ModelKey; position: [number, number, number]; rotation?: number; scale?: number; fallback?: ReactNode }) {
  const model = useModel(name);
  if (!model) return <>{fallback}</>;
  return <primitive object={model} position={position} rotation={[0, rotation, 0]} scale={scale} />;
}

/** Kipas plafon yang berputar (ruang istirahat). */
export function CeilingFan({ position }: { position: [number, number, number] }) {
  const model = useModel('ceiling_fan');
  useFrame((_, dt) => {
    if (model) model.rotation.y += Math.min(dt, 0.1) * 5.5;
  });
  if (!model) return null;
  return <primitive object={model} position={position} />;
}

/** Tanaman hias peningkatan Dekorasi: model foto Poly Haven, tanaman prosedural sebagai cadangan. */
export function PlantProp({ kind, x, z, rotation = 0, scale = 1, seed = 1 }: { kind: 'plant_taro' | 'plant_tree'; x: number; z: number; rotation?: number; scale?: number; seed?: number }) {
  const fallback = useMemo(() => built((b) => plantModel(b, x, z, scale, seed)), [x, z, scale, seed]);
  return <Prop name={kind} position={[x, 0, z]} rotation={rotation} scale={scale} fallback={<BuiltMeshes parts={fallback} castShadow />} />;
}

// ------------------------------------------------------------------ Model buatan sendiri

/** APAR 3 kg berdudukan dinding (lokal: menempel dinding di z=0, menghadap +Z, dasar tabung y=0). */
function aparModel(b: B) {
  b.box('metalDark', 0.09, 0.2, 0.012, 0, 0.3, 0.006, { r: 0.003 });
  b.box('metalDark', 0.13, 0.014, 0.1, 0, 0.16, 0.055, { r: 0.004 });
  b.box('metalDark', 0.012, 0.03, 0.03, 0, 0.42, 0.02, { r: 0.002 });
  b.lathe(
    'aparRed',
    [
      [0, 0],
      [0.058, 0],
      [0.065, 0.012],
      [0.065, 0.33],
      [0.06, 0.365],
      [0.045, 0.39],
      [0.02, 0.402],
      [0, 0.404],
    ],
    0,
    0,
    0.085,
    { seg: 26 },
  );
  b.cylinder('chrome', 0.016, 0.019, 0.045, 0, 0.425, 0.085, { seg: 14 });
  b.box('black', 0.11, 0.012, 0.026, 0.035, 0.458, 0.085, { r: 0.004, rotZ: -0.12 });
  b.box('black', 0.1, 0.012, 0.024, 0.035, 0.478, 0.085, { r: 0.004, rotZ: 0.22 });
  b.cylinder('white', 0.017, 0.017, 0.012, -0.024, 0.432, 0.104, { rotX: Math.PI / 2, seg: 16 });
  b.cylinder('black', 0.0075, 0.0075, 0.3, 0.06, 0.27, 0.118, { seg: 8, rotZ: 0.05 });
  b.cylinder('black', 0.013, 0.009, 0.07, 0.062, 0.095, 0.118, { seg: 10 });
}

/** CCTV kubah di plafon (lokal: y=0 = plafon, menggantung ke bawah). */
function cctvModel(b: B) {
  b.cylinder('plasticWhite', 0.078, 0.084, 0.032, 0, -0.016, 0, { seg: 28 });
  b.sphere('smokedDome', 0.058, 0, -0.03, 0, { seg: 20, sy: 0.92 });
  b.cylinder('plasticWhite', 0.062, 0.062, 0.008, 0, -0.034, 0, { seg: 24 });
}

/** Tempat sampah pedal stainless. */
function binModel(b: B) {
  b.lathe(
    'steel',
    [
      [0, 0.02],
      [0.13, 0.02],
      [0.142, 0.4],
      [0.146, 0.41],
      [0, 0.41],
    ],
    0,
    0,
    0,
    { seg: 28 },
  );
  b.lathe(
    'steel',
    [
      [0, 0.41],
      [0.15, 0.41],
      [0.148, 0.43],
      [0.12, 0.452],
      [0, 0.458],
    ],
    0,
    0,
    0,
    { seg: 28 },
  );
  b.cylinder('black', 0.134, 0.134, 0.02, 0, 0.01, 0, { seg: 24 });
  b.box('black', 0.1, 0.014, 0.07, 0, 0.022, 0.15, { r: 0.004 });
}

/** Tiang hand sanitizer di pintu masuk. */
function sanitizerModel(b: B) {
  b.cylinder('metalDark', 0.17, 0.18, 0.012, 0, 0.006, 0, { seg: 28 });
  b.cylinder('aluminum', 0.018, 0.018, 1.0, 0, 0.51, 0, { seg: 12 });
  b.box('plasticWhite', 0.13, 0.22, 0.11, 0, 1.08, 0.045, { r: 0.015 });
  b.box('black', 0.05, 0.018, 0.03, 0, 0.97, 0.09, { r: 0.004 });
  b.box('glassDark', 0.06, 0.06, 0.004, 0, 1.12, 0.1, { r: 0.002 });
}

/** Rak brosur akrilik bertingkat di atas meja. */
function brochureHolderModel(b: B) {
  for (let i = 0; i < 3; i++) {
    const y = 0.01 + i * 0.07;
    const z = -i * 0.045;
    b.box('acrylic', 0.23, 0.12, 0.004, 0, y + 0.06, z + 0.02, { r: 0, rotX: -0.18 });
    b.box('acrylic', 0.23, 0.004, 0.04, 0, y, z, { r: 0 });
  }
}

/** Bingkai dokumen (lokal: menempel dinding, menghadap +Z). */
function frameModel(b: B, w: number, h: number) {
  b.box('woodDark', w, h, 0.02, 0, 0, 0.01, { r: 0.004 });
  b.box('glass', w - 0.04, h - 0.04, 0.003, 0, 0, 0.022, { r: 0 });
}

/** Lambris HPL kayu setinggi pinggang di dinding ruang tunggu (dinding kiri, menghadap +X). */
function wainscotModel(b: B) {
  const z0 = 2.45;
  const z1 = 9.88;
  const len = z1 - z0;
  const cz = (z0 + z1) / 2;
  const x = -11.9 + 0.008;
  b.box('wood', 0.016, 0.86, len, x, 0.53, cz, { r: 0 });
  // Alur panel tiap 60 cm.
  for (let z = z0 + 0.6; z < z1 - 0.1; z += 0.6) b.box('woodDark', 0.004, 0.86, 0.006, x + 0.009, 0.53, z, { r: 0 });
  b.box('aluminum', 0.03, 0.025, len, x + 0.006, 0.97, cz, { r: 0.004 });
}

/** Detektor asap & speaker plafon (lokal: y=0 = plafon). */
function ceilingDetailModel(b: B, speaker: boolean) {
  if (speaker) {
    b.cylinder('plasticWhite', 0.1, 0.1, 0.018, 0, -0.009, 0, { seg: 28 });
    b.cylinder('metalDark', 0.085, 0.085, 0.004, 0, -0.019, 0, { seg: 28 });
  } else {
    b.cylinder('plasticWhite', 0.055, 0.065, 0.04, 0, -0.02, 0, { seg: 24 });
    b.cylinder('steel', 0.02, 0.02, 0.006, 0, -0.043, 0, { seg: 12 });
  }
}

// ------------------------------------------------------------------ Gambar kanvas (fiktif)

/** Stiker kaca buram (sandblast) dengan nama apotek — terbaca dari luar, seperti stiker asli. */
function drawWindowFilm(name: string, widthM: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(244,247,248,0.62)';
    ctx.fillRect(0, h * 0.12, w, h * 0.76);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, h * 0.12, w, h * 0.04);
    ctx.fillRect(0, h * 0.84, w, h * 0.04);
    const reps = Math.max(1, Math.round(widthM / 2.6));
    for (let i = 0; i < reps; i++) {
      const cx = ((i + 0.5) / reps) * w;
      // Tanda plus.
      ctx.fillStyle = 'rgba(14,124,107,0.9)';
      const s = h * 0.34;
      const px = cx - w * 0.07 / reps - s * 0.9;
      ctx.fillRect(px - s * 0.17, h * 0.5 - s / 2, s * 0.34, s);
      ctx.fillRect(px - s / 2, h * 0.5 - s * 0.17, s, s * 0.34);
      ctx.fillStyle = 'rgba(30,41,59,0.85)';
      ctx.font = font(800, h * 0.28);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`APOTEK ${name.toUpperCase()}`, px + s * 0.75, h * 0.5);
    }
  };
}

function WindowFilm({ name, x0, x1 }: { name: string; x0: number; x1: number }) {
  const w = x1 - x0;
  const draw = useMemo(() => drawWindowFilm(name, w), [name, w]);
  const texture = useCanvasTexture(draw, Math.round(w * 220), 110);
  return (
    <mesh position={[(x0 + x1) / 2, 1.27, 10.06]} raycast={() => null} renderOrder={2}>
      <planeGeometry args={[w, 0.5]} />
      <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

function drawDocument(title: string, lines: string[], accent: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#f7f3e8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = w * 0.02;
    ctx.strokeRect(w * 0.04, w * 0.04, w * 0.92, h - w * 0.08);
    ctx.lineWidth = w * 0.005;
    ctx.strokeRect(w * 0.07, w * 0.07, w * 0.86, h - w * 0.14);
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.font = font(800, w * 0.075);
    let y = h * 0.2;
    for (const part of title.split('\n')) {
      ctx.fillText(part, w / 2, y);
      y += w * 0.09;
    }
    ctx.fillStyle = '#2b2b2b';
    ctx.font = font(500, w * 0.048);
    y += w * 0.05;
    for (const l of lines) {
      ctx.fillText(l, w / 2, y);
      y += w * 0.075;
    }
    // Stempel & tanda tangan (fiktif, abstrak).
    ctx.strokeStyle = 'rgba(30,64,175,0.55)';
    ctx.lineWidth = w * 0.01;
    ctx.beginPath();
    ctx.arc(w * 0.32, h * 0.82, w * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = w * 0.006;
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.84);
    ctx.bezierCurveTo(w * 0.62, h * 0.76, w * 0.68, h * 0.9, w * 0.78, h * 0.8);
    ctx.stroke();
  };
}

function drawAparLabel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(0, 0, w, h * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = font(800, w * 0.26);
  ctx.fillText('APAR', w / 2, h * 0.22);
  ctx.fillStyle = '#111827';
  ctx.font = font(700, w * 0.16);
  ctx.fillText('POWDER', w / 2, h * 0.5);
  ctx.fillText('3 KG', w / 2, h * 0.68);
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(w * 0.1, h * 0.8, w * 0.8, h * 0.06);
}

function drawQueueSticker(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const r = h * 0.16;
  ctx.fillStyle = '#f2b632';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(w * 0.03, h * 0.08, w * 0.94, h * 0.84, r * 0.8);
  ctx.fill();
  // Dua jejak kaki.
  ctx.fillStyle = '#f2b632';
  for (const [cx, rot] of [
    [w * 0.2, -0.12],
    [w * 0.33, 0.12],
  ] as const) {
    ctx.save();
    ctx.translate(cx, h * 0.5);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, h * 0.04, w * 0.035, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#f9fafb';
  ctx.font = font(800, h * 0.32);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ANTRE DI SINI', w * 0.43, h * 0.53);
}

function drawLeaflet(title: string, sub: string, color: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h * 0.42);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = font(800, w * 0.16);
    ctx.fillText(title, w / 2, h * 0.27);
    ctx.fillStyle = '#334155';
    ctx.font = font(600, w * 0.075);
    ctx.fillText(sub, w / 2, h * 0.58);
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < 4; i++) ctx.fillRect(w * 0.15, h * (0.68 + i * 0.07), w * 0.7, h * 0.025);
  };
}

/** Jam dinding yang menunjukkan jam permainan (bukan jam sistem). */
function WallClock({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const minute = useGame((s) => (s.game ? Math.floor(s.game.time.now % TIME.minutesPerDay) : TIME.openMinute));
  const rim = useMemo(
    () =>
      built((b) => {
        b.cylinder('plasticWhite', 0.175, 0.175, 0.045, 0, 0, 0.022, { rotX: Math.PI / 2, seg: 40 });
        b.cylinder('metalDark', 0.181, 0.181, 0.036, 0, 0, 0.026, { rotX: Math.PI / 2, seg: 40 });
      }),
    [],
  );
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, texture: t };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = canvas.width;
    const c = s / 2;
    ctx.fillStyle = '#fbfaf7';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#1f2937';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const long = i % 5 === 0;
      ctx.lineWidth = long ? 6 : 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(a) * s * (long ? 0.38 : 0.42), c - Math.cos(a) * s * (long ? 0.38 : 0.42));
      ctx.lineTo(c + Math.sin(a) * s * 0.46, c - Math.cos(a) * s * 0.46);
      ctx.stroke();
    }
    ctx.fillStyle = '#0e655b';
    ctx.font = font(700, 16);
    ctx.textAlign = 'center';
    ctx.fillText('APOTEK', c, c + s * 0.2);
    const hand = (angle: number, len: number, width: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c - Math.sin(angle) * len * 0.15, c + Math.cos(angle) * len * 0.15);
      ctx.lineTo(c + Math.sin(angle) * len, c - Math.cos(angle) * len);
      ctx.stroke();
    };
    const h = Math.floor(minute / 60) % 12;
    const m = minute % 60;
    hand(((h + m / 60) / 12) * Math.PI * 2, s * 0.24, 9, '#111827');
    hand((m / 60) * Math.PI * 2, s * 0.36, 6, '#111827');
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.arc(c, c, 7, 0, Math.PI * 2);
    ctx.fill();
    texture.needsUpdate = true;
  }, [minute, canvas, texture]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <BuiltMeshes parts={rim} />
      <mesh position={[0, 0, 0.046]} raycast={() => null}>
        <circleGeometry args={[0.158, 40]} />
        <meshStandardMaterial map={texture} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Stiker lantai (decal) tanpa z-fighting. */
function FloorDecal({ texture, position, size, rotation = 0 }: { texture: THREE.Texture; position: [number, number, number]; size: [number, number]; rotation?: number }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]} raycast={() => null} renderOrder={1}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={texture} transparent roughness={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

function useCanvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (ctx) draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [draw, w, h]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function drawDoormat(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#34302b';
  ctx.fillRect(0, 0, w, h);
  // Serat sabut.
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = `rgba(${90 + Math.random() * 60},${78 + Math.random() * 40},${60 + Math.random() * 30},0.35)`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 3 + Math.random() * 4);
  }
  ctx.strokeStyle = '#1d1a17';
  ctx.lineWidth = h * 0.05;
  ctx.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h * 0.9);
  ctx.fillStyle = 'rgba(214,196,160,0.85)';
  ctx.font = font(800, h * 0.2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SELAMAT DATANG', w / 2, h / 2);
}

// ------------------------------------------------------------------ Komposisi

export function SetDressing({ decor }: { decor: number }) {
  const pharmacyName = useGame((s) => s.game?.profile.pharmacyName ?? 'Sehat');
  const playerName = useGame((s) => s.game?.profile.name ?? 'Apoteker');
  const parts = useMemo(
    () => ({
      apar: built(aparModel),
      cctv: built(cctvModel),
      bin: built(binModel),
      sanitizer: built(sanitizerModel),
      brochure: built(brochureHolderModel),
      frameA4: built((b) => frameModel(b, 0.44, 0.58)),
      frameWide: built((b) => frameModel(b, 0.6, 0.44)),
      mat: built((b) => b.box('coir', 1.7, 0.014, 0.85, 0, 0.007, 0, { r: 0.006 })),
      wainscot: built(wainscotModel),
      counterPanel: built((b) => {
        b.box('counterBody', 2.9, 0.46, 0.03, 0, 0, 0.015, { r: 0.012 });
        b.box('aluminum', 2.94, 0.012, 0.034, 0, 0.236, 0.017, { r: 0 });
        b.box('aluminum', 2.94, 0.012, 0.034, 0, -0.236, 0.017, { r: 0 });
      }),
      ceiling: built((b) => {
        // Detektor asap & speaker di antara panel lampu (lihat CEILING_LIGHTS).
        for (const [x, z] of [
          [-3, 7.8],
          [3, 7.8],
          [-9, 4],
          [9, 4.2],
        ] as const)
          b.group(x, 3.2, z, 0, () => ceilingDetailModel(b, false));
        for (const [x, z] of [
          [-6, 3.6],
          [0, 3.6],
          [6, 3.6],
          [-9.5, 8.2],
        ] as const)
          b.group(x, 3.2, z, 0, () => ceilingDetailModel(b, true));
      }),
    }),
    [],
  );
  const sticker = useCanvasTexture(drawQueueSticker, 512, 128);
  const doormat = useCanvasTexture(drawDoormat, 512, 256);
  const open = `${String(Math.floor(TIME.openMinute / 60)).padStart(2, '0')}.00`;
  const close = `${String(Math.floor(TIME.closeMinute / 60)).padStart(2, '0')}.00`;
  const docs = useMemo(
    () => ({
      sia: drawDocument('SURAT IZIN\nAPOTEK', [`Apotek ${pharmacyName}`, `apt. ${playerName}, S.Farm.`, 'No. 001/SIA/2026', '(dokumen fiktif)'], '#0e655b'),
      sipa: drawDocument('SURAT IZIN PRAKTIK\nAPOTEKER', [`apt. ${playerName}, S.Farm.`, 'SIPA No. 001/2026', 'Berlaku s.d. 2031', '(dokumen fiktif)'], '#1e3a8a'),
      jadwal: drawDocument('JADWAL PRAKTIK\nAPOTEKER', [`apt. ${playerName}, S.Farm.`, `Setiap hari ${open}–${close}`], '#0e655b'),
    }),
    [pharmacyName, playerName, open, close],
  );
  const leaflets = useMemo(
    () => [drawLeaflet('DAGUSIBU', 'Dapatkan · Gunakan · Simpan · Buang', '#0e7c6b'), drawLeaflet('CUCI TANGAN', '6 langkah dengan sabun', '#2563eb'), drawLeaflet('TENSI', 'Kenali tekanan darah Anda', '#c2410c')],
    [],
  );
  return (
    <group name="set-dressing">
      <BuiltMeshes parts={parts.wainscot} receiveShadow />
      <BuiltMeshes parts={parts.ceiling} />
      {/* Stiker kaca buram di setiap bentang etalase (lihat bentang di Architecture.tsx). */}
      {(
        [
          [-11.79, -6.57],
          [-6.23, -1.55],
          [1.55, 6.23],
          [6.57, 11.79],
        ] as const
      ).map(([x0, x1]) => (
        <WindowFilm key={x0} name={pharmacyName} x0={x0} x1={x1} />
      ))}
      {/* Panel merek di muka meja pelayanan. */}
      <group position={[0.5, 0.5, 2.405]}>
        <BuiltMeshes parts={parts.counterPanel} />
        <CanvasLabel text={`APOTEK ${pharmacyName.toUpperCase()}`} width={2.5} height={0.3} position={[0, 0, 0.032]} background={null} color="#f4fbf9" fontSize={88} />
      </group>
      {/* APAR + tanda di dinding kanan, dekat meja. */}
      <group position={[11.9, 0.72, 2.6]} rotation={[0, -Math.PI / 2, 0]}>
        <BuiltMeshes parts={parts.apar} castShadow />
        <CanvasPlane draw={drawAparLabel} width={0.07} height={0.1} px={900} position={[0, 0.2, 0.152]} />
      </group>
      <CanvasLabel text="APAR" width={0.34} height={0.15} position={[11.88, 1.42, 2.6]} rotation={[0, -Math.PI / 2, 0]} background="#b91c1c" fontSize={70} />

      {/* CCTV kubah. */}
      <group position={[-10.6, 3.2, 9.2]}>
        <BuiltMeshes parts={parts.cctv} />
      </group>
      <group position={[9.8, 3.2, 3.1]}>
        <BuiltMeshes parts={parts.cctv} />
      </group>

      {/* Jam dinding (waktu permainan) — terlihat dari meja pelayanan & ruang tunggu. */}
      <WallClock position={[11.89, 2.55, 0.9]} rotation={-Math.PI / 2} />

      {/* Dokumen izin & jadwal praktik (fiktif) di dinding belakang meja. */}
      <group position={[-6.85, 1.62, -1.9]}>
        <BuiltMeshes parts={parts.frameA4} />
        <CanvasPlane draw={docs.sia} width={0.4} height={0.54} px={700} position={[0, 0, 0.021]} />
      </group>
      <group position={[-6.3, 1.62, -1.9]}>
        <BuiltMeshes parts={parts.frameA4} />
        <CanvasPlane draw={docs.sipa} width={0.4} height={0.54} px={700} position={[0, 0, 0.021]} />
      </group>
      <group position={[-5.62, 1.62, -1.9]}>
        <BuiltMeshes parts={parts.frameWide} />
        <CanvasPlane draw={docs.jadwal} width={0.56} height={0.4} px={600} position={[0, 0, 0.021]} />
      </group>

      {/* Stiker antre di lantai (posisi slot antrean). */}
      {[0, 1, 2, 3, 4].map((i) => {
        const [x, z] = queueSlot(i);
        return <FloorDecal key={i} texture={sticker} position={[x, 0.004, z + 0.02]} size={[0.62, 0.155]} />;
      })}

      {/* Keset di dalam pintu. */}
      <group position={[0, 0, 9.3]}>
        <BuiltMeshes parts={parts.mat} />
        <FloorDecal texture={doormat} position={[0, 0.0145, 0]} size={[1.64, 0.79]} />
      </group>

      {/* Hand sanitizer & tempat sampah di pintu masuk. */}
      <group position={[-1.8, 0, 9.45]}>
        <BuiltMeshes parts={parts.sanitizer} castShadow />
      </group>
      <CanvasLabel text="Hand Sanitizer" width={0.3} height={0.07} position={[-1.8, 1.27, 9.51]} background="#0e655b" fontSize={44} />
      <group position={[1.9, 0, 9.5]}>
        <BuiltMeshes parts={parts.bin} castShadow />
      </group>

      {/* Brosur edukasi di meja pelayanan. */}
      <group position={[-2.82, 1.04, 2.3]}>
        <BuiltMeshes parts={parts.brochure} />
        {leaflets.map((d, i) => (
          <CanvasPlane key={i} draw={d} width={0.1} height={0.15} px={1100} position={[(i - 1) * 0.074, 0.075 + i * 0.07, 0.03 - i * 0.045]} rotation={[-0.18, 0, 0]} />
        ))}
      </group>

      {/* Properti ruang belakang: hanya dirender bila ruang belakang dapat terlihat (BackRoomCull). */}
      <BackRoomCull>
        {/* Administrasi: lampu meja & kursi tamu di sudut. */}
        <Prop name="desk_lamp" position={[9.15, 0.75, -7.4]} rotation={-0.5} />
        <Prop name="arm_chair" position={[5.1, 0, -9.1]} rotation={0.6} />
        {/* Gudang: perlengkapan kebersihan & kardus di sudut. */}
        <Prop name="cleaner_5l" position={[-6.95, 0, -9.68]} rotation={0.2} />
        <Prop name="bleach" position={[-6.65, 0, -9.7]} rotation={-0.3} />
        <Prop name="cleaner" position={[-6.48, 0, -9.66]} rotation={0.4} />
        <Prop name="cardboard_box" position={[-10.45, 0, -9.5]} rotation={0.2} />
        <Prop name="cardboard_box" position={[-10.02, 0, -9.55]} rotation={-0.35} />
        <Prop name="cardboard_box" position={[-10.25, 0.335, -9.5]} rotation={0.9} />
      </BackRoomCull>

      {/* Peningkatan Dekorasi: sukulen di meja kasir & pelayanan. */}
      {decor >= 1 && (
        <>
          <Prop name="plant_succulent" position={[4.25, 1.04, 2.28]} rotation={0.6} />
          <Prop name="plant_succulent" position={[-0.95, 1.04, 2.3]} rotation={2.1} scale={0.9} />
        </>
      )}
    </group>
  );
}
