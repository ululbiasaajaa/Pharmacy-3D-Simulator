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
| `src/game/assets` | Pemuat aset berlisensi terbuka: tekstur foto (`photoTextures`), model properti (`models`), dan manifest hasil pipeline (`generated/*.json`) |
| `src/game/visual` | Lapisan render (ART_DIRECTION.md): profil kualitas (Rendah–Ultra), siang–malam, IBL & lampu, tekstur prosedural (cadangan), builder geometri, AO lantai interior + AO kontak kawasan & AO sudut terpanggang (`FloorAO`, `CornerAO`), post-processing Ultra (`PostFX`, dimuat malas), halo, sinar matahari, culling berbasis posisi kamera (`InteriorCull`: interior, ruang belakang, uji portal etalase) |
| `src/game/world` | Bangunan, fasad, perabot (`furnitureModels`), produk dari stok (`ProductDisplay`), dekorasi khas apotek (`SetDressing`), tata letak & tabrakan (`layout`, `collision`). Kawasan: data murni `district` (ruko + gaya fasad & baris layanan, ruko latar, gerbang, properti, collider, rute pasien/van, graf pejalan kaki), render `Exterior` + `SignAtlas` (papan nama dua baris), arketipe fasad ruko & isi kios + atlas barang (`shopModels`), pohon & motor matik (`streetModels`), roda bersama — ban, velg berpalang, cakram, dengan tingkat detail (`wheelModels`), bodi kendaraan buatan sendiri (`vehicleModels`), logika murni lalu lintas & mobil boks + odometer/belok roda van (`traffic`), render van/lalu lintas instanced (roda berputar, bayangan kontak)/motor karyawan + showroom kendaraan khusus dev (`DistrictVehicles`) |
| `src/game/npc` | Avatar Rocketbox (`avatars`, `AvatarCharacter` dengan LOD animasi, pemetaan pemeran `avatarCast`), karakter prosedural cadangan (`characterModel`, `Character`), pasien, pegawai, kehidupan jalan (`Pedestrians` + rencana murni `pedestrianPlan`: pejalan kaki, penjaga kios, satpam), registri bersama orang & kendaraan di luar (`crowd`) |
| `scripts/assets` | Pipeline aset yang dapat diulang: unduh dari sumber resmi → konversi/optimasi → `public/assets/` + manifest; penyusun `ASSET_CREDITS.md`; tes kelengkapan berkas |
| `public/assets` | Hasil pipeline: `textures/` (WebP), `models/` & `characters/` (GLB meshopt), lisensi MIT Rocketbox |
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

