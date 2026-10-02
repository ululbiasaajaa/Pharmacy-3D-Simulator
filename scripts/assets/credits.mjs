// Menyusun ASSET_CREDITS.md dari manifest pipeline (src/game/assets/generated/*.json).
// Pemakaian: node scripts/assets/credits.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATED, ROOT } from './lib.mjs';

const read = (name) => JSON.parse(readFileSync(join(GENERATED, name), 'utf8'));
const textures = read('textures.json');
const characters = read('characters.json');
const models = read('models.json');
const kb = (b) => `${Math.round(b / 1024)} KB`;

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const texBytes = (size) => sum(Object.values(textures).map((t) => t.bytes[size] ?? 0));
const avatarBytes = sum(Object.values(characters.avatars).map((a) => a.bytes));
const animBytes = sum(Object.values(characters.anims).map((a) => a.bytes));
const modelBytes = sum(Object.values(models).map((m) => m.bytes));

const lines = [];
lines.push('# Kredit & Lisensi Aset — Pharmacy 3D Simulator');
lines.push('');
lines.push('_Berkas ini dibuat otomatis oleh `node scripts/assets/credits.mjs` dari manifest pipeline aset. Jangan diedit manual._');
lines.push('');
lines.push('Semua aset pihak ketiga berlisensi terbuka yang mengizinkan pemakaian, modifikasi, dan distribusi ulang (CC0 atau MIT). Tidak ada aset berbayar. Aset diunduh dari sumber resmi lalu dioptimasi oleh skrip di `scripts/assets/` (lihat [ART_DIRECTION.md §3](ART_DIRECTION.md#3-strategi--pipeline-aset)).');
lines.push('');
lines.push('| Kelompok | Sumber | Lisensi | Ukuran unduhan |');
lines.push('|---|---|---|---|');
lines.push(`| Karakter (${Object.keys(characters.avatars).length} avatar) + animasi | Microsoft Rocketbox | MIT | ${kb(avatarBytes)} + ${kb(animBytes)} |`);
lines.push(`| Properti (${Object.keys(models).length} model) | Poly Haven | CC0 1.0 | ${kb(modelBytes)} |`);
lines.push(`| Tekstur foto PBR (${Object.keys(textures).length} set) | ambientCG | CC0 1.0 | ${kb(texBytes(512))} (512 px) / ${kb(texBytes(1024))} (1024 px) |`);
lines.push('');

lines.push('## Microsoft Rocketbox Avatar Library (MIT)');
lines.push('');
lines.push(`Sumber: <${characters.license.source}> — ${characters.license.holder}. Teks lisensi lengkap disertakan di \`public/assets/characters/LICENSE-Rocketbox.txt\`.`);
lines.push('');
lines.push('**Modifikasi:**');
lines.push('- FBX dikonversi ke GLB.');
lines.push('- Tekstur TGA 2048 px diperkecil menjadi WebP 256–1024 px.');
lines.push('- Geometri dikompresi meshopt.');
lines.push('- Klip animasi: tulang wajah dibuang, klip diam diturunkan ke 15 fps, klip berjalan dibuat di tempat (in-place), posisi akar dipusatkan.');
lines.push('');
lines.push('| Avatar | Dipakai untuk | Segitiga | Ukuran |');
lines.push('|---|---|---|---|');
for (const [name, a] of Object.entries(characters.avatars)) lines.push(`| [${name}](${a.source}) | ${a.use} | ${a.tris.toLocaleString('id-ID')} | ${kb(a.bytes)} |`);
lines.push('');
lines.push('| Klip | Animasi Rocketbox (`f_`/`m_`) |');
lines.push('|---|---|');
for (const [key, c] of Object.entries(characters.anims.f.clips)) lines.push(`| ${key} | \`${c.source}\` |`);
lines.push('');

lines.push('## Poly Haven (CC0 1.0)');
lines.push('');
lines.push('**Modifikasi:** varian yang tidak dipakai dibuang, mesh disederhanakan (meshopt), tekstur diubah ke WebP ≤ 1024 px, dan geometri dikompresi meshopt.');
lines.push('');
lines.push('| Kunci | Model | Dipakai untuk | Segitiga | Ukuran |');
lines.push('|---|---|---|---|---|');
for (const [key, m] of Object.entries(models)) lines.push(`| ${key} | [${m.id}](${m.url}) | ${m.use} | ${m.triangles.toLocaleString('id-ID')} | ${kb(m.bytes)} |`);
lines.push('');

lines.push('## ambientCG (CC0 1.0)');
lines.push('');
lines.push('**Modifikasi:** diperkecil ke 512/1024 px (WebP), AO/roughness/metalness dipadatkan ke satu peta ORM, dan kontras albedo diratakan pada sebagian tekstur (dinding, lantai, fasad) agar tampak bersih.');
lines.push('');
lines.push('| Kunci | Tekstur | Dipakai untuk | Ukuran fisik |');
lines.push('|---|---|---|---|');
for (const [key, t] of Object.entries(textures)) lines.push(`| ${key} | [${t.id}](${t.url}) | ${t.use} | ${t.meters} m |`);
lines.push('');

lines.push('## Aset buatan sendiri');
lines.push('');
lines.push('Dibuat di dalam kode repositori ini, tanpa aset luar:');
lines.push('- arsitektur dan perabot apotek (gondola, meja pelayanan, etalase, lemari resep, kulkas, lab, gudang);');
lines.push('- kemasan produk dari katalog;');
lines.push('- signage, poster, dan dokumen fiktif;');
lines.push('- APAR, CCTV, jam dinding, hand sanitizer;');
lines.push('- pohon ketapang (kartu daun digambar di kanvas) dan motor matik;');
lines.push('- tekstur prosedural cadangan;');
lines.push('- karakter prosedural cadangan;');
lines.push('- audio.');
lines.push('');
writeFileSync(join(ROOT, 'ASSET_CREDITS.md'), lines.join('\n'));
console.log('ASSET_CREDITS.md ditulis.');
