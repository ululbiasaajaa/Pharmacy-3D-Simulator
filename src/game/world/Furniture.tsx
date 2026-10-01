import { useMemo } from 'react';
import { useGame } from '@/stores/gameStore';
import { Interactable } from '@/game/objects/Interactable';
import { BuiltMeshes, type BuiltPart } from '@/game/visual/Built';
import { CanvasLabel } from './CanvasLabel';
import { ShelfProducts, type ShelfLevel } from './ProductDisplay';
import { CanvasPlane, drawBlueprint, drawHealthPoster } from './posters';
import { WALL_H } from './layout';
import {
  acUnitModel,
  balanceModel,
  coffeeStationModel,
  corkBoardModel,
  counter2Model,
  counterModel,
  deskModel,
  displayCabinetModel,
  filingCabinetModel,
  gangChairModel,
  glasswareModel,
  gondolaModel,
  ingredientShelfModel,
  labTableModel,
  lockerModel,
  mortarModel,
  newBuilder,
  officeChairModel,
  palletModel,
  pharmaFridgeModel,
  plantModel,
  registerModel,
  rollUpBannerModel,
  rxCabinetModel,
  serviceDeskModel,
  sofaModel,
  stanchionModel,
  staffGateModel,
  steelCabinetModel,
  steelRackModel,
  teaTableModel,
  workstationModel,
  type B,
} from './furnitureModels';
import { capacityOf, usedVolume } from '@/domain/inventory';
import type { GameState, Medicine } from '@/domain/types';

/** Rasio isi gudang dari data stok sebenarnya (dibulatkan agar render stabil). */
function useFill(sel: (s: GameState) => number) {
  return useGame((st) => (st.game ? Math.round(Math.max(0, Math.min(1, sel(st.game))) * 20) / 20 : 0));
}

/** Membangun model statis sekali → satu mesh per material. */
function built(fn: (b: B) => void): BuiltPart[] {
  const b = newBuilder();
  fn(b);
  return b.build();
}

function builtWithLevels(fn: (b: B) => ShelfLevel[]): { parts: BuiltPart[]; levels: ShelfLevel[] } {
  const b = newBuilder();
  const levels = fn(b);
  return { parts: b.build(), levels };
}

// ------------------------------------------------------------------ Penyaring isi rak (stabil, tingkat modul)

const OTC_A = new Set<string>(['analgesik', 'antipiretik', 'batuk-pilek', 'antasida']);
const isOtc = (m: Medicine) => !m.prescriptionOnly && !m.refrigerated && m.category !== 'bahan-racik';
const isOtcA = (m: Medicine) => isOtc(m) && OTC_A.has(m.category);
const isOtcB = (m: Medicine) => isOtc(m) && !OTC_A.has(m.category);
const isDisplay = (m: Medicine) => isOtc(m) && (m.category === 'vitamin' || m.category === 'kesehatan-umum');
const isRx = (m: Medicine) => m.prescriptionOnly && !m.refrigerated;
/** Obat resep disusun alfabetis seperti di apotek: A–L di lemari kiri, M–Z di kanan. */
const isRxAL = (m: Medicine) => isRx(m) && m.name.localeCompare('M', 'id') < 0;
const isRxMZ = (m: Medicine) => isRx(m) && m.name.localeCompare('M', 'id') >= 0;
const isCold = (m: Medicine) => m.refrigerated;
const isBahan = (m: Medicine) => m.category === 'bahan-racik';
const isBoxed = (m: Medicine) => m.category !== 'bahan-racik';

// ------------------------------------------------------------------ Elemen bantu

/** Papan gantung berkabel (tidak melayang): papan tebal + label di kedua sisi. */
function HangingSign({ text, x, z, width, height = 0.3, y = 2.6, fontSize = 60, background = '#0e655b' }: { text: string; x: number; z: number; width: number; height?: number; y?: number; fontSize?: number; background?: string }) {
  const parts = useMemo(
    () =>
      built((b) => {
        const top = y + height / 2;
        for (const s of [-1, 1]) b.box('metalDark', 0.006, WALL_H - top, 0.006, s * (width / 2 - 0.1), (WALL_H + top) / 2, 0, { r: 0 });
        b.box('aluminum', width + 0.02, height + 0.02, 0.018, 0, y, 0, { r: 0.006 });
      }),
    [width, height, y],
  );
  return (
    <group position={[x, 0, z]}>
      <BuiltMeshes parts={parts} />
      <CanvasLabel text={text} width={width} height={height} position={[0, y, 0.011]} fontSize={fontSize} background={background} />
      <CanvasLabel text={text} width={width} height={height} position={[0, y, -0.011]} rotation={[0, Math.PI, 0]} fontSize={fontSize} background={background} />
    </group>
  );
}

