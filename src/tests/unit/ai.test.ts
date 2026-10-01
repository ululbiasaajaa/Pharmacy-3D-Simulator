import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkAiAvailable,
  localReview,
  localTutorHint,
  patientLine,
  performanceReview,
  resetAiAvailability,
  sanitizeAiText,
  setAiEnabled,
} from '@/services/ai/aiService';
import { spawnPatient } from '@/domain/patients';
import { closeDay } from '@/domain/simulation';
import { newState } from '../helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  setAiEnabled(false);
  resetAiAvailability();
});

describe('Layanan AI opsional', () => {
  it('pemeriksaan proxy: tersedia hanya bila /health menjawab ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, model: 'x' }) }));
    expect(await checkAiAvailable()).toBe(true);
    // Hosting statis tanpa proxy (mis. Vercel) menjawab 404.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    expect(await checkAiAvailable()).toBe(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await checkAiAvailable()).toBe(false);
  });

  it('tidak memanggil AI bila proxy tidak tersedia walau pengaturan AI aktif', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    await checkAiAvailable();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    setAiEnabled(true);
    const s = newState('career', { open: true });
    closeDay(s);
    expect((await performanceReview(s.reports[0])).source).toBe('local');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('memakai teks lokal bila AI dimatikan (tanpa memanggil jaringan)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const s = newState('career', { open: true });
    const p = spawnPatient(s, { category: 'otc', symptom: 'maag' })!;
    const r = await patientLine(s, p);
    expect(r.source).toBe('local');
    expect(r.text).toMatch(/perih|maag/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('jatuh ke teks lokal bila proxy gagal', async () => {
    setAiEnabled(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const s = newState('career', { open: true });
    closeDay(s);
    const r = await performanceReview(s.reports[0]);
    expect(r.source).toBe('local');
    expect(r.text).toBe(localReview(s.reports[0]));
  });

  it('memakai teks AI yang valid & tersanitasi, menolak respons tidak valid', async () => {
    const s = newState('career', { open: true });
    closeDay(s);
    setAiEnabled(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'Hari yang <b>bagus</b>! https://x.y', source: 'ai' }) }));
    const r = await performanceReview(s.reports[0]);
    expect(r).toEqual({ text: 'Hari yang bagus!', source: 'ai' });
  });

  it('respons berformat salah diabaikan', async () => {
    setAiEnabled(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: 1 }) }));
    const s = newState('career', { open: true });
    closeDay(s);
    expect((await performanceReview(s.reports[0])).source).toBe('local');
  });

  it('sanitasi menolak teks yang tampak seperti instruksi dosis', () => {
    expect(sanitizeAiText('Minum 500 mg tablet 3 kali per hari')).toBeNull();
    expect(sanitizeAiText('  Halo   apa kabar  ')).toBe('Halo apa kabar');
  });

  it('ulasan lokal berasal dari data laporan', () => {
    const s = newState('career', { open: true });
    closeDay(s);
    const text = localReview(s.reports[0]);
    expect(text).toContain(`Hari ${s.reports[0].day}`);
    expect(text).toContain(`${s.reports[0].patientsServed} pasien`);
  });

  it('petunjuk tutor lokal berbasis kondisi permainan', () => {
    const s = newState('career');
    expect(localTutorHint(s)).toMatch(/buka apotek/i);
  });
});
