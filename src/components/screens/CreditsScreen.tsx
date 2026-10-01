import { ScreenShell } from './ScreenShell';

export function CreditsScreen() {
  return (
    <ScreenShell title="Kredit & Informasi">
      <div className="space-y-4">
        <section className="panel rounded-2xl p-5 text-sm text-slate-300">
          <h2 className="mb-2 text-lg font-semibold text-white">Pharmacy 3D Simulator</h2>
          <p>Versi 1.0 — game simulasi pengelolaan apotek 3D berbasis web.</p>
          <p className="mt-2">Dibangun dengan React, TypeScript, Vite, Three.js, React Three Fiber, Drei, Zustand, Immer, Zod, idb, dan Tailwind CSS.</p>
        </section>
        <section className="panel rounded-2xl p-5 text-sm text-slate-300">
          <h2 className="mb-2 text-lg font-semibold text-white">Aset</h2>
          <ul className="space-y-1">
            <li>• Model 3D: dibuat sendiri dari bentuk primitif (low-poly) di dalam kode.</li>
            <li>• Teks pada papan: digambar di kanvas saat runtime (font sistem).</li>
            <li>• Audio & musik: disintesis secara prosedural dengan Web Audio API — status <strong>placeholder</strong>, bukan aset final.</li>
            <li>• Tidak ada aset pihak ketiga berbayar atau berlisensi terbatas.</li>
          </ul>
        </section>
        <section className="panel rounded-2xl p-5 text-sm text-slate-300">
          <h2 className="mb-2 text-lg font-semibold text-white">Penafian</h2>
          <p>
            Seluruh obat, harga, resep, pemasok, dan pasien bersifat fiktif atau contoh simulasi yang disederhanakan. Informasi dalam permainan tidak boleh dianggap sebagai saran medis,
            pedoman swamedikasi, atau prosedur kefarmasian. Aktivitas peracikan adalah skenario latihan dan tidak menggantikan pelatihan profesional.
          </p>
        </section>
        <section className="panel rounded-2xl p-5 text-sm text-slate-300">
          <h2 className="mb-2 text-lg font-semibold text-white">Fitur AI opsional</h2>
          <p>
            Jika diaktifkan dan proxy server tersedia, AI hanya membuat variasi teks (dialog, petunjuk, ringkasan, narasi event). Aturan dan dampak ekonomi tetap dikendalikan oleh game. Kunci
            API tidak pernah disimpan di browser. Tanpa proxy, game memakai teks lokal.
          </p>
        </section>
      </div>
    </ScreenShell>
  );
}