/** Tumpukan kardus berlakban di tingkat rak (jumlah mengikuti isi gudang). */
function cartonsOnLevels(b: B, levels: ShelfLevel[], count: number, seed: number) {
  let r = seed * 9301 + 49297;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  let placed = 0;
  for (const lv of levels) {
    let x = lv.x0;
    while (placed < count) {
      const w = 0.42 + rnd() * 0.16;
      if (x + w > lv.x1) break;
      const h = Math.min(lv.maxH - 0.02, 0.28 + rnd() * 0.14);
      const d = Math.min(lv.depth - 0.02, 0.38 + rnd() * 0.1);
      const rot = (rnd() - 0.5) * 0.08;
      b.box('cardboard', w, h, d, x + w / 2, lv.y + h / 2, lv.zFront - d / 2, { rotY: rot, r: 0.006 });
      b.box('tape', w * 0.98, 0.004, 0.06, x + w / 2, lv.y + h + 0.002, lv.zFront - d / 2, { rotY: rot, r: 0 });
      x += w + 0.05;
      placed++;
    }
  }
}

function cartonStack(b: B, count: number, seed: number) {
  let r = seed * 9301 + 49297;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  palletModel(b, 1.2, 1.0);
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / 2);
    const x = (i % 2) * 0.6 - 0.3;
    const rot = (rnd() - 0.5) * 0.1;
    b.box('cardboard', 0.56, 0.44, 0.92, x, 0.08 + 0.22 + layer * 0.45, 0, { rotY: rot, r: 0.008 });
    b.box('tape', 0.07, 0.004, 0.9, x, 0.08 + 0.442 + layer * 0.45, 0, { rotY: rot, r: 0 });
  }
}

// ------------------------------------------------------------------ Meja pelayanan

/** Tinggi pusat layar antrean (digantung dari plafon di antara loket pelayanan & kasir). */
const TV_Y = 2.72;

