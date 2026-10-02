// Karakter Microsoft Rocketbox (MIT) → public/assets/characters/*.glb  (ART_DIRECTION.md §5)
// Pemakaian: node scripts/assets/characters.mjs [avatar...|--anims]
//
// - Avatar: FBX + tekstur TGA dari repositori resmi → GLB (WebP, meshopt). Satu SkinnedMesh, 3 material
//   (tubuh, kepala, rambut/bulu mata ber-alpha). Skala cm dipertahankan di rangka; node akar diberi skala 0,01.
// - Animasi: klip motion capture per gender → satu GLB per gender. Hanya rotasi tulang yang disimpan
//   (+ posisi akar) sehingga satu klip dapat dipakai semua avatar bergender sama tanpa merusak proporsi.
//   Gerak maju klip berjalan dihapus (in-place); kecepatan aslinya dicatat di manifest.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, join as joinPrimitives, meshopt, prune, resample, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { CACHE, GENERATED, PUBLIC_ASSETS, download, ensureDir, kb, writeJson } from './lib.mjs';

// ---------------------------------------------------------------- Lingkungan Node untuk loader three.js
globalThis.self ??= globalThis;
// Tekstur FBX tidak dipakai (diganti tekstur hasil olahan) — kembalikan tekstur kosong.
THREE.TextureLoader.prototype.load = function () {
  return new THREE.Texture();
};
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
};

const RB = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets';
const OUT = ensureDir(join(PUBLIC_ASSETS, 'characters'));
const RAW = ensureDir(join(CACHE, 'rocketbox'));

/** Avatar terpilih (alasan pemilihan: ART_DIRECTION.md §5). `group` = folder di repositori. */
export const AVATARS = {
  // Pegawai
  Medical_Female_01: { group: 'Professions', gender: 'f', use: 'Apoteker (jas putih)' },
  Medical_Male_01: { group: 'Professions', gender: 'm', use: 'Apoteker / avatar pemain (jas putih)' },
  Female_Adult_15: { group: 'Adults', gender: 'f', use: 'Kasir (kemeja biru)' },
  Male_Adult_08: { group: 'Adults', gender: 'm', use: 'Kasir (kemeja biru muda)' },
  Female_Adult_13: { group: 'Adults', gender: 'f', use: 'Petugas gudang (rompi)' },
  Male_Adult_11: { group: 'Adults', gender: 'm', use: 'Petugas gudang (kemeja kerja)' },
  Business_Female_01: { group: 'Professions', gender: 'f', use: 'Manajer / pasien' },
  Business_Male_06: { group: 'Professions', gender: 'm', use: 'Manajer (kemeja putih)' },
  Female_Adult_09: { group: 'Adults', gender: 'f', use: 'Asisten / pasien (kardigan)' },
  Male_Adult_01: { group: 'Adults', gender: 'm', use: 'Asisten / pasien (polo)' },
  // Pasien
  Female_Adult_06: { group: 'Adults', gender: 'f', use: 'Pasien lansia berjilbab' },
  Female_Adult_10: { group: 'Adults', gender: 'f', use: 'Pasien berjilbab' },
  Female_Adult_03: { group: 'Adults', gender: 'f', use: 'Pasien' },
  Female_Adult_05: { group: 'Adults', gender: 'f', use: 'Pasien' },
  Female_Adult_07: { group: 'Adults', gender: 'f', use: 'Pasien' },
  Female_Adult_12: { group: 'Adults', gender: 'f', use: 'Pasien (muda)' },
  Male_Adult_09: { group: 'Adults', gender: 'm', use: 'Pasien' },
  Male_Adult_10: { group: 'Adults', gender: 'm', use: 'Pasien (muda)' },
  Male_Adult_15: { group: 'Adults', gender: 'm', use: 'Pasien (baju koko & kopiah)' },
  Male_Adult_17: { group: 'Adults', gender: 'm', use: 'Pasien (muda)' },
  Male_Adult_04: { group: 'Adults', gender: 'm', use: 'Pasien' },
  Male_Adult_07: { group: 'Adults', gender: 'm', use: 'Pasien' },
  Male_Adult_03: { group: 'Adults', gender: 'm', use: 'Pasien lansia' },
  Male_Adult_05: { group: 'Adults', gender: 'm', use: 'Pasien lansia' },
  Male_Adult_14: { group: 'Adults', gender: 'm', use: 'Pasien (paruh baya)' },
};

