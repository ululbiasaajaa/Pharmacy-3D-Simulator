# Kredit & Lisensi Aset — Pharmacy 3D Simulator

_Berkas ini dibuat otomatis oleh `node scripts/assets/credits.mjs` dari manifest pipeline aset. Jangan diedit manual._

Semua aset pihak ketiga berlisensi terbuka yang mengizinkan pemakaian, modifikasi, dan distribusi ulang (CC0 atau MIT). Tidak ada aset berbayar. Aset diunduh dari sumber resmi lalu dioptimasi oleh skrip di `scripts/assets/` (lihat [ART_DIRECTION.md §3](ART_DIRECTION.md#3-strategi--pipeline-aset)).

| Kelompok | Sumber | Lisensi | Ukuran unduhan |
|---|---|---|---|
| Karakter (31 avatar) + animasi | Microsoft Rocketbox | MIT | 12314 KB + 2162 KB |
| Properti (15 model) | Poly Haven | CC0 1.0 | 3096 KB |
| Tekstur foto PBR (16 set) | ambientCG | CC0 1.0 | 1824 KB (512 px) / 8139 KB (1024 px) |

## Microsoft Rocketbox Avatar Library (MIT)

Sumber: <https://github.com/microsoft/Microsoft-Rocketbox> — Copyright (c) 2020 Microsoft. Teks lisensi lengkap disertakan di `public/assets/characters/LICENSE-Rocketbox.txt`.

**Modifikasi:**
- FBX dikonversi ke GLB.
- Tekstur TGA 2048 px diperkecil menjadi WebP 256–1024 px.
- Geometri dikompresi meshopt.
- Klip animasi: tulang wajah dibuang, klip diam diturunkan ke 15 fps, klip berjalan dibuat di tempat (in-place), posisi akar dipusatkan.

| Avatar | Dipakai untuk | Segitiga | Ukuran |
|---|---|---|---|
| [Medical_Female_01](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Professions/Medical_Female_01) | Apoteker (jas putih) | 8.328 | 375 KB |
| [Medical_Male_01](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Professions/Medical_Male_01) | Apoteker / avatar pemain (jas putih) | 7.581 | 394 KB |
| [Female_Adult_15](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_15) | Kasir (kemeja biru) | 9.832 | 479 KB |
| [Male_Adult_08](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_08) | Kasir (kemeja biru muda) | 7.364 | 397 KB |
| [Female_Adult_13](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_13) | Petugas gudang (rompi) | 8.708 | 452 KB |
| [Male_Adult_11](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_11) | Petugas gudang (kemeja kerja) | 6.740 | 312 KB |
| [Business_Female_01](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Professions/Business_Female_01) | Manajer / pasien | 8.966 | 387 KB |
| [Business_Male_06](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Professions/Business_Male_06) | Manajer (kemeja putih) | 6.950 | 263 KB |
| [Female_Adult_09](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_09) | Asisten / pasien (kardigan) | 9.032 | 491 KB |
| [Male_Adult_01](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_01) | Asisten / pasien (polo) | 7.440 | 435 KB |
| [Female_Adult_06](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_06) | Pasien lansia berjilbab | 6.992 | 417 KB |
| [Female_Adult_10](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_10) | Pasien berjilbab | 6.460 | 294 KB |
| [Female_Adult_03](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_03) | Pasien | 9.208 | 467 KB |
| [Female_Adult_05](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_05) | Pasien | 8.288 | 510 KB |
| [Female_Adult_07](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_07) | Pasien | 8.308 | 454 KB |
| [Female_Adult_12](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_12) | Pasien (muda) | 8.774 | 416 KB |
| [Male_Adult_09](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_09) | Pasien | 7.428 | 432 KB |
| [Male_Adult_10](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_10) | Pasien (muda) | 6.732 | 372 KB |
| [Male_Adult_15](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_15) | Pasien (baju koko & kopiah) | 7.292 | 292 KB |
| [Male_Adult_17](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_17) | Pasien (muda) | 7.084 | 351 KB |
| [Male_Adult_04](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_04) | Pasien | 8.684 | 457 KB |
| [Male_Adult_07](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_07) | Pasien | 7.588 | 395 KB |
| [Male_Adult_03](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_03) | Pasien lansia | 7.200 | 568 KB |
| [Male_Adult_05](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_05) | Pasien lansia | 7.836 | 431 KB |
| [Male_Adult_14](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Male_Adult_14) | Pasien (paruh baya) | 6.842 | 315 KB |
| [Female_Adult_06_b](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_06) | Pasien lansia berjilbab merah muda, gamis marun | 6.992 | 413 KB |
| [Female_Adult_06_c](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_06) | Pasien lansia berjilbab biru muda, gamis navy | 6.992 | 411 KB |
| [Female_Adult_06_d](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_06) | Pasien lansia berjilbab krem, gamis hijau sage | 6.992 | 417 KB |
| [Female_Adult_10_b](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_10) | Pasien berjilbab & abaya navy | 6.460 | 304 KB |
| [Female_Adult_10_c](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_10) | Pasien berjilbab & abaya marun | 6.460 | 303 KB |
| [Female_Adult_10_d](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_10) | Pasien berjilbab & abaya hijau tua | 6.460 | 310 KB |

| Klip | Animasi Rocketbox (`f_`/`m_`) |
|---|---|
| walk | `walk_neutral` |
| idle | `idle_neutral_01` |
| wait | `idle_waiting_01` |
| angry | `idle_angry_01` |
| talk | `gestic_talk_neutral_01` |
| talk2 | `gestic_talk_neutral_02` |
| sit | `sit_chair_idle_neutral_01` |

## Poly Haven (CC0 1.0)

**Modifikasi:** varian yang tidak dipakai dibuang, mesh disederhanakan (meshopt), tekstur diubah ke WebP ≤ 1024 px, dan geometri dikompresi meshopt.

| Kunci | Model | Dipakai untuk | Segitiga | Ukuran |
|---|---|---|---|---|
| plant_taro | [potted_plant_02](https://polyhaven.com/a/potted_plant_02) | Tanaman keladi di pot (ruang tunggu) | 10.424 | 558 KB |
| plant_tree | [potted_plant_01](https://polyhaven.com/a/potted_plant_01) | Tanaman pot tinggi (sudut ruangan) | 12.278 | 750 KB |
| plant_succulent | [potted_plant_04](https://polyhaven.com/a/potted_plant_04) | Sukulen kecil (meja) | 8.929 | 214 KB |
| monobloc_chair | [plastic_monobloc_chair_01](https://polyhaven.com/a/plastic_monobloc_chair_01) | Kursi plastik (ruang staf, teras tetangga) | 3.356 | 146 KB |
| cardboard_box | [cardboard_box_01](https://polyhaven.com/a/cardboard_box_01) | Kardus (gudang) | 2.618 | 105 KB |
| ceiling_fan | [ceiling_fan](https://polyhaven.com/a/ceiling_fan) | Kipas plafon (ruang staf) | 5.722 | 138 KB |
| arm_chair | [modern_arm_chair_01](https://polyhaven.com/a/modern_arm_chair_01) | Kursi kantor/tamu (administrasi) | 5.348 | 149 KB |
| desk_lamp | [desk_lamp_arm_01](https://polyhaven.com/a/desk_lamp_arm_01) | Lampu meja (administrasi) | 7.938 | 220 KB |
| cleaner_5l | [multi_cleaner_5_litre](https://polyhaven.com/a/multi_cleaner_5_litre) | Jeriken pembersih (gudang) | 2.282 | 45 KB |
| bleach | [bleach_bottle](https://polyhaven.com/a/bleach_bottle) | Botol pembersih (gudang) | 2.026 | 38 KB |
| cleaner | [all_purpose_cleaner](https://polyhaven.com/a/all_purpose_cleaner) | Botol pembersih (gudang) | 2.312 | 42 KB |
| ac_outdoor | [exterior_aircon_unit](https://polyhaven.com/a/exterior_aircon_unit) | Unit AC luar (fasad ruko) | 4.289 | 242 KB |
| chalkboard | [standing_chalkboard_01](https://polyhaven.com/a/standing_chalkboard_01) | Papan berdiri di teras | 2.372 | 102 KB |
| utility_box | [utility_box_02](https://polyhaven.com/a/utility_box_02) | Panel listrik di trotoar | 3.760 | 117 KB |
| cafe_set | [outdoor_table_chair_set_01](https://polyhaven.com/a/outdoor_table_chair_set_01) | Meja-kursi teras kedai kopi | 6.736 | 228 KB |

## ambientCG (CC0 1.0)

**Modifikasi:** diperkecil ke 512/1024 px (WebP), AO/roughness/metalness dipadatkan ke satu peta ORM, dan kontras albedo diratakan pada sebagian tekstur (dinding, lantai, fasad) agar tampak bersih.

| Kunci | Tekstur | Dipakai untuk | Ukuran fisik |
|---|---|---|---|
| tile | [Tiles040](https://ambientcg.com/a/Tiles040) | Lantai area pelanggan | 4.8 m |
| plaster | [Plaster001](https://ambientcg.com/a/Plaster001) | Dinding interior | 2.5 m |
| ceiling | [OfficeCeiling001](https://ambientcg.com/a/OfficeCeiling001) | Plafon panel akustik | 3.6 m |
| wood | [Wood058](https://ambientcg.com/a/Wood058) | Panel HPL kayu | 1.2 m |
| brushed | [Metal009](https://ambientcg.com/a/Metal009) | Stainless & aluminium sikat | 0.8 m |
| fabric | [Fabric030](https://ambientcg.com/a/Fabric030) | Kain dudukan kursi | 0.5 m |
| leather | [Leather026](https://ambientcg.com/a/Leather026) | Kulit sintetis kursi kantor | 0.6 m |
| paving | [PavingStones099](https://ambientcg.com/a/PavingStones099) | Paving block parkir | 2.2 m |
| tactile | [TactilePaving003](https://ambientcg.com/a/TactilePaving003) | Ubin pemandu trotoar | 1.8 m |
| asphalt | [Asphalt025A](https://ambientcg.com/a/Asphalt025A) | Aspal jalan | 4 m |
| concrete | [Concrete033](https://ambientcg.com/a/Concrete033) | Beton kanstin & teras | 3 m |
| facade | [PaintedPlaster017](https://ambientcg.com/a/PaintedPlaster017) | Plester fasad ruko | 3 m |
| brick | [Bricks101](https://ambientcg.com/a/Bricks101) | Bata ekspos fasad ruko | 1.6 m |
| stone | [Tiles143](https://ambientcg.com/a/Tiles143) | Batu alam tempel (fasad ruko) | 1.8 m |
| corrugated | [CorrugatedSteel005](https://ambientcg.com/a/CorrugatedSteel005) | Seng gelombang atap & kanopi | 2 m |
| planks | [Planks037A](https://ambientcg.com/a/Planks037A) | Papan kayu pintu lipat & warung | 1.6 m |

## Aset buatan sendiri

Dibuat di dalam kode repositori ini, tanpa aset luar:
- arsitektur dan perabot apotek (gondola, meja pelayanan, etalase, lemari resep, kulkas, lab, gudang);
- kemasan produk dari katalog;
- signage, poster, dan dokumen fiktif;
- APAR, CCTV, jam dinding, hand sanitizer;
- pohon ketapang (kartu daun digambar di kanvas) dan motor matik;
- tekstur prosedural cadangan;
- karakter prosedural cadangan;
- audio.