function Counter({ counter2, queueDisplay }: { counter2: boolean; queueDisplay: boolean }) {
  const queueLen = useGame((s) => s.game?.queue.length ?? 0);
  const body = useMemo(
    () =>
      built((b) => {
        counterModel(b);
        b.group(7, 0, 0, 0, () => staffGateModel(b));
      }),
    [],
  );
  const cabinet = useMemo(() => builtWithLevels(displayCabinetModel), []);
  const desk = useMemo(() => built(serviceDeskModel), []);
  const register = useMemo(() => built(registerModel), []);
  const c2 = useMemo(() => built(counter2Model), []);
  const barrier = useMemo(() => built(stanchionModel), []);
  const tv = useMemo(
    () =>
      built((b) => {
        b.box('black', 1.1, 0.4, 0.05, 0, 0, 0, { r: 0.012 });
        b.box('metalDark', 0.05, WALL_H - TV_Y - 0.2, 0.05, 0, (WALL_H - TV_Y + 0.2) / 2, 0, { r: 0 });
      }),
    [],
  );
  return (
    <group>
      <BuiltMeshes parts={body} castShadow />
      <BuiltMeshes parts={cabinet.parts} />
      <ShelfProducts levels={cabinet.levels} filter={isDisplay} maxColumns={4} />

      <Interactable id="service-desk" position={[-2, 1.04, 2]}>
        <BuiltMeshes parts={desk} />
      </Interactable>
      <HangingSign text="PELAYANAN & RESEP" x={-2} z={2.3} width={1.8} fontSize={56} />

      <Interactable id="register" position={[3, 1.04, 2]}>
        <BuiltMeshes parts={register} />
      </Interactable>
      <HangingSign text="KASIR" x={3} z={2.3} width={1.2} fontSize={60} />

      {counter2 ? (
        <>
          <Interactable id="counter-2" position={[-5, 1.04, 2]}>
            <BuiltMeshes parts={c2} />
          </Interactable>
          <HangingSign text="LOKET 2" x={-5} z={2.3} width={1.2} fontSize={60} />
        </>
      ) : (
        <group position={[-5, 0, 2.7]}>
          <BuiltMeshes parts={barrier} />
          <CanvasLabel text="LOKET 2 · SEGERA" width={1.3} height={0.22} position={[0, 1.15, 0]} background="#b45309" fontSize={50} />
        </group>
      )}
      {queueDisplay && (
        <group position={[0.5, TV_Y, 2.3]}>
          <BuiltMeshes parts={tv} />
          <CanvasLabel text={`ANTREAN: ${queueLen}`} width={1.02} height={0.33} position={[0, 0, 0.026]} background="#0b1215" color="#5eead4" fontSize={70} />
          <CanvasLabel text={`ANTREAN: ${queueLen}`} width={1.02} height={0.33} position={[0, 0, -0.026]} rotation={[0, Math.PI, 0]} background="#0b1215" color="#5eead4" fontSize={70} />
        </group>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ Area pelanggan

function FrontArea({ islandShelf, extraChairs, decor, ac }: { islandShelf: boolean; extraChairs: number; decor: number; ac: boolean }) {
  const phase = useGame((s) => s.game?.time.phase ?? 'preopen');
  const unitA = useMemo(() => builtWithLevels((b) => gondolaModel(b, { w: 2.9, d: 0.6, h: 2, levels: 4 })), []);
  const unitB = useMemo(() => builtWithLevels((b) => gondolaModel(b, { w: 2.9, d: 0.6, h: 2, levels: 4 })), []);
  const island = useMemo(() => builtWithLevels((b) => gondolaModel(b, { w: 3.6, d: 0.9, h: 1.4, levels: 3 }, true)), []);
  const chairs = useMemo(
    () =>
      built((b) => {
        gangChairModel(b, [-1.2, -0.4, 0.4, 1.2]);
        if (extraChairs >= 2) b.group(0, 0, 2.5, 0, () => gangChairModel(b, [-1.2, -0.4, 0.4, 1.2]));
      }),
    [extraChairs],
  );
  const board = useMemo(() => built((b) => corkBoardModel(b, 2, 1.2)), []);
  const banner = useMemo(() => built(rollUpBannerModel), []);
  const sign = useMemo(
    () =>
      built((b) => {
        b.box('counterBody', 0.72, 0.42, 0.014, 0, 0, 0, { r: 0.02 });
        // Tali dari sudut atas papan ke kait isap di kaca.
        for (const s of [-1, 1]) b.box('metalDark', 0.004, 0.444, 0.004, s * 0.18, 0.34, 0, { rotZ: s * 0.94, r: 0 });
        b.cylinder('glass', 0.03, 0.03, 0.01, 0, 0.47, 0, { rotX: Math.PI / 2, seg: 14 });
      }),
    [],
  );
  const plants = useMemo(
    () =>
      built((b) => {
        if (extraChairs >= 1) plantModel(b, -11.3, 8.8, 1, 3);
        if (decor >= 1) {
          plantModel(b, -6.2, 9.3, 1.1, 5);
          plantModel(b, 10.6, 9.4, 1, 7);
        }
      }),
    [extraChairs, decor],
  );
  const acParts = useMemo(() => built(acUnitModel), []);
  const open = phase === 'open';
  return (
    <group>
      <Interactable id="otc-shelf" position={[11.55, 0, 6.25]}>
        <group position={[0, 0, -1.75]} rotation={[0, -Math.PI / 2, 0]}>
          <BuiltMeshes parts={unitA.parts} castShadow />
          <ShelfProducts levels={unitA.levels} filter={isOtcA} />
          <CanvasLabel text="OBAT BEBAS" width={1.5} height={0.26} position={[0, 2.2, 0.06]} fontSize={60} />
        </group>
        <group position={[0, 0, 1.75]} rotation={[0, -Math.PI / 2, 0]}>
          <BuiltMeshes parts={unitB.parts} castShadow />
          <ShelfProducts levels={unitB.levels} filter={isOtcB} />
          <CanvasLabel text="VITAMIN & KESEHATAN" width={1.9} height={0.26} position={[0, 2.2, 0.06]} fontSize={56} />
        </group>
      </Interactable>
      {islandShelf && (
        <group position={[7.7, 0, 6.1]} rotation={[0, Math.PI / 2, 0]}>
          <BuiltMeshes parts={island.parts} castShadow />
          <ShelfProducts levels={island.levels} filter={isOtcB} maxColumns={4} />
          <group rotation={[0, Math.PI, 0]}>
            <ShelfProducts levels={island.levels} filter={isOtcA} maxColumns={4} />
          </group>
        </group>
      )}

      <Interactable id="waiting-chairs" position={[-9, 0, 5.8]}>
        <BuiltMeshes parts={chairs} castShadow />
      </Interactable>
      <BuiltMeshes parts={plants} castShadow />

      <Interactable id="mission-board" position={[-11.88, 1.6, 4]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <BuiltMeshes parts={board} />
        </group>
      </Interactable>
      <CanvasLabel text="PAPAN MISI" width={1.5} height={0.26} position={[-11.86, 2.42, 4]} rotation={[0, Math.PI / 2, 0]} fontSize={60} />

      <Interactable id="info-board" position={[-4, 1.5, 9.85]}>
        <group position={[0, -1.5, -0.25]} rotation={[0, Math.PI, 0]}>
          <BuiltMeshes parts={banner} />
          <CanvasPlane draw={drawHealthPoster} width={0.8} height={1.9} px={300} position={[0, 1.06, 0.006]} />
        </group>
      </Interactable>

      <Interactable id="sign" position={[1.9, 1.45, 10.0]}>
        <BuiltMeshes parts={sign} />
        <CanvasLabel text={open ? 'BUKA' : 'TUTUP'} width={0.66} height={0.36} position={[0, 0, 0.009]} background={open ? '#15803d' : '#b91c1c'} fontSize={120} />
        <CanvasLabel text={open ? 'BUKA' : 'TUTUP'} width={0.66} height={0.36} position={[0, 0, -0.009]} rotation={[0, Math.PI, 0]} background={open ? '#15803d' : '#b91c1c'} fontSize={120} />
      </Interactable>

      {decor >= 2 && (
        <>
          <CanvasLabel text="Simpan obat sesuai petunjuk kemasan" width={2.4} height={0.5} position={[-11.88, 1.7, 7.6]} rotation={[0, Math.PI / 2, 0]} background="#1e3a8a" fontSize={44} bold={false} />
          <CanvasLabel text="Tanyakan informasi obat kepada petugas" width={2.4} height={0.5} position={[11.88, 1.9, 0.9]} rotation={[0, -Math.PI / 2, 0]} background="#1e3a8a" fontSize={44} bold={false} />
        </>
      )}
      {ac && (
        <group position={[-11.76, 2.72, 6.5]} rotation={[0, Math.PI / 2, 0]}>
          <BuiltMeshes parts={acParts} />
        </group>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ Area staf

function StaffArea() {
  const left = useMemo(() => builtWithLevels((b) => rxCabinetModel(b, 3.9, 0.5, 2.1)), []);
  const right = useMemo(() => builtWithLevels((b) => rxCabinetModel(b, 3.9, 0.5, 2.1)), []);
  const fridge = useMemo(() => builtWithLevels(pharmaFridgeModel), []);
  return (
    <group>
      <Interactable id="rx-shelf" position={[0, 0, -1.6]}>
        <group position={[-3, 0, 0]}>
          <BuiltMeshes parts={left.parts} castShadow />
          <ShelfProducts levels={left.levels} filter={isRxAL} maxColumns={14} />
          <CanvasLabel text="A – L" width={0.36} height={0.14} position={[1.6, 2.02, 0.26]} background="#3d5a80" fontSize={60} />
        </group>
        <group position={[3, 0, 0]}>
          <BuiltMeshes parts={right.parts} castShadow />
          <ShelfProducts levels={right.levels} filter={isRxMZ} maxColumns={14} />
          <CanvasLabel text="M – Z" width={0.36} height={0.14} position={[-1.6, 2.02, 0.26]} background="#3d5a80" fontSize={60} />
        </group>
      </Interactable>
      <CanvasLabel text="OBAT RESEP" width={1.5} height={0.26} position={[-3, 2.3, -1.34]} fontSize={60} />
      <Interactable id="fridge" position={[7.1, 0, -1.5]}>
        <BuiltMeshes parts={fridge.parts} castShadow />
        <ShelfProducts levels={fridge.levels} filter={isCold} maxColumns={4} />
        <CanvasLabel text="4,2 °C" width={0.16} height={0.06} position={[0.2, 1.79, 0.332]} background="#05110c" color="#4ade80" fontSize={44} />
      </Interactable>
      <CanvasLabel text="2–8 °C" width={0.6} height={0.2} position={[7.1, 2.08, -1.17]} background="#1d4ed8" fontSize={60} />
    </group>
  );
}

// ------------------------------------------------------------------ Gudang

function StorageRoom({ fill }: { fill: number }) {
  const rack = useMemo(() => builtWithLevels((b) => steelRackModel(b, 6.4, 0.6, 2.4, 4)), []);
  const top = useMemo(() => built((b) => cartonsOnLevels(b, rack.levels.slice(3), Math.round(fill * 9), 11)), [rack, fill]);
  const cabinet = useMemo(() => built((b) => steelCabinetModel(b)), []);
  const pile = useMemo(() => built((b) => cartonStack(b, Math.max(1, Math.round(fill * 6)), 5)), [fill]);
  return (
    <group>
      <group position={[-11.5, 0, -6.25]} rotation={[0, Math.PI / 2, 0]}>
        <BuiltMeshes parts={rack.parts} castShadow />
        <BuiltMeshes parts={top} castShadow />
        <ShelfProducts levels={rack.levels.slice(0, 3)} location="warehouse" filter={isBoxed} maxColumns={8} />
      </group>
      <Interactable id="storage-cabinet" position={[-8, 0, -9.5]}>
        <BuiltMeshes parts={cabinet} castShadow />
      </Interactable>
      <CanvasLabel text="LEMARI GUDANG" width={1.7} height={0.26} position={[-8, 2.3, -9.14]} fontSize={56} />
      <group position={[-5.3, 0, -8.1]}>
        <BuiltMeshes parts={pile} castShadow />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ Laboratorium racik

function Lab({ equipment }: { equipment: number }) {
  const table = useMemo(
    () =>
      built((b) => {
        labTableModel(b, 3, 1);
        glasswareModel(b, 1.1, 0.92, -0.3);
      }),
    [],
  );
  const balance = useMemo(() => built((b) => balanceModel(b, equipment >= 1)), [equipment]);
  const mortar = useMemo(() => built(mortarModel), []);
  const rack = useMemo(
    () =>
      builtWithLevels((b) => {
        const levels = ingredientShelfModel(b, 3.8, [0.45, 0.9, 1.35, 1.8]);
        glasswareModel(b, 1.3, 1.8125, 0);
        return levels.slice(0, 3);
      }),
    [],
  );
  return (
    <group>
      <Interactable id="lab-table" position={[0, 0, -6]}>
        <BuiltMeshes parts={table} castShadow />
      </Interactable>
      <Interactable id="scale" position={[-0.8, 0.92, -6]}>
        <BuiltMeshes parts={balance} />
      </Interactable>
      <Interactable id="mortar" position={[0.6, 0.92, -6]}>
        <BuiltMeshes parts={mortar} />
      </Interactable>
      <Interactable id="ingredient-rack" position={[-3.55, 0, -7]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <BuiltMeshes parts={rack.parts} castShadow />
          <ShelfProducts levels={rack.levels} filter={isBahan} maxColumns={2} deep={false} />
        </group>
      </Interactable>
      <CanvasLabel text="LABORATORIUM RACIK" width={2} height={0.3} position={[0, 2.6, -9.88]} fontSize={56} />
    </group>
  );
}

// ------------------------------------------------------------------ Administrasi

function Admin({ computerLevel }: { computerLevel: number }) {
  const desk = useMemo(
    () =>
      built((b) => {
        b.group(8, 0, -7.1, 0, () => deskModel(b, 3, 1));
        b.group(8, 0, -6.2, Math.PI, () => officeChairModel(b));
        b.group(9.5, 0, -3.2, 0, () => teaTableModel(b));
      }),
    [],
  );
  const computer = useMemo(
    () =>
      built((b) => {
        workstationModel(b);
        if (computerLevel >= 1) workstationModel(b, 0.72, 0.08, -0.3);
      }),
    [computerLevel],
  );
  const filing = useMemo(() => built((b) => filingCabinetModel(b, 1.1, 1.35, 0.6)), []);
  const lockers = useMemo(() => built((b) => lockerModel(b, 3, 2.4, 1.9, 0.5)), []);
  const frame = useMemo(() => built((b) => b.box('aluminum', 1.66, 1.16, 0.03, 0, 0, 0, { r: 0.008 })), []);
  return (
    <group>
      <BuiltMeshes parts={desk} castShadow />
      <Interactable id="computer" position={[8, 0.75, -7.3]}>
        <BuiltMeshes parts={computer} />
      </Interactable>
      <Interactable id="filing" position={[11.52, 0, -8.6]}>
        <group rotation={[0, -Math.PI / 2, 0]}>
          <BuiltMeshes parts={filing} castShadow />
        </group>
      </Interactable>
      <Interactable id="lockers" position={[11.57, 0, -4]}>
        <group rotation={[0, -Math.PI / 2, 0]}>
          <BuiltMeshes parts={lockers} castShadow />
        </group>
      </Interactable>
      <CanvasLabel text="AREA PEGAWAI" width={1.5} height={0.26} position={[11.88, 2.4, -4]} rotation={[0, -Math.PI / 2, 0]} fontSize={56} />
      <Interactable id="blueprint" position={[6, 1.6, -9.88]}>
        <BuiltMeshes parts={frame} />
        <CanvasPlane draw={drawBlueprint} width={1.56} height={1.06} px={360} position={[0, 0, 0.017]} />
      </Interactable>
      <CanvasLabel text="DENAH PENGEMBANGAN" width={1.8} height={0.26} position={[6, 2.32, -9.87]} fontSize={52} />
    </group>
  );
}

// ------------------------------------------------------------------ Ruang perluasan

function Expansions({ rooms }: { rooms: string[] }) {
  const has = (r: string) => rooms.includes(r);
  const bigRack = useMemo(
    () =>
      built((b) => {
        const levels = steelRackModel(b, 6.4, 0.6, 2.6, 4);
        cartonsOnLevels(b, levels, 22, 21);
      }),
    [],
  );
  const cabinet = useMemo(() => built((b) => steelCabinetModel(b)), []);
  const lab2 = useMemo(
    () =>
      built((b) => {
        labTableModel(b, 2.6, 1);
        b.group(-0.6, 0.92, 0, 0, () => balanceModel(b, false));
        b.group(0.5, 0.92, 0, 0, () => mortarModel(b));
      }),
    [],
  );
  const admin2 = useMemo(
    () =>
      built((b) => {
        deskModel(b, 2.4, 1);
        b.group(0, 0.75, -0.15, 0, () => workstationModel(b));
      }),
    [],
  );
  const lounge = useMemo(() => built((b) => b.group(9, 0, -17.1, 0, () => sofaModel(b, 2.8))), []);
  const coffee = useMemo(() => built(coffeeStationModel), []);
  const chair = useMemo(() => built((b) => b.group(3, 0, -14.1, Math.PI, () => officeChairModel(b))), []);
  return (
    <group>
      {has('big-warehouse') && (
        <group>
          <group position={[-11.5, 0, -14.25]} rotation={[0, Math.PI / 2, 0]}>
            <BuiltMeshes parts={bigRack} castShadow />
          </group>
          <Interactable id="bw-cabinet" position={[-9, 0, -17.5]}>
            <BuiltMeshes parts={cabinet} castShadow />
          </Interactable>
        </group>
      )}
      {has('lab-2') && (
        <Interactable id="lab2-table" position={[-3, 0, -14.5]}>
          <BuiltMeshes parts={lab2} castShadow />
        </Interactable>
      )}
      {has('admin-plus') && (
        <>
          <Interactable id="admin2-computer" position={[3, 0, -15]}>
            <BuiltMeshes parts={admin2} castShadow />
          </Interactable>
          <BuiltMeshes parts={chair} castShadow />
        </>
      )}
      {has('staff-lounge') && (
        <group>
          <BuiltMeshes parts={lounge} castShadow />
          <Interactable id="coffee" position={[11.52, 0, -12.5]}>
            <group rotation={[0, -Math.PI / 2, 0]}>
              <BuiltMeshes parts={coffee} castShadow />
            </group>
          </Interactable>
        </group>
      )}
    </group>
  );
}

export function Furniture() {
  const up = useGame((s) => s.game?.pharmacy.upgrades) ?? {};
  const roomsKey = useGame((s) => (s.game?.pharmacy.unlockedRooms ?? []).join(','));
  const rooms = roomsKey ? roomsKey.split(',') : [];
  const whFill = useFill((s) => (usedVolume(s, 'warehouse') / capacityOf(s, 'warehouse')) * 1.6);
  return (
    <group>
      <Counter counter2={rooms.includes('counter-2')} queueDisplay={(up['service-system'] ?? 0) >= 1} />
      <FrontArea islandShelf={(up.shelf ?? 0) >= 1} extraChairs={up['waiting-room'] ?? 0} decor={up.decor ?? 0} ac={(up.ac ?? 0) >= 1} />
      <StaffArea />
      <StorageRoom fill={whFill} />
      <Lab equipment={up['compounding-equipment'] ?? 0} />
      <Admin computerLevel={up.computer ?? 0} />
      <Expansions rooms={rooms} />
    </group>
  );
}