/**
 * Varian warna busana untuk avatar berjilbab (Rocketbox hanya punya dua yang sesuai). Pewarnaan ulang
 * per piksel hanya pada rentang warna kain; kulit (hue jingga, terang) dan area mata dikecualikan.
 * - `dress`: geser hue gamis khaki (tekstur tubuh).
 * - `veil`: warnai jilbab/rumbai putih (tekstur kepala & opacity).
 * - `dye`: warnai kain hitam (abaya & tudung) dengan hue tertentu.
 */
export const VARIANTS = {
  Female_Adult_06: [
    { suffix: 'b', use: 'Pasien lansia berjilbab merah muda, gamis marun', dress: { hue: 345, sat: 0.95, val: 0.85 }, veil: '#f0c6d2' },
    { suffix: 'c', use: 'Pasien lansia berjilbab biru muda, gamis navy', dress: { hue: 218, sat: 0.9, val: 0.8 }, veil: '#c3d2e6' },
    { suffix: 'd', use: 'Pasien lansia berjilbab krem, gamis hijau sage', dress: { hue: 120, sat: 0.55, val: 0.95 }, veil: '#f1e4c6' },
  ],
  Female_Adult_10: [
    { suffix: 'b', use: 'Pasien berjilbab & abaya navy', dye: { hue: 220, sat: 0.5 } },
    { suffix: 'c', use: 'Pasien berjilbab & abaya marun', dye: { hue: 350, sat: 0.5 } },
    { suffix: 'd', use: 'Pasien berjilbab & abaya hijau tua', dye: { hue: 155, sat: 0.42 } },
  ],
};

/** Klip per status gameplay. `xy` = klip dengan gerak akar (dibuat in-place). */
export const CLIPS = {
  walk: { name: 'walk_neutral', folder: 'all_animations_max_motextr_xy' },
  idle: { name: 'idle_neutral_01', folder: 'all_animations_max_motextr_static' },
  wait: { name: 'idle_waiting_01', folder: 'all_animations_max_motextr_static' },
  angry: { name: 'idle_angry_01', folder: 'all_animations_max_motextr_static' },
  talk: { name: 'gestic_talk_neutral_01', folder: 'all_animations_max_motextr_static' },
  talk2: { name: 'gestic_talk_neutral_02', folder: 'all_animations_max_motextr_static' },
  sit: { name: 'sit_chair_idle_neutral_01', folder: 'all_animations_max_motextr_static' },
};

const TEX = {
  body: { color: 1024, normal: 512, roughness: 0.78 },
  head: { color: 512, normal: 256, roughness: 0.58 },
  opacity: { color: 512, roughness: 0.62 },
};

let treeCache = null;
/** Daftar berkas tekstur avatar dari GitHub tree API (di-cache di .asset-cache). */
async function textureFiles(group, name) {
  if (!treeCache) {
    const path = join(RAW, 'tree.json');
    try {
      treeCache = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      const res = await fetch('https://api.github.com/repos/microsoft/Microsoft-Rocketbox/git/trees/master?recursive=1');
      if (!res.ok) throw new Error(`GitHub tree API: HTTP ${res.status}`);
      treeCache = await res.json();
      writeFileSync(path, JSON.stringify(treeCache));
    }
  }
  const dir = `Assets/Avatars/${group}/${name}/Textures/`;
  return [...new Set(treeCache.tree.filter((e) => e.type === 'blob' && e.path.startsWith(dir) && !e.path.slice(dir.length).includes('/')).map((e) => e.path.slice(dir.length)))];
}

function parseFbx(path) {
  const buf = readFileSync(path);
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  // Lampu/kamera bawaan berkas 3ds Max tidak dipakai.
  const extras = [];
  root.traverse((o) => (o.isLight || o.isCamera) && extras.push(o));
  extras.forEach((o) => o.removeFromParent());
  return root;
}

async function exportGlb(input, animations = []) {
  const result = await new GLTFExporter().parseAsync(input, { binary: true, animations, onlyVisible: false });
  return new Uint8Array(result);
}

// ---------------------------------------------------------------- Varian warna

