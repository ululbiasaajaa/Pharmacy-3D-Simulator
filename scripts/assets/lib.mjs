// Utilitas bersama pipeline aset (lihat ART_DIRECTION.md §3).
// Berkas mentah diunduh ke .asset-cache/ (diabaikan git); hasil optimasi ditulis ke public/assets/.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE = join(ROOT, '.asset-cache');
export const PUBLIC_ASSETS = join(ROOT, 'public', 'assets');
export const GENERATED = join(ROOT, 'src', 'game', 'assets', 'generated');

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Unduh sekali (cache berdasarkan path tujuan); ulangi hingga 3 kali bila jaringan gagal. */
export async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) return dest;
  ensureDir(dirname(dest));
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} untuk ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 64) throw new Error(`Berkas terlalu kecil (${buf.length} B) dari ${url}`);
      writeFileSync(dest, buf);
      return dest;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} untuk ${url}`);
  return res.json();
}

/** Ekstrak zip ke folder (tanpa alat eksternal). Mengembalikan daftar nama berkas. */
export function unzip(zipPath, dir) {
  ensureDir(dir);
  const files = unzipSync(new Uint8Array(readFileSync(zipPath)));
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith('/')) continue;
    const out = join(dir, name);
    ensureDir(dirname(out));
    writeFileSync(out, data);
  }
  return Object.keys(files);
}

export function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function writeJson(path, data) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
