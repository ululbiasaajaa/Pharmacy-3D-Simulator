// Pemeriksaan hasil pipeline aset: setiap berkas yang dirujuk manifest benar-benar ada di public/assets,
// berlisensi CC0/MIT, dan dalam anggaran (ART_DIRECTION.md §3). Dijalankan oleh Vitest (lingkungan Node).
// @vitest-environment node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_ASSETS } from './lib.mjs';
import textures from '../../src/game/assets/generated/textures.json' with { type: 'json' };
import characters from '../../src/game/assets/generated/characters.json' with { type: 'json' };
import models from '../../src/game/assets/generated/models.json' with { type: 'json' };

describe('Aset hasil pipeline (scripts/assets)', () => {
  it('setiap tekstur foto punya albedo, normal, dan ORM di semua ukuran', () => {
    for (const [key, t] of Object.entries(textures)) {
      expect(t.license).toBe('CC0-1.0');
      expect(t.meters).toBeGreaterThan(0);
      for (const size of t.sizes) for (const kind of ['albedo', 'normal', 'orm']) expect(existsSync(join(PUBLIC_ASSETS, 'textures', key, `${size}-${kind}.webp`))).toBe(true);
    }
  });

  it('setiap avatar & pustaka animasi ada, dengan klip untuk semua status gameplay, dan lisensi MIT disertakan', () => {
    for (const a of Object.values(characters.avatars)) {
      expect(existsSync(join(PUBLIC_ASSETS, a.file))).toBe(true);
      expect(a.tris).toBeLessThanOrEqual(10000);
    }
    for (const g of ['f', 'm']) {
      const anim = characters.anims[g];
      expect(existsSync(join(PUBLIC_ASSETS, anim.file))).toBe(true);
      expect(Object.keys(anim.clips).sort()).toEqual(['angry', 'idle', 'sit', 'talk', 'talk2', 'wait', 'walk']);
      expect(anim.clips.walk.speed).toBeGreaterThan(0.8);
    }
    expect(characters.license.name).toBe('MIT');
    expect(existsSync(join(PUBLIC_ASSETS, 'characters', 'LICENSE-Rocketbox.txt'))).toBe(true);
  });

  it('setiap model properti CC0 ada dan dalam anggaran segitiga', () => {
    for (const m of Object.values(models)) {
      expect(m.license).toBe('CC0-1.0');
      expect(existsSync(join(PUBLIC_ASSETS, m.file))).toBe(true);
      expect(m.triangles).toBeLessThanOrEqual(15000);
    }
  });
});
