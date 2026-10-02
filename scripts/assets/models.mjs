// Model properti Poly Haven (CC0) → public/assets/models/<kunci>.glb  (ART_DIRECTION.md §3–§4)
// Pemakaian: node scripts/assets/models.mjs [kunci...]   |   node scripts/assets/models.mjs --inspect <polyhavenId...>
// Optimasi: buang node yang tidak dipakai, simplify (meshopt), tekstur → WebP ≤ `tex` px, kompresi meshopt.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, getBounds, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { CACHE, GENERATED, PUBLIC_ASSETS, download, ensureDir, fetchJson, kb, writeJson } from './lib.mjs';

/**
 * `ratio` = target simplify (1 = tanpa simplify); `error` = toleransi simplify (daun boleh lebih kasar). `keep` = regex nama node yang dipertahankan
 * (model Poly Haven sering berisi beberapa varian dalam satu berkas). `tex` = ukuran tekstur maks.
 * Tidak dipakai: APAR Poly Haven (alasnya bertuliskan huruf Korea), lampu jalan & tempat sampah
 * (gaya Eropa) — tidak sesuai konteks kota kecil Indonesia; rolling door (satu daun 1,08 m, tidak
 * cocok untuk bukaan ruko ±6,6 m tanpa merentangkan tekstur).
 */
export const MODELS = {
  plant_taro: { id: 'potted_plant_02', ratio: 0.15, error: 0.03, tex: 1024, use: 'Tanaman keladi di pot (ruang tunggu)' },
  plant_tree: { id: 'potted_plant_01', ratio: 0.07, error: 0.03, tex: 1024, use: 'Tanaman pot tinggi (sudut ruangan)' },
  plant_succulent: { id: 'potted_plant_04', ratio: 1, tex: 512, use: 'Sukulen kecil (meja)' },
  monobloc_chair: { id: 'plastic_monobloc_chair_01', ratio: 1, tex: 512, use: 'Kursi plastik (ruang staf, teras tetangga)' },
  cardboard_box: { id: 'cardboard_box_01', ratio: 0.08, tex: 512, use: 'Kardus (gudang)' },
  ceiling_fan: { id: 'ceiling_fan', ratio: 0.35, tex: 512, use: 'Kipas plafon (ruang staf)' },
  arm_chair: { id: 'modern_arm_chair_01', ratio: 0.6, tex: 512, use: 'Kursi kantor/tamu (administrasi)' },
  desk_lamp: { id: 'desk_lamp_arm_01', ratio: 0.3, tex: 512, use: 'Lampu meja (administrasi)' },
  cleaner_5l: { id: 'multi_cleaner_5_litre', ratio: 0.5, tex: 256, use: 'Jeriken pembersih (gudang)' },
  bleach: { id: 'bleach_bottle', ratio: 0.5, tex: 256, use: 'Botol pembersih (gudang)' },
  cleaner: { id: 'all_purpose_cleaner', ratio: 0.5, tex: 256, use: 'Botol pembersih (gudang)' },
  ac_outdoor: { id: 'exterior_aircon_unit', keep: '^exterior_aircon_unit$', ratio: 0.4, tex: 512, use: 'Unit AC luar (fasad ruko)' },
  chalkboard: { id: 'standing_chalkboard_01', ratio: 1, tex: 512, use: 'Papan berdiri di teras' },
  utility_box: { id: 'utility_box_02', ratio: 0.6, tex: 512, use: 'Panel listrik di trotoar' },
  cafe_set: { id: 'outdoor_table_chair_set_01', ratio: 0.6, tex: 512, use: 'Meja-kursi teras kedai kopi' },
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

async function fetchGltf(id) {
  const files = await fetchJson(`https://api.polyhaven.com/files/${id}`);
  const g = files.gltf['1k'].gltf;
  const dir = join(CACHE, 'polyhaven', id);
  const main = await download(g.url, join(dir, `${id}.gltf`));
  for (const [rel, f] of Object.entries(g.include)) await download(f.url, join(dir, rel));
  return main;
}

function triangles(doc) {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      t += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    }
  return t;
}

async function inspect(id) {
  const doc = await io.read(await fetchGltf(id));
  for (const n of doc.getRoot().listNodes()) console.log('node', JSON.stringify(n.getName()), n.getMesh() ? `mesh=${n.getMesh().getName()}` : '');
  for (const m of doc.getRoot().listMaterials()) console.log('material', m.getName());
  console.log('triangles', triangles(doc));
}

async function build(key, spec) {
  const doc = await io.read(await fetchGltf(spec.id));
  const before = triangles(doc);
  if (spec.keep) {
    const re = new RegExp(spec.keep);
    for (const n of doc.getRoot().listNodes()) if (n.getMesh() && !re.test(n.getName())) n.dispose();
  }
  await doc.transform(
    prune(),
    dedup(),
    weld(),
    ...(spec.ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio: spec.ratio, error: spec.error ?? 0.002, lockBorder: !spec.error })] : []),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [spec.tex, spec.tex], quality: 82 }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const scene = doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const out = join(ensureDir(join(PUBLIC_ASSETS, 'models')), `${key}.glb`);
  await io.write(out, doc);
  const bytes = statSync(out).size;
  const after = triangles(doc);
  const size = max.map((v, i) => +(v - min[i]).toFixed(3));
  console.log(`${key.padEnd(18)} ${spec.id.padEnd(30)} ${String(before).padStart(7)} → ${String(after).padStart(6)} segitiga  ${kb(bytes).padStart(7)}  ukuran ${size.join(' × ')} m`);
  return { source: 'Poly Haven', id: spec.id, license: 'CC0-1.0', url: `https://polyhaven.com/a/${spec.id}`, use: spec.use, file: `models/${key}.glb`, triangles: after, bytes, min: min.map((v) => +v.toFixed(3)), max: max.map((v) => +v.toFixed(3)) };
}

const args = process.argv.slice(2);
if (args[0] === '--inspect') {
  for (const id of args.slice(1)) {
    console.log(`== ${id}`);
    await inspect(id);
  }
} else {
  const path = join(GENERATED, 'models.json');
  let manifest = {};
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    manifest = {};
  }
  for (const [key, spec] of Object.entries(MODELS)) {
    if (args.length && !args.includes(key)) continue;
    manifest[key] = await build(key, spec);
  }
  writeJson(path, manifest);
}
