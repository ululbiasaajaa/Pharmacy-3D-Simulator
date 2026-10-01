import { z } from 'zod';
import { SYMPTOM_PRODUCTS, INFO_TOPICS } from '@/data/medicines';
import { TUTORIAL_STEPS } from '@/data/tutorial';
import { findRecipe } from '@/domain/compounding';
import { formatMoney } from '@/domain/time';
import type { DailyReport, GameState, Patient } from '@/domain/types';

/**
 * Layanan AI opsional. Semua fungsi SELALU mengembalikan teks — dari proxy AI bila diaktifkan
 * dan tersedia, atau dari generator lokal berbasis aturan. Keluaran AI hanya dipakai sebagai
 * teks tampilan; tidak pernah mengubah data inti permainan.
 */
export type AiKind = 'patient-dialog' | 'tutor' | 'review' | 'event';
export interface AiText {
  text: string;
  source: 'ai' | 'local';
}

const responseSchema = z.object({ text: z.string().min(1).max(600), source: z.literal('ai') });
const ENDPOINT = (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '/api/ai';
const TIMEOUT_MS = 8000;

const healthSchema = z.object({ ok: z.literal(true) });

let enabled = false;
let lastFailureAt = 0;
/** Hasil pemeriksaan proxy terakhir; null = belum diperiksa. */
let available: boolean | null = null;

export function setAiEnabled(v: boolean) {
  enabled = v;
  // Mengubah pengaturan menghapus jeda percobaan ulang setelah kegagalan.
  lastFailureAt = 0;
}

/**
 * Memeriksa apakah proxy AI dapat dihubungi. Di hosting statis (mis. Vercel tanpa proxy)
 * hasilnya false sehingga AI tidak dipanggil dan pengaturannya ditampilkan tidak tersedia.
 */
export async function checkAiAvailable(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`${ENDPOINT}/health`, { signal: ctrl.signal });
    available = res.ok && healthSchema.safeParse(await res.json()).success;
  } catch {
    available = false;
  } finally {
    clearTimeout(timer);
  }
  return available;
}

/** Untuk pengujian: lupakan hasil pemeriksaan proxy. */
export function resetAiAvailability() {
  available = null;
}

/** Validasi & sanitasi keluaran AI sebelum ditampilkan. */
export function sanitizeAiText(raw: string): string | null {
  const text = raw
    .replace(/<[^>]*>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 420);
  if (text.length < 3) return null;
  // Tolak teks yang tampak seperti instruksi dosis (aturan keamanan edukatif).
  if (/\b\d+\s?(mg|ml|mL|tablet|kapsul)\b.*\b(sehari|per hari)\b/i.test(text)) return null;
  return text;
}

