// Tekstur foto PBR (CC0, ambientCG) → public/assets/textures/<kunci>/<ukuran>-{albedo,normal,orm}.webp
// Pemakaian: node scripts/assets/textures.mjs [kunci...]
// ORM dipadatkan: R = ambient occlusion, G = roughness, B = metalness (konvensi glTF/three.js).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { CACHE, GENERATED, PUBLIC_ASSETS, download, ensureDir, kb, unzip, writeJson } from './lib.mjs';

/**
 * Sumber tekstur. `meters` = lebar dunia (m) yang ditutup satu salinan tekstur; dipilih agar
 * nat ubin/panel jatuh pada grid bangunan (60 cm) — lihat ART_DIRECTION.md §6.
 * `contrast` (< 1) meratakan variasi albedo (noda/belang) di sekitar warna rata-rata agar
 * permukaan interior tampak bersih tanpa kehilangan detail.
 */
export const TEXTURES = {
  tile: { id: 'Tiles040', meters: 4.8, contrast: 0.8, use: 'Lantai area pelanggan' },
  plaster: { id: 'Plaster001', meters: 2.5, contrast: 0.35, use: 'Dinding interior' },
  ceiling: { id: 'OfficeCeiling001', meters: 3.6, use: 'Plafon panel akustik' },
  wood: { id: 'Wood058', meters: 1.2, use: 'Panel HPL kayu' },
  brushed: { id: 'Metal009', meters: 0.8, use: 'Stainless & aluminium sikat' },
  fabric: { id: 'Fabric030', meters: 0.5, use: 'Kain dudukan kursi' },
  leather: { id: 'Leather026', meters: 0.6, use: 'Kulit sintetis kursi kantor' },
  paving: { id: 'PavingStones099', meters: 2.2, use: 'Paving block parkir' },
  tactile: { id: 'TactilePaving003', meters: 1.8, use: 'Ubin pemandu trotoar' },
  asphalt: { id: 'Asphalt025A', meters: 4, use: 'Aspal jalan' },
  concrete: { id: 'Concrete033', meters: 3, use: 'Beton kanstin & teras' },
  facade: { id: 'PaintedPlaster017', meters: 3, contrast: 0.6, use: 'Plester fasad ruko' },
  brick: { id: 'Bricks101', meters: 1.6, use: 'Bata ekspos fasad ruko' },
  stone: { id: 'Tiles143', meters: 1.8, contrast: 0.8, use: 'Batu alam tempel (fasad ruko)' },
  corrugated: { id: 'CorrugatedSteel005', meters: 2.0, use: 'Seng gelombang atap & kanopi' },
  planks: { id: 'Planks037A', meters: 1.6, use: 'Papan kayu pintu lipat & warung' },
};

const SIZES = [512, 1024];

function find(dir, suffix) {
  const f = readdirSync(dir).find((n) => n.toLowerCase().endsWith(suffix.toLowerCase()));
  return f ? join(dir, f) : null;
}

async function grey(path, size, fallback) {
  if (!path) return Buffer.alloc(size * size, fallback);
  return sharp(path).resize(size, size, { fit: 'fill' }).greyscale().raw().toBuffer();
}

async function build(key, spec) {
  const zip = await download(`https://ambientcg.com/get?file=${spec.id}_1K-JPG.zip`, join(CACHE, 'ambientcg', `${spec.id}_1K-JPG.zip`));
  const dir = join(CACHE, 'ambientcg', spec.id);
  unzip(zip, dir);
  const color = find(dir, '_Color.jpg');
  const normal = find(dir, '_NormalGL.jpg');
  const rough = find(dir, '_Roughness.jpg');
  const ao = find(dir, '_AmbientOcclusion.jpg');
  const metal = find(dir, '_Metalness.jpg');
  if (!color || !normal || !rough) throw new Error(`${spec.id}: peta warna/normal/roughness tidak lengkap`);
  const out = ensureDir(join(PUBLIC_ASSETS, 'textures', key));
  const bytes = {};
  for (const size of SIZES) {
    const a = join(out, `${size}-albedo.webp`);
    let img = sharp(color).resize(size, size, { fit: 'fill' });
    if (spec.contrast !== undefined) {
      const { channels } = await sharp(color).stats();
      const c = spec.contrast;
      img = img.linear([c, c, c], channels.slice(0, 3).map((ch) => ch.mean * (1 - c)));
    }
    await img.webp({ quality: 82 }).toFile(a);
    const n = join(out, `${size}-normal.webp`);
    await sharp(normal).resize(size, size, { fit: 'fill' }).webp({ quality: 88 }).toFile(n);
    const [r, g, b] = await Promise.all([grey(ao, size, 255), grey(rough, size, 200), grey(metal, size, 0)]);
    const orm = Buffer.alloc(size * size * 3);
    for (let i = 0; i < size * size; i++) {
      orm[i * 3] = r[i];
      orm[i * 3 + 1] = g[i];
      orm[i * 3 + 2] = b[i];
    }
    const o = join(out, `${size}-orm.webp`);
    await sharp(orm, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 90 }).toFile(o);
    bytes[size] = statSync(a).size + statSync(n).size + statSync(o).size;
  }
  console.log(`${key.padEnd(9)} ${spec.id.padEnd(18)} 512: ${kb(bytes[512]).padStart(7)}   1024: ${kb(bytes[1024]).padStart(7)}`);
  return { source: 'ambientCG', id: spec.id, license: 'CC0-1.0', url: `https://ambientcg.com/a/${spec.id}`, meters: spec.meters, use: spec.use, sizes: SIZES, metal: !!metal, bytes };
}

const only = process.argv.slice(2);
const manifest = {};
for (const [key, spec] of Object.entries(TEXTURES)) {
  if (only.length && !only.includes(key)) continue;
  manifest[key] = await build(key, spec);
}
if (!only.length) writeJson(join(GENERATED, 'textures.json'), manifest);
else console.log('(subset: manifest tidak ditulis ulang)');
