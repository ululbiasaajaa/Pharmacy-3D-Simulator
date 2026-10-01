import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as rtlAct, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGame } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { MainMenu } from '@/components/screens/MainMenu';
import { ServicePanel } from '@/components/panels/ServicePanel';
import { PosPanel } from '@/components/panels/PosPanel';
import { MissionsPanel } from '@/components/panels/MissionsPanel';
import { InventoryPanel } from '@/components/panels/InventoryPanel';
import { SettingsForm } from '@/components/screens/SettingsForm';
import { resetAiAvailability } from '@/services/ai/aiService';
import { openPharmacy } from '@/domain/simulation';
import { spawnPatient } from '@/domain/patients';
import { receiveBatch } from '@/domain/inventory';

function startGame() {
  useUi.getState().reset();
  useGame.getState().startNew({ mode: 'career', playerName: 'Uji', pharmacyName: 'Uji', seed: 5, skipTutorial: true });
  useGame.getState().act(openPharmacy);
  useGame.getState().act((s) => {
    const p = spawnPatient(s, { category: 'otc', symptom: 'sakit-kepala', scripted: true })!;
    p.money = 500_000;
  });
}

beforeEach(() => {
  startGame();
});

describe('Menu utama', () => {
  it('menampilkan tombol utama yang berfungsi', () => {
    render(
      <MemoryRouter>
        <MainMenu />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('menu-new')).toBeEnabled();
    expect(screen.getByTestId('menu-load')).toBeEnabled();
    expect(screen.getByTestId('menu-settings')).toBeEnabled();
  });
});

describe('Alur pelayanan obat bebas lewat UI', () => {
  it('memanggil pasien, menambah produk, mengirim ke kasir, dan membayar', async () => {
    render(<ServicePanel />);
    fireEvent.click(screen.getByTestId('call-next'));
    expect(await screen.findByTestId('active-patient-name')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('product-search'), { target: { value: 'Parasetamol 500' } });
    fireEvent.click(screen.getByTestId('add-pct-500'));
    fireEvent.click(screen.getByTestId('send-checkout'));
    const patient = useGame.getState().game!.patients[0];
    expect(patient.status).toBe('checkout');

    const moneyBefore = useGame.getState().game!.money;
    render(<PosPanel />);
    const sale = await screen.findByTestId('pos-sale');
    expect(within(sale).getByTestId('pos-total')).toHaveTextContent('4.000');
    rtlAct(() => {
      fireEvent.click(within(sale).getByTestId('pos-complete'));
    });
    expect(useGame.getState().game!.money).toBe(moneyBefore + 4_000);
    expect(useGame.getState().game!.stats.salesCompleted).toBe(1);
  });

  it('klik ganda pada tombol bayar tidak memproses transaksi dua kali', async () => {
    useGame.getState().act((s) => {
      const p = s.patients[0];
      p.status = 'serving';
      s.activePatientId = p.id;
      s.queue = [];
    });
    render(<ServicePanel />);
    fireEvent.change(screen.getByTestId('product-search'), { target: { value: 'Parasetamol 500' } });
    fireEvent.click(screen.getByTestId('add-pct-500'));
    fireEvent.click(screen.getByTestId('send-checkout'));
    render(<PosPanel />);
    const btn = await screen.findByTestId('pos-complete');
    const before = useGame.getState().game!.money;
    rtlAct(() => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    expect(useGame.getState().game!.money).toBe(before + 4_000);
  });
});

describe('Misi', () => {
  it('menampilkan misi dan mengklaim hadiah yang selesai', () => {
    useGame.getState().act((s) => {
      s.stats.patientsServed = 1;
    });
    render(<MissionsPanel />);
    const before = useGame.getState().game!.money;
    fireEvent.click(screen.getByTestId('claim-m-first-serve'));
    expect(useGame.getState().game!.money).toBe(before + 100_000);
  });
});

describe('Pengaturan AI', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAiAvailability();
  });

  it('toggle AI nonaktif dan ditandai tidak tersedia bila proxy tidak ada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    render(<SettingsForm />);
    expect(await screen.findByText(/Tidak tersedia: proxy AI tidak ditemukan/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Fitur AI' })).toBeDisabled();
  });

  it('toggle AI dapat dipakai bila proxy terhubung', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    render(<SettingsForm />);
    expect(await screen.findByText(/Proxy AI terhubung/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Fitur AI' })).toBeEnabled();
  });
});

describe('Inventaris', () => {
  it('memusnahkan batch kedaluwarsa dari UI', () => {
    useGame.getState().act((s) => {
      receiveBatch(s, { medicineId: 'pct-500', qty: 3, expiryDay: 0, unitCost: 2500, location: 'shelf', batchNo: 'LOT-EXP', skipCapacity: true });
    });
    render(<InventoryPanel manage location="shelf" />);
    fireEvent.click(screen.getByText('Parasetamol 500 mg'));
    fireEvent.click(screen.getByTestId('dispose-LOT-EXP'));
    expect(useGame.getState().game!.stats.expiredDisposed).toBe(1);
  });
});