**Dunia 3D**: posisi NPC diturunkan dari status domain (`computeTargets`): antre → slot antrean, dilayani → meja, checkout → kasir, menunggu racikan → kursi (pose duduk), selesai/pergi → jalan keluar. Animasi karakter juga mengikuti status (`avatarStateFor`). Klip motion capture yang dipakai: berjalan dengan langkah sesuai kecepatan, diam, menunggu gelisah saat kesabaran < 35%, bergestur saat dilayani, duduk di kursi tunggu, dan berjalan cepat saat pergi kesal. Rak menampilkan kemasan produk dari katalog sesuai stok per lokasi (`layoutProducts`: facing sebanding stok, dibagi ke semua tingkat). Langit, matahari, sinar etalase, dan lampu malam mengikuti jam permainan (`daylightAt`).

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
| Visual hibrida (revisi 2) | Objek yang butuh model detail memakai aset berlisensi terbuka: manusia dari Rocketbox (MIT), properti dari Poly Haven (CC0), tekstur foto dari ambientCG (CC0). Perabot khas apotek tetap dibangun di kode via `GeoBuilder`. Semua aset luar diproses oleh pipeline yang dapat diulang dan dicatat lisensinya. |
| Aset dimuat malas + cadangan prosedural | Scene tampil segera dengan tekstur/karakter prosedural, lalu diganti versi foto/avatar begitu terunduh. Bila gagal (offline, berkas hilang), versi prosedural tetap dipakai sehingga game tetap dapat dimainkan. |
| Avatar: satu GLB per avatar, satu pustaka animasi per gender | Semua avatar Rocketbox berbagi rangka `Bip01`, jadi klip motion capture dipakai bersama (hanya rotasi tulang + posisi akar yang diskalakan per tinggi pinggul). Avatar diklon dengan `SkeletonUtils`; `AnimationMixer` per karakter dengan crossfade. |
| Post-processing hanya di profil Ultra | Di GPU terintegrasi, composer + AO layar + bloom menambah ±30 ms per frame. Profil lain memakai AO sudut/lantai terpanggang (hampir gratis). Chunk post-processing dimuat malas. |
| Visual dibangun dari kode (revisi 1, tetap dipakai) | Tekstur prosedural (DataTexture) sebagai cadangan, model perabot/arsitektur via `GeoBuilder`, karakter `SkinnedMesh` prosedural sebagai cadangan avatar. |
| `GeoBuilder` (gabung per material) | Detail bertambah tanpa menambah draw call: satu model = beberapa mesh saja. `b.box` memakai UV berskala meter; tekstur kanvas yang harus tampil utuh (pelat nomor, papan trayek) memakai `b.add` dengan `BoxGeometry` (UV 0..1 per muka). |
| UV berskala meter | Satu tekstur dipakai bersama semua objek tanpa salinan; ukuran pola konsisten. |
| Satu material karakter prosedural (warna verteks) | Cadangan avatar: 1 draw call per karakter; geometri dibagi antarkarakter bergaya sama. |
| Pencahayaan "dipanggang" + IBL sekali render | Biaya per piksel rendah: AO & genangan cahaya di tekstur lantai, environment map dirender sekali, lampu titik sedikit, shadow map di-cache. |
| Kawasan sebagai data murni (`district.ts`) | Satu sumber kebenaran untuk geometri luar, collider, batas dunia, rute pasien, rute van, dan graf pejalan kaki. Karena tanpa React/Three, keterjangkauan (flood fill), kebebasan collider rute, dan tumpang tindih properti dapat diuji di unit test. |
| Batas dunia = struktur terlihat | `WORLD_BOUNDS` hanya bertemu gerbang, bangunan, atau tembok; tidak ada dinding tak terlihat di area terbuka (diuji). Bangunan tanpa gameplay punya collider dan tampak tertutup (kios dilayani dari depan meja, rolling door). |
| Lalu lintas & van sebagai logika murni (`traffic.ts`) | Aturan berhenti di zebra, jaga jarak, halte, portal, dan manuver van (masuk maju, keluar mundur setelah lajur kosong agar tidak buntu) diuji tanpa render. Komponen React hanya menggambar hasilnya; lalu lintas instanced per material. Kendaraan & orang luar berbagi registri `crowd`/`vehicles`. |
| Collider kendaraan = visual | Motor karyawan (jumlah pegawai dalam shift) dan mobil boks parkir (`worldStore.vanParked`, aktif hanya saat benar-benar parkir) punya collider persis sesuai yang terlihat. Kendaraan bergerak tidak ber-collider, tetapi berhenti untuk pemain. Ukuran model diuji terhadap konstanta logika: `TRAFFIC_HALF` = setengah panjang keseluruhan model (termasuk bemper), `VAN_SIZE`/`VAN_HALF` ≥ panjang van, dan model motor berada di dalam `scooterFootprint` (termasuk ujung setang). |
| Roda terpisah dari bodi (instancing) | Bodi kendaraan digabung per material dan di-instance per jenis; roda memakai 3 `InstancedMesh` bersama (ban, velg, bagian gelap). Matriks roda = kendaraan · posisi roda · belok · putar · cermin sisi kanan · skala jari-jari, jadi roda bisa berputar sesuai jarak tempuh dan roda depan van berbelok tanpa menambah draw call. |
| Arketipe fasad, bukan ganti warna | Setiap ruko memilih gaya (`modern`, `klasik`, `bata`, `warung`, `bengkel`, `bangunan`) yang menentukan bentuk & bahan fasad, kanopi, pintu, dan papan nama; jenis usaha (`kind`) menentukan isi lantai dasar. Ruko latar memakai fungsi yang sama dengan LOD 1. |
| Culling berbasis posisi kamera | Tidak ada occlusion culling di three.js. Karena denah apotek sederhana, visibilitas ditentukan aturan geometris: interior dari luar hanya lewat kaca depan, ruang belakang hanya lewat pintu yang terbuka, objek luar dari dalam hanya lewat bentang kaca. Ini memangkas ratusan draw call tanpa mengubah tampilan. |

## Keamanan & privasi

- Tidak ada data pribadi nyata; nama pemain disarankan nama samaran.
- Proxy AI: validasi jenis permintaan, ukuran body ≤ 4 KB, pembatasan laju 30/menit/IP, sanitasi keluaran, model hanya menerima konteks teks pendek.
- Hook debug (`window.__pharmacyDebug`) hanya ada saat `import.meta.env.DEV`.
