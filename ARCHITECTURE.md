# Arsitektur — Pharmacy 3D Simulator

## Ringkasan

Aplikasi single-page (React + Vite). Seluruh aturan permainan ada di lapisan **domain** berupa fungsi TypeScript murni yang memutasi satu objek `GameState` (JSON biasa). Store Zustand menjalankan fungsi domain di dalam `immer.produce`, lalu mengevaluasi misi/pencapaian/tutorial/pelajaran/tantangan dan menyiarkan event ke subsistem luar (audio, autosave, UI). Dunia 3D (React Three Fiber) hanya **membaca** state dan memicu aksi lewat definisi interaksi.

```
┌──────────────────────────── Presentation ─────────────────────────────┐
│ screens/ (menu, permainan baru, muat, pengaturan, panduan, kredit)    │
│ hud/ (status, fokus objek, tutorial/pelajaran/tantangan, toast)       │
│ panels/ (pelayanan, resep, kasir, inventaris, katalog, pengadaan,     │
│          keuangan, racik, pegawai, peningkatan, misi, laporan, …)     │
├──────────────────────────── Game World ───────────────────────────────┤
│ game/scenes (Canvas, cahaya) · world/ (layout, bangunan, perabot,     │
│ tabrakan) · objects/ (Interactable, pintu) · npc/ (pasien, pegawai)   │
│ player/ (kontrol FPS/TPS, raycast) · interactions/ (aksi tiap objek)  │
├──────────────────────────── State & Runtime ──────────────────────────┤
│ stores/gameStore (act → immer → postProcess → event bus)              │
│ stores/uiStore · stores/settingsStore · hooks/useGameRuntime (loop)   │
├──────────────────────────── Domain (murni) ───────────────────────────┤
│ simulation · patients · prescriptions · inventory · pos · procurement │
│ finance · compounding · employees · upgrades · missions · events      │
│ progression · guidance (tutorial & pelajaran) · challenge · newGame   │
├──────────────────────────── Data ─────────────────────────────────────┤
│ data/ (seed: obat, pemasok, resep, racikan, peningkatan, misi, …)     │
├──────────────────────────── Services ─────────────────────────────────┤
│ persistence/ (IndexedDB, Zod, migrasi, pengaturan) · audio/ (WebAudio)│
│ ai/ (klien proxy + fallback lokal)   ·   server/ai-proxy.mjs (Node)   │
└───────────────────────────────────────────────────────────────────────┘
```

## Struktur folder

| Folder | Isi |
|---|---|
| `src/app` | Router (`HashRouter`), i18n sebagian |
| `src/components/screens` | Halaman menu & `PlayScreen` (lazy-loaded agar Three.js tidak memperlambat menu) |
| `src/components/hud` | HUD permainan |
| `src/components/panels` | Semua antarmuka sistem (modal) |
| `src/components/ui` | Komponen dasar (Button, Modal, Tabs, Stat, …) |
| `src/game` | Scene 3D, pemain, NPC, objek, interaksi |
| `src/game/visual` | Lapisan render (ART_DIRECTION.md): profil kualitas, model siang–malam, IBL & lampu, tekstur PBR prosedural, builder geometri, overlay lantai (AO & genangan cahaya), halo, sinar matahari |
| `src/game/world` | Bangunan, fasad, eksterior, perabot (`furnitureModels`), produk dari stok (`ProductDisplay`), tata letak & tabrakan |
| `src/game/npc` | Karakter skinned prosedural (`characterModel`, `Character`), pasien, pegawai |
| `src/domain` | Tipe entitas & aturan permainan (tanpa React/Three) |
| `src/data` | Data seed/konfigurasi konten |
| `src/stores` | Store Zustand |
| `src/services` | Persistensi, audio, AI |
| `src/hooks` | Loop permainan & efek samping |
| `src/tests` | Unit, integrasi, komponen |
| `e2e` | Playwright |
| `server` | Proxy AI opsional |

## Alur data

1. **Aksi pemain** (klik panel atau tombol E pada objek) → `act(fn)` di `gameStore`.
2. `act` menjalankan `fn(draft)` di dalam `immer.produce`. Fungsi domain memvalidasi lalu memutasi draft dan mengembalikan `Result` (`{ok, value?, message?}` atau `{ok:false, error}`).
3. `postProcess(draft)` mengevaluasi misi, pencapaian, tutorial, pelajaran, dan tantangan.
4. Event di `draft.outbox` (mis. `sale-completed`) dikosongkan dan disiarkan ke pendengar (`onGameEvent`) → efek suara, autosave, laporan harian, narasi event AI.
5. Komponen React berlangganan potongan state (`useGame(selector)`) dan dirender ulang.