function rgb2hsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsv2rgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/** Pewarnaan ulang busana pada data RGBA mentah (lihat VARIANTS). Area mata di tekstur kepala dikecualikan. */
function recolorFor(variant, part) {
  if (!variant) return null;
  return (t) => {
    const d = t.data;
    const veil = variant.veil ? hex(variant.veil) : null;
    for (let i = 0, n = t.width * t.height; i < n; i++) {
      const o = i * 4;
      const u = (i % t.width) / t.width;
      const v01 = Math.floor(i / t.width) / t.height;
      if (part === 'head' && u < 0.45 && v01 > 0.62) continue; // bola mata & gigi
      const [h, sat, val] = rgb2hsv(d[o] / 255, d[o + 1] / 255, d[o + 2] / 255);
      let out = null;
      if (part === 'body' && variant.dress && h >= 32 && h <= 75 && sat > 0.15 && val > 0.12) {
        out = hsv2rgb(variant.dress.hue, Math.min(1, sat * variant.dress.sat), Math.min(1, val * variant.dress.val));
      } else if ((part === 'head' || part === 'opacity') && veil && sat < 0.18 && val > 0.5) {
        out = [(d[o] / 255) * veil[0], (d[o + 1] / 255) * veil[1], (d[o + 2] / 255) * veil[2]];
      } else if ((part === 'body' || part === 'head') && variant.dye && val < 0.32 && sat < 0.4) {
        out = hsv2rgb(variant.dye.hue, Math.max(sat, variant.dye.sat), Math.min(1, val * 1.9 + 0.03));
      }
      if (out) {
        d[o] = Math.round(out[0] * 255);
        d[o + 1] = Math.round(out[1] * 255);
        d[o + 2] = Math.round(out[2] * 255);
      }
    }
  };
}

/** TGA → RGBA mentah (baris atas dulu). */
function readTga(path) {
  const buf = readFileSync(path);
  const t = new TGALoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return { data: Buffer.from(t.data.buffer, t.data.byteOffset, t.data.byteLength), width: t.width, height: t.height };
}

async function webp(path, size, { alpha = false, quality = 82, transform = null } = {}) {
  const t = readTga(path);
  if (transform) transform(t);
  let img = sharp(t.data, { raw: { width: t.width, height: t.height, channels: 4 } });
  // Data TGALoader sudah berurutan baris atas dulu (seperti gambar biasa) — tidak perlu dibalik;
  // orientasi glTF dipenuhi dengan membalik V pada geometri.
  img = img.resize(size, size, { fit: 'fill' });
  if (!alpha) img = img.removeAlpha();
  return img.webp({ quality, alphaQuality: 90 }).toBuffer();
}

function newIO() {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
}

// ---------------------------------------------------------------- Avatar