async function callProxy(kind: AiKind, context: Record<string, string | number>): Promise<string | null> {
  if (!enabled || available === false) return null;
  // Setelah gagal, jangan mencoba lagi selama 60 detik agar game tetap responsif.
  if (Date.now() - lastFailureAt < 60_000) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, context }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error('invalid');
    return sanitizeAiText(parsed.data.text);
  } catch {
    lastFailureAt = Date.now();
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function withFallback(kind: AiKind, context: Record<string, string | number>, local: string): Promise<AiText> {
  const ai = await callProxy(kind, context);
  return ai ? { text: ai, source: 'ai' } : { text: local, source: 'local' };
}

// ------------------------------------------------------------------ Dialog pasien

export function moodOf(p: Patient) {
  const r = p.maxPatience ? p.patience / p.maxPatience : 1;
  return r > 0.7 ? 'tenang' : r > 0.35 ? 'mulai tidak sabar' : 'kesal';
}

/** Dialog pembuka lokal yang terhubung dengan kategori & kondisi pasien. */
export function localPatientLine(s: GameState, p: Patient): string {
  const mood = moodOf(p);
  const prefix = mood === 'kesal' ? 'Akhirnya giliran saya... ' : mood === 'mulai tidak sabar' ? 'Permisi, ' : 'Selamat siang, ';
  switch (p.category) {
    case 'otc':
    case 'canceller': {
      if (p.symptom) return `${prefix}${SYMPTOM_PRODUCTS[p.symptom].complaint}. Ada obat yang cocok?`;
      const req = p.requestedItems[0];
      const med = s.medicines.find((m) => m.id === req?.medicineId);
      return `${prefix}saya mau beli ${req?.qty ?? 1} ${med?.unit ?? ''} ${med?.name ?? 'obat'}.`;
    }
    case 'prescription':
      return `${prefix}saya mau menebus resep dari dokter ini.`;
    case 'refill':
      return `${prefix}saya mau tebus ulang resep saya, ini salinan resepnya.`;
    case 'inquiry': {
      const med = s.medicines.find((m) => m.id === p.inquiryMedicineId);
      return `${prefix}apakah di sini ada ${med?.name ?? 'obat ini'}?`;
    }
    case 'info':
      return `${prefix}${INFO_TOPICS.find((t) => t.id === p.infoTopicId)?.question ?? 'saya mau bertanya.'}`;
    case 'compounding': {
      const recipeId = p.compoundingOrderId?.startsWith('pending:') ? p.compoundingOrderId.slice(8) : '';
      return `${prefix}saya perlu dibuatkan ${findRecipe(recipeId)?.name ?? 'racikan'}. Bisa ditunggu?`;
    }
  }
}

export function patientLine(s: GameState, p: Patient): Promise<AiText> {
  const local = localPatientLine(s, p);
  // Pasien skenario memakai teks lokal agar tutorial/pelajaran konsisten.
  if (p.scripted) return Promise.resolve({ text: local, source: 'local' });
  return withFallback('patient-dialog', { name: p.name, age: p.age, need: p.need, mood: moodOf(p) }, local);
}

/** Tanggapan pasien setelah pelayanan, berdasarkan hasil & kepuasan yang tercatat. */
export function patientFarewell(p: Patient): string {
  const last = p.visits[p.visits.length - 1];
  if (p.status === 'checkout') return 'Baik, saya ke kasir dulu ya.';
  if (p.status === 'awaiting') return 'Saya tunggu di kursi ya, terima kasih.';
  if (!last) return '…';
  if (last.outcome === 'served') {
    if (p.satisfaction >= 80) return 'Terima kasih banyak, pelayanannya cepat dan jelas!';
    if (p.satisfaction >= 55) return 'Terima kasih, sudah cukup membantu.';
    return 'Akhirnya selesai juga… lain kali semoga lebih cepat.';
  }
  if (last.outcome === 'rejected') return 'Baik, saya akan kembali ke dokter dulu. Terima kasih penjelasannya.';
  if (last.outcome === 'cancelled') return p.cancelRequested ? 'Maaf merepotkan, terima kasih.' : 'Ya sudah, saya cari di tempat lain saja.';
  return 'Saya tidak bisa menunggu lebih lama lagi.';
}

// ------------------------------------------------------------------ Tutor

/** Petunjuk berbasis aturan dari kondisi permainan saat ini. */
export function localTutorHint(s: GameState): string {
  if (s.tutorial.active) {
    const step = TUTORIAL_STEPS[s.tutorial.step];
    if (step) return step.hint ?? step.text;
  }
  if (s.time.phase === 'preopen') return 'Periksa rak dan pesanan yang tiba, lalu buka apotek melalui papan BUKA/TUTUP di pintu.';
  if (s.time.phase === 'closed') return 'Baca laporan harian untuk melihat laba, produk terlaris, dan kesalahan, lalu mulai hari berikutnya.';
  const expiredOnShelf = s.batches.filter((b) => b.location === 'shelf' && b.status === 'active' && b.qty > 0 && b.expiryDay <= s.time.day).length;
  if (expiredOnShelf) return `Ada ${expiredOnShelf} batch kedaluwarsa di rak. Musnahkan melalui Inventaris agar tidak didenda saat pemeriksaan.`;
  const arrived = s.purchaseOrders.filter((o) => o.status === 'arrived').length;
  if (arrived) return `${arrived} pesanan sudah tiba. Terima barang di Lemari Gudang agar stok masuk inventaris.`;
  const checkout = s.patients.filter((p) => p.status === 'checkout').length;
  if (checkout) return `${checkout} pasien menunggu di kasir. Buka Mesin Kasir untuk menyelesaikan pembayaran.`;
  if (s.queue.length >= 3) return 'Antrean mulai panjang. Layani pasien di Meja Pelayanan atau rekrut asisten pelayanan.';
  const low = s.medicines.filter((m) => m.active && m.category !== 'bahan-racik' && s.batches.filter((b) => b.medicineId === m.id && b.location === 'shelf' && b.status === 'active').reduce((a, b) => a + b.qty, 0) < m.minStock).length;
  if (low > 3) return `${low} produk di rak di bawah stok minimum. Isi rak dari gudang atau lakukan pengadaan.`;
  const claimable = s.missions.filter((m) => m.status === 'completed').length;
  if (claimable) return `${claimable} misi selesai. Klaim hadiahnya di Papan Misi.`;
  return 'Semua berjalan lancar. Gunakan waktu luang untuk meninjau laporan keuangan dan rekomendasi pengadaan.';
}

export function tutorHint(s: GameState): Promise<AiText> {
  const local = localTutorHint(s);
  return withFallback('tutor', { situation: `Hari ${s.time.day}, fase ${s.time.phase}, antrean ${s.queue.length}`, ruleHint: local }, local);
}

// ------------------------------------------------------------------ Ulasan performa

/** Ringkasan performa yang SEPENUHNYA dihitung dari laporan harian yang tersimpan. */
export function localReview(r: DailyReport): string {
  const parts: string[] = [];
  parts.push(`Hari ${r.day}: ${r.patientsServed} pasien dilayani, ${r.salesCount} transaksi, laba ${formatMoney(r.profit)}.`);
  if (r.patientsLeft > 0) parts.push(`${r.patientsLeft} pasien pergi sebelum dilayani — rata-rata tunggu ${Math.round(r.avgWaitMinutes)} menit.`);
  else parts.push('Tidak ada pasien yang pergi karena menunggu — pelayanan sangat baik!');
  if (r.errors > 0) parts.push(`Tercatat ${r.errors} kesalahan operasional (penyiapan/FEFO); tinjau pesan validasi.`);
  const repDelta = r.reputationEnd - r.reputationStart;
  parts.push(`Reputasi ${repDelta >= 0 ? 'naik' : 'turun'} ${Math.abs(repDelta).toFixed(1)} poin.`);
  if (r.nonCashLosses > 0) parts.push(`Kerugian stok (kedaluwarsa/rusak): ${formatMoney(r.nonCashLosses)}.`);
  return parts.join(' ');
}

export function performanceReview(r: DailyReport): Promise<AiText> {
  const local = localReview(r);
  const facts = `pasien dilayani ${r.patientsServed}; pasien pergi ${r.patientsLeft}; transaksi ${r.salesCount}; resep ${r.prescriptionsDispensed}; racikan ${r.compoundingDone}; kesalahan ${r.errors}; rata-rata tunggu ${Math.round(r.avgWaitMinutes)} menit; laba ${formatMoney(r.profit)}; perubahan reputasi ${(r.reputationEnd - r.reputationStart).toFixed(1)}`;
  return withFallback('review', { facts }, local);
}

// ------------------------------------------------------------------ Narasi event

export function eventNarrative(name: string, description: string, local: string): Promise<AiText> {
  return withFallback('event', { name, description }, local);
}
