import { describe, expect, it } from 'vitest';
import { createNewGame } from '@/domain/newGame';
import { advanceTime, openPharmacy, postProcess } from '@/domain/simulation';
import { tutorialAwaits, tutorialSignal } from '@/domain/guidance';
import { finishPatient } from '@/domain/progression';
import { TUTORIAL_STEPS } from '@/data/tutorial';
import type { GameState } from '@/domain/types';

function tutorialState(): GameState {
  return createNewGame({ mode: 'career', playerName: 'Tester', pharmacyName: 'Apotek Uji', seed: 42 });
}

const stepId = (s: GameState) => TUTORIAL_STEPS[s.tutorial.step]?.id;
const activePatients = (s: GameState) => s.patients.filter((p) => p.status !== 'done' && p.status !== 'left');

describe('Tutorial', () => {
  it('sinyal gerak tetap diterima walaupun pemain sudah berjalan sebelum langkah Bergerak', () => {
    const s = tutorialState();
    expect(stepId(s)).toBe('welcome');
    // Pemain berjalan dulu sebelum menekan "Mengerti": sinyal belum ditunggu.
    expect(tutorialAwaits(s, 'moved')).toBe(false);
    tutorialSignal(s, 'moved');
    expect(stepId(s)).toBe('welcome');
    tutorialSignal(s, 'ack');
    expect(stepId(s)).toBe('move');
    expect(tutorialAwaits(s, 'moved')).toBe(true);
    tutorialSignal(s, 'moved');
    expect(stepId(s)).toBe('open');
  });

  it('membuka apotek saat tutorial masih di langkah awal langsung memunculkan pasien tutorial', () => {
    const s = tutorialState();
    expect(stepId(s)).toBe('welcome');
    expect(openPharmacy(s).ok).toBe(true);
    postProcess(s);
    expect(stepId(s)).toBe('serve');
    const scripted = activePatients(s).filter((p) => p.scripted);
    expect(scripted).toHaveLength(1);
  });

  it('pasien acak ditahan selama pasien tutorial belum dilayani', () => {
    const s = tutorialState();
    openPharmacy(s);
    postProcess(s);
    advanceTime(s, 90);
    expect(activePatients(s).every((p) => p.scripted)).toBe(true);
  });

  it('pasien acak tetap datang bila pasien tutorial sudah pergi walau tutorial belum selesai', () => {
    const s = tutorialState();
    openPharmacy(s);
    postProcess(s);
    const scripted = s.patients.find((p) => p.scripted)!;
    finishPatient(s, scripted, 'cancelled');
    advanceTime(s, 90);
    postProcess(s);
    expect(s.tutorial.active).toBe(true);
    expect(s.patients.some((p) => !p.scripted)).toBe(true);
  });
});