async function buildAvatar(name, spec, variant = null) {
  const outName = variant ? `${name}_${variant.suffix}` : name;
  const dir = ensureDir(join(RAW, name));
  const base = `${RB}/Avatars/${spec.group}/${name}`;
  const fbx = await download(`${base}/Export/${name}.fbx`, join(dir, `${name}.fbx`));
  const root = parseFbx(fbx);
  let mesh = null;
  root.traverse((o) => {
    if (o.isSkinnedMesh && !mesh) mesh = o;
  });
  if (!mesh) throw new Error(`${name}: SkinnedMesh tidak ditemukan`);
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const prefix = mats[0].name.split('_')[0]; // mis. f152
  // Material baru tanpa tekstur (tekstur dipasang di tahap gltf-transform).
  const kind = (m) => (m.name.endsWith('_opacity') ? 'opacity' : m.name.endsWith('_head') ? 'head' : 'body');
  mesh.material = mats.map((m) => new THREE.MeshStandardMaterial({ name: kind(m) }));
  // UV FBX berasal dari bawah-kiri; glTF dari atas-kiri → balik V agar gambar tekstur tetap tegak.
  const uv = mesh.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  // Buang atribut yang tidak dipakai.
  for (const a of Object.keys(mesh.geometry.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(a)) mesh.geometry.deleteAttribute(a);
  // Hapus objek non-rangka lain (mis. "Bip01_Footsteps") agar berkas ramping.
  root.scale.setScalar(0.01);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const height = box.max.y - box.min.y;
  const hip = root.getObjectByName('Bip01')?.position.y ?? 0;
  const tris = mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3;
  const glb = await exportGlb(root);

  // Tekstur — nama berkas diambil dari daftar isi repositori (prefiks material tidak selalu sama).
  const files = await textureFiles(spec.group, name);
  const get = async (suffix) => {
    const f = files.find((n) => n.endsWith(suffix));
    return f ? download(`${base}/Textures/${f}`, join(dir, f)) : null;
  };
  const tex = {};
  for (const part of ['body', 'head']) {
    const color = await get(`_${part}_color.tga`);
    const normal = await get(`_${part}_normal.tga`);
    if (!color) throw new Error(`${name}: tekstur ${part} tidak ditemukan (${prefix})`);
    tex[part] = { color: await webp(color, TEX[part].color, { transform: recolorFor(variant, part) }), normal: normal ? await webp(normal, TEX[part].normal, { quality: 88 }) : null };
  }
  const opacity = await get('_opacity_color.tga');
  // Avatar berambut pendek tidak punya kartu rambut ber-alpha.
  if (opacity) tex.opacity = { color: await webp(opacity, TEX.opacity.color, { alpha: true, transform: recolorFor(variant, 'opacity') }) };

  const io = newIO();
  const doc = await io.readBinary(glb);
  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const mat of doc.getRoot().listMaterials()) {
    const k = mat.getName();
    const t = tex[k];
    if (!t) {
      // Material tanpa tekstur (mis. slot rambut kosong) → buang primitifnya.
      for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMaterial() === mat) prim.dispose();
      continue;
    }
    const color = doc.createTexture(`${name}_${k}_color`).setImage(t.color).setMimeType('image/webp');
    mat.setBaseColorTexture(color).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(TEX[k].roughness);
    if (t.normal) mat.setNormalTexture(doc.createTexture(`${name}_${k}_normal`).setImage(t.normal).setMimeType('image/webp'));
    if (k === 'opacity') mat.setAlphaMode('MASK').setAlphaCutoff(0.35).setDoubleSided(true);
  }
  // Hanya simpul rangka yang benar-benar dipakai skin; sisanya (Footsteps) dibuang.
  const joints = new Set(doc.getRoot().listSkins().flatMap((sk) => sk.listJoints()));
  for (const node of doc.getRoot().listNodes()) if (/Footsteps/.test(node.getName()) && !joints.has(node)) node.dispose();
  await doc.transform(dedup(), joinPrimitives(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = join(OUT, `${outName}.glb`);
  await io.write(out, doc);
  const bytes = statSync(out).size;
  console.log(`${outName.padEnd(20)} ${tris.toFixed(0).padStart(6)} segitiga  tinggi ${height.toFixed(2)} m  ${kb(bytes).padStart(7)}`);
  return { file: `characters/${outName}.glb`, gender: spec.gender, use: variant ? variant.use : spec.use, height: +height.toFixed(3), hip: +hip.toFixed(2), tris, bytes, source: `${RB.replace('raw.githubusercontent.com', 'github.com').replace('/master/', '/tree/master/')}/Avatars/${spec.group}/${name}` };
}

// ---------------------------------------------------------------- Animasi

/** Kecepatan maju asli klip (m/s) & sumbu maju; lalu gerak maju dihapus (tren linier). */
function makeInPlace(clip) {
  const track = clip.tracks.find((t) => t.name === 'Bip01.position');
  if (!track) return { speed: 0, forward: [0, 0, 1] };
  const v = track.values;
  const n = track.times.length;
  const dx = v[(n - 1) * 3] - v[0];
  const dz = v[(n - 1) * 3 + 2] - v[2];
  const dur = track.times[n - 1] - track.times[0];
  const dist = Math.hypot(dx, dz);
  for (let i = 0; i < n; i++) {
    const t = (track.times[i] - track.times[0]) / (dur || 1);
    v[i * 3] -= dx * t;
    v[i * 3 + 2] -= dz * t;
  }
  return { speed: dist / 100 / (dur || 1), forward: [dx / (dist || 1), 0, dz / (dist || 1)] };
}

/** Tulang wajah (tanpa data motion capture yang berarti) tidak dianimasikan. */
const FACE = /(Eye|Jaw|Lip|lip|Tongue|Mouth|Masseter|Caninus|Cheek|Eyebrow|Nose)/;

/** Simpan hanya rotasi tulang yang ada di avatar (+ posisi akar); buang skala, wajah, Nub, Footsteps. */
function cleanTracks(clip, keepBones) {
  clip.tracks = clip.tracks.filter((t) => {
    const [node, prop] = [t.name.slice(0, t.name.lastIndexOf('.')), t.name.slice(t.name.lastIndexOf('.') + 1)];
    if (!keepBones.has(node) || FACE.test(node)) return false;
    if (prop === 'quaternion') return true;
    return prop === 'position' && node === 'Bip01';
  });
  return clip;
}

/** Pusatkan posisi akar (rata-rata X/Z = 0) agar avatar berdiri tepat di titik posisinya di game. */
function centerRoot(clip) {
  const t = clip.tracks.find((tr) => tr.name === 'Bip01.position');
  if (!t) return;
  const v = t.values;
  const n = v.length / 3;
  let mx = 0;
  let mz = 0;
  for (let i = 0; i < n; i++) {
    mx += v[i * 3] / n;
    mz += v[i * 3 + 2] / n;
  }
  for (let i = 0; i < n; i++) {
    v[i * 3] -= mx;
    v[i * 3 + 2] -= mz;
  }
}

/** Sampling ulang trek ke fps tetap (klip diam bergerak lambat → 15 fps cukup). */
function downsample(clip, fps) {
  clip.tracks = clip.tracks.map((t) => {
    const n = Math.max(2, Math.round(clip.duration * fps) + 1);
    const times = new Float32Array(n);
    const size = t.getValueSize();
    const values = new Float32Array(n * size);
    const interp = t.createInterpolant();
    for (let i = 0; i < n; i++) {
      times[i] = Math.min(clip.duration, i / fps);
      values.set(interp.evaluate(times[i]), i * size);
    }
    return new t.constructor(t.name, times, values);
  });
  return clip;
}

async function buildAnims(gender, keepBones) {
  const clips = [];
  const meta = {};
  let skeletonRoot = null;
  for (const [key, c] of Object.entries(CLIPS)) {
    const file = `${gender}_${c.name}.max.fbx`;
    const path = await download(`${RB}/Animations/${c.folder}/${file}`, join(RAW, 'anims', file));
    const root = parseFbx(path);
    const clip = root.animations[0];
    clip.name = key;
    const motion = c.folder.endsWith('_xy') ? makeInPlace(clip) : { speed: 0 };
    cleanTracks(clip, keepBones);
    centerRoot(clip);
    if (key !== 'walk') downsample(clip, 15);
    clips.push(clip);
    skeletonRoot ??= root;
    meta[key] = { source: c.name, duration: +clip.duration.toFixed(3), speed: +motion.speed.toFixed(3), ...(motion.forward ? { forward: motion.forward.map((x) => +x.toFixed(3)) } : {}) };
  }
  // Hanya rangka (tanpa mesh) sebagai sasaran klip.
  const hip = skeletonRoot.getObjectByName('Bip01')?.position.y ?? 0;
  const glb = await exportGlb(skeletonRoot, clips);
  const io = newIO();
  const doc = await io.readBinary(glb);
  await doc.transform(resample({ tolerance: 4e-4 }), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = join(OUT, `anim-${gender}.glb`);
  await io.write(out, doc);
  const bytes = statSync(out).size;
  console.log(`anim-${gender}.glb  ${clips.length} klip  ${kb(bytes)}`);
  return { file: `characters/anim-${gender}.glb`, hip: +hip.toFixed(2), bytes, clips: meta };
}

// ---------------------------------------------------------------- Main

const args = process.argv.slice(2);
const manifestPath = join(GENERATED, 'characters.json');
let manifest = { avatars: {}, anims: {} };
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch {
  /* manifest baru */
}
const onlyAnims = args.includes('--anims');
const names = args.filter((a) => !a.startsWith('--'));
let keepBones = null;
if (!onlyAnims) {
  for (const [name, spec] of Object.entries(AVATARS)) {
    if (names.length && !names.includes(name)) continue;
    manifest.avatars[name] = await buildAvatar(name, spec);
    for (const v of VARIANTS[name] ?? []) manifest.avatars[`${name}_${v.suffix}`] = await buildAvatar(name, spec, v);
    // Simpan manifest setiap avatar selesai agar kegagalan di tengah tidak menghapus hasil sebelumnya.
    writeJson(manifestPath, manifest);
  }
}
if (onlyAnims || !names.length) {
  // Tulang yang dipakai avatar (rangka Rocketbox sama untuk semua avatar).
  const ref = parseFbx(join(RAW, Object.keys(manifest.avatars)[0] ?? 'Medical_Female_01', `${Object.keys(manifest.avatars)[0] ?? 'Medical_Female_01'}.fbx`));
  keepBones = new Set();
  ref.traverse((o) => o.isBone && keepBones.add(o.name));
  for (const g of ['f', 'm']) manifest.anims[g] = await buildAnims(g, keepBones);
}
manifest.license = { name: 'MIT', holder: 'Copyright (c) 2020 Microsoft', source: 'https://github.com/microsoft/Microsoft-Rocketbox' };
writeJson(manifestPath, manifest);
writeFileSync(
  join(OUT, 'LICENSE-Rocketbox.txt'),
  `Microsoft Rocketbox Avatar Library — https://github.com/microsoft/Microsoft-Rocketbox
Avatar & animasi di folder ini dikonversi (FBX/TGA → GLB/WebP, ukuran tekstur diperkecil,
klip berjalan dibuat in-place) oleh pipeline scripts/assets/characters.mjs.

MIT License

Copyright (c) 2020 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
);
