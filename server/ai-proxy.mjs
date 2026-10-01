/**
 * Proxy AI opsional untuk Pharmacy 3D Simulator.
 *
 * - Kunci API TIDAK pernah dikirim ke browser: SDK membaca kredensial dari lingkungan server
 *   (ANTHROPIC_API_KEY, atau profil `ant auth login`).
 * - Hanya menghasilkan TEKS naratif pendek (dialog pasien, petunjuk tutor, ringkasan performa,
 *   narasi event). Aturan dan dampak ekonomi tetap dikendalikan oleh game.
 * - Game tetap dapat dimainkan tanpa proxy ini (frontend memakai fallback lokal).
 *
 * Jalankan: `npm run ai-proxy` (port default 8787; Vite mem-proxy /api/ai ke sini saat dev).
 */
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = Number(process.env.AI_PROXY_PORT ?? 8787);
const MODEL = process.env.AI_MODEL ?? 'claude-opus-5-5';
const MAX_BODY = 4096;
const MAX_TEXT = 420;
const RATE_LIMIT_PER_MIN = 30;

const client = new Anthropic();

const BASE_RULES = [
  'Kamu menulis teks untuk sebuah game simulasi apotek berbahasa Indonesia.',
  'Semua tokoh dan data bersifat fiktif. Jangan pernah memberi saran medis, dosis, atau klaim klinis.',
  'Jangan menyebut angka uang, stok, atau statistik yang tidak ada di konteks.',
  'Balas HANYA dengan teks akhir, tanpa markdown, tanpa tanda kutip pembuka, maksimal dua kalimat singkat.',
].join(' ');

const PROMPTS = {
  'patient-dialog': (c) =>
    `Tulis ucapan pembuka seorang pasien fiktif kepada petugas apotek. Nama: ${c.name}. Umur: ${c.age}. Kebutuhan: ${c.need}. Suasana hati: ${c.mood}. Gunakan bahasa sehari-hari yang sopan, sampaikan kebutuhan tersebut tanpa menambah gejala baru.`,
  tutor: (c) =>
    `Beri satu petunjuk singkat tentang mekanisme game kepada pemain. Situasi saat ini: ${c.situation}. Petunjuk berbasis aturan yang sudah benar: "${c.ruleHint}". Parafrasekan petunjuk itu dengan ramah tanpa menambah fakta baru.`,
  review: (c) =>
    `Rangkum performa pemain hari ini secara suportif dalam dua kalimat, HANYA berdasarkan data berikut (jangan menambah angka lain): ${c.facts}`,
  event: (c) =>
    `Tulis satu kalimat narasi suasana untuk event game "${c.name}": ${c.description}. Jangan menyebut dampak angka.`,
};

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT_PER_MIN;
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/** Membersihkan konteks: hanya string pendek/angka, tanpa objek bertingkat. */
function cleanContext(ctx) {
  const out = {};
  if (!ctx || typeof ctx !== 'object') return out;
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string') out[k] = v.slice(0, 600).replace(/[\u0000-\u001f]/g, ' ');
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = String(v);
  }
  return out;
}

function sanitizeOutput(text) {
  return text
    .replace(/[*_#`>]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

async function generate(kind, context) {
  const response = await client.beta.messages.create({
    model: MODEL,
    // Keluaran sengaja pendek; ruang tambahan untuk penalaran internal.
    max_tokens: 2000,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: BASE_RULES,
    messages: [{ role: 'user', content: PROMPTS[kind](context) }],
  });
  if (response.stop_reason === 'refusal') return { refused: true };
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join(' ');
  return { text: sanitizeOutput(text) };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/ai/health') return send(res, 200, { ok: true, model: MODEL });
  if (req.method !== 'POST' || req.url !== '/api/ai') return send(res, 404, { error: 'not found' });
  if (rateLimited(req.socket.remoteAddress ?? 'unknown')) return send(res, 429, { error: 'Terlalu banyak permintaan.' });

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) return send(res, 413, { error: 'Permintaan terlalu besar.' });
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return send(res, 400, { error: 'JSON tidak valid.' });
  }
  const kind = body?.kind;
  if (!Object.hasOwn(PROMPTS, kind)) return send(res, 400, { error: 'Jenis permintaan tidak dikenal.' });

  try {
    const result = await generate(kind, cleanContext(body.context));
    if (result.refused || !result.text) return send(res, 422, { error: 'Tidak ada teks yang dapat digunakan.' });
    return send(res, 200, { text: result.text, source: 'ai' });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return send(res, 503, { error: 'Kredensial AI belum dikonfigurasi di server.' });
    if (error instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Layanan AI sedang sibuk.' });
    if (error instanceof Anthropic.APIConnectionError) return send(res, 503, { error: 'Layanan AI tidak dapat dihubungi.' });
    if (error instanceof Anthropic.APIError) return send(res, 502, { error: `Layanan AI mengembalikan galat ${error.status}.` });
    // Galat sisi klien SDK (mis. kredensial belum dikonfigurasi) tidak memiliki kelas bertipe.
    console.error('[ai-proxy] permintaan AI gagal sebelum terkirim:', error instanceof Error ? error.message : error);
    return send(res, 503, { error: 'Layanan AI belum dikonfigurasi di server. Game memakai teks lokal.' });
  }
});

server.listen(PORT, () => {
  console.log(`[ai-proxy] berjalan di http://localhost:${PORT} (model ${MODEL})`);
});