**Waktu**: `useGameLoop` (10 Hz) memanggil `advanceTime(state, dt)` selama apotek buka. `advanceTime` memproses langkah ≤ 1 menit permainan: kedatangan pasien, kesabaran, pegawai, pengiriman, event, dan penutupan hari pada 20.00.

**Dunia 3D**: posisi NPC diturunkan dari status domain (`computeTargets`): antre → slot antrean, dilayani → meja, checkout → kasir, menunggu racikan → kursi (pose duduk), selesai/pergi → jalan keluar. Animasi karakter juga mengikuti status (tidak sabar saat kesabaran < 35%, bergestur saat dilayani, pergi kesal). Rak menampilkan kemasan produk dari katalog sesuai stok per lokasi (`layoutProducts`: facing sebanding stok, dibagi ke semua tingkat). Langit, matahari, sinar etalase, dan lampu malam mengikuti jam permainan (`daylightAt`).

## Hubungan antarsistem (contoh)

- Penyerahan resep → `consumeBatch` (stok berkurang per batch + transaksi stok) → transaksi `SaleTransaction` dengan `stockCommitted` → pasien ke kasir → `completeSale` → buku besar → statistik → misi/pencapaian.
- Pembatalan transaksi resep → stok dikembalikan ke batch asal (`returnToBatch`).
- Pengadaan → kas berkurang (buku besar) → `progressOrders` mengikuti waktu → `receiveOrder` membuat batch di gudang → petugas gudang/pemain mengisi rak.
- Peningkatan → `getEffects()` (agregator tunggal) memengaruhi kapasitas, kesabaran, waktu kirim, slot pegawai, loket, biaya operasional; perabot 3D & tabrakan ikut berubah.
- Event → pengali kedatangan/kesabaran/harga/ETA; pemeriksaan inventaris memberi denda/hadiah di akhir event.

## Keputusan teknis penting

| Keputusan | Alasan |
|---|---|
| Domain murni + immer | Mudah diuji tanpa React/Three; perubahan atomik; tidak ada mutasi tak sengaja (state dibekukan). |
| `GameState` JSON tunggal | Simpan/muat = serialisasi langsung; validasi Zod; migrasi berversi. |
| RNG deterministik (mulberry32) di state | Simulasi dapat direproduksi dalam tes; lanjut konsisten setelah muat. |
| ID berbasis penghitung | Unik & deterministik. |
| Uang hanya lewat `addLedger` | Laporan selalu sesuai transaksi; kerugian stok dicatat nonkas. |
| Guard status (open/completed, dispensed) | Mencegah pemrosesan ganda/uang tanpa batas. |
| Tabrakan AABB 2D sendiri | Ringan, cukup untuk denah ortogonal, tanpa mesin fisika. |
| Label via CanvasTexture | Tanpa unduhan font eksternal. |
| `HashRouter` | Build statis dapat di-host di mana saja. |
| Pengaturan di localStorage, simpanan di IndexedDB | Pengaturan = preferensi per perangkat; simpanan bisa besar. |
| AI lewat proxy server + fallback lokal | Kunci tidak pernah di frontend; game tidak bergantung AI; keluaran divalidasi & dibatasi panjangnya; AI tidak mengubah data inti. |
| Audio prosedural | Bebas lisensi; ditandai placeholder. |
| `PlayScreen` lazy | Menu utama tidak memuat Three.js. |
| Visual dibangun dari kode | Bebas lisensi & ringan diunduh: tekstur PBR prosedural (DataTexture), model perabot/arsitektur via `GeoBuilder`, karakter `SkinnedMesh` prosedural. |
| `GeoBuilder` (gabung per material) | Detail bertambah tanpa menambah draw call: satu model = beberapa mesh saja. |
| UV berskala meter | Satu tekstur dipakai bersama semua objek tanpa salinan; ukuran pola konsisten. |
| Satu material karakter (warna verteks) | 1 draw call per karakter; geometri dibagi antarkarakter bergaya sama. |
| Pencahayaan "dipanggang" + IBL sekali render | Biaya per piksel rendah: AO & genangan cahaya di tekstur lantai, environment map dirender sekali, lampu titik sedikit, shadow map di-cache. |

## Keamanan & privasi

- Tidak ada data pribadi nyata; nama pemain disarankan nama samaran.
- Proxy AI: validasi jenis permintaan, ukuran body ≤ 4 KB, pembatasan laju 30/menit/IP, sanitasi keluaran, model hanya menerima konteks teks pendek.
- Hook debug (`window.__pharmacyDebug`) hanya ada saat `import.meta.env.DEV`.
