import { expect, test, type Page } from '@playwright/test';

/**
 * Alur end-to-end utama. Memakai pengaturan aksesibilitas "Akses cepat stasiun"
 * sehingga stasiun dapat dibuka dari HUD/tablet tanpa navigasi 3D (pointer lock
 * tidak andal di browser headless). Scene 3D tetap dirender.
 */
async function moneyValue(page: Page) {
  const text = (await page.getByTestId('hud-money').textContent()) ?? '';
  return Number(text.replace(/[^\d-]/g, ''));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.setItem('pharmacy3d.settings.v1', JSON.stringify({ quickAccess: true, graphicsQuality: 'low', musicVolume: 0, sfxVolume: 0 }));
      sessionStorage.setItem('e2e-init', '1');
    }
  });
});

test('permainan baru → tutorial → layani → transaksi → stok → pengadaan → misi → simpan → muat', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. Permainan baru
  await page.goto('/');
  await page.getByTestId('menu-new').click();
  await page.getByTestId('player-name').fill('Apt. Uji');
  await page.getByTestId('pharmacy-name').fill('Uji Sehat');
  await page.getByTestId('mode-career').click();
  await page.getByTestId('continue-intro').click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('play-screen')).toBeVisible();
  await expect(page.getByTestId('game-canvas').locator('canvas')).toBeVisible();

  // 2. Tutorial
  await expect(page.getByTestId('tutorial-card')).toContainText('Selamat datang');
  await page.getByTestId('tutorial-next').click();
  await expect(page.getByTestId('tutorial-card')).toContainText('Bergerak');
  await page.getByTestId('tutorial-skip-step').click();
  await expect(page.getByTestId('tutorial-card')).toContainText('Buka apotek');
  await page.getByTestId('hud-open').click();
  await expect(page.getByTestId('tutorial-card')).toContainText('Layani pasien');

  // 3. Layani pasien (pasien tutorial: sakit kepala)
  await page.getByTestId('quick-service').click();
  await page.getByTestId('call-next').click();
  await expect(page.getByTestId('active-patient-name')).toBeVisible();
  await expect(page.getByTestId('patient-dialogue')).toContainText('kepala');
  await page.getByTestId('product-search').fill('Parasetamol 500');
  await page.getByTestId('add-pct-500').click();
  await page.getByTestId('send-checkout').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tutorial-card')).toContainText('pembayaran');

  // 4. Transaksi di kasir
  const before = await moneyValue(page);
  await page.getByTestId('quick-pos').click();
  await expect(page.getByTestId('pos-sale')).toBeVisible();
  await page.getByTestId('pos-complete').click();
  await expect(page.getByText(/Transaksi TRX-.* selesai/)).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await moneyValue(page)).toBe(before + 4000);

  // 5. Kelola stok: isi rak dari gudang
  await expect(page.getByTestId('tutorial-card')).toContainText('Isi rak');
  await page.getByTestId('hud-tablet').click();
  await page.getByTestId('tile-kelola-gudang').click();
  await page.getByRole('tab', { name: 'Stok & Batch' }).click();
  await page.getByRole('button', { name: /Vitamin C 500 mg/ }).click();
  const batches = page.getByTestId('batches-vitc-500');
  await batches.getByRole('button', { name: 'Pindah ke Rak Pelayanan' }).first().click();
  await batches.getByRole('button', { name: 'Konfirmasi' }).click();
  await expect(page.getByText('Perubahan stok dicatat.')).toBeVisible();
  await page.keyboard.press('Escape');

  // 6. Pengadaan
  await expect(page.getByTestId('tutorial-card')).toContainText('Pesan barang');
  await page.getByTestId('hud-tablet').click();
  await page.getByTestId('tile-pengadaan').click();
  await page.getByTestId('supplier-sup-cepat').click();
  await page.getByRole('spinbutton', { name: 'Vitamin C 500 mg' }).fill('30');
  await expect(page.getByTestId('place-order')).toBeVisible();
  await page.getByTestId('place-order').click();
  await expect(page.getByText(/Pesanan dikonfirmasi/)).toBeVisible();
  await page.keyboard.press('Escape');

  // Percepat waktu sampai barang tiba, lalu terima di gudang.
  await page.getByRole('button', { name: '8×' }).click();
  await page.getByTestId('hud-tablet').click();
  await page.getByTestId('tile-kelola-gudang').click();
  await page.getByRole('tab', { name: /Penerimaan/ }).click();
  await expect(page.locator('[data-testid^=receive-PO-]').first()).toBeVisible({ timeout: 170_000 });
  await page.locator('[data-testid^=receive-PO-]').first().click();
  await expect(page.getByText(/diterima ke gudang/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '1×' }).click();

  // 7. Misi: klaim hadiah "Pelanggan Pertama"
  await page.getByTestId('hud-tablet').click();
  await page.getByTestId('tile-misi-&-progres').click();
  const moneyBeforeClaim = await moneyValue(page);
  await page.getByTestId('claim-m-first-serve').click();
  await expect(page.getByText(/diklaim/)).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await moneyValue(page)).toBeGreaterThanOrEqual(moneyBeforeClaim + 100_000 - 10_000);

  // 8. Simpan ke slot 1
  await page.getByRole('button', { name: 'Jeda' }).click();
  await page.getByTestId('pause-save').click();
  await page.getByTestId('save-slot-1').click();
  await expect(page.getByText('Tersimpan di Slot 1.')).toBeVisible();
  const savedMoney = await moneyValue(page);

  // 9. Muat ulang halaman dan muat permainan
  await page.goto('/');
  await page.reload();
  await page.getByTestId('menu-load').click();
  await expect(page.getByTestId('slot-slot-1')).toContainText('Uji Sehat');
  await page.getByTestId('slot-slot-1').getByRole('button', { name: 'Muat' }).click();
  await expect(page.getByTestId('play-screen')).toBeVisible();
  expect(await moneyValue(page)).toBe(savedMoney);
  await expect(page.getByText('Hari 1 · Senin, 5 Jan 2026')).toBeVisible();

  expect(errors).toEqual([]);
});

test('Learning Mode: pelajaran resep dapat diselesaikan dengan umpan balik', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByTestId('player-name').fill('Pelajar');
  await page.getByTestId('mode-learning').click();
  await page.getByTestId('skip-tutorial').check();
  await page.getByTestId('continue-intro').click();
  await page.getByTestId('start-game').click();
  await page.getByTestId('hud-tablet').click();
  await page.getByTestId('tile-pelajaran').click();
  await page.getByTestId('start-lesson-rx').click();
  await expect(page.getByTestId('lesson-card')).toContainText('Pelayanan Resep');

  await page.getByTestId('quick-service').click();
  await page.getByTestId('call-next').click();
  await expect(page.getByTestId('rx-wizard')).toBeVisible();
  await page.getByRole('button', { name: /Lanjut ke pemeriksaan/ }).click();
  await page.getByTestId('rx-complete').click();

  // Siapkan setiap item: produk sesuai resep, batch FEFO, jumlah sesuai resep.
  const items = page.locator('[data-testid^=prepare-item-]');
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const item = items.nth(i);
    const header = (await page.getByTestId(`prepare-header-${i}`).textContent()) ?? '';
    const qty = Number(/No\. (\d+)/.exec(header)?.[1] ?? '1');
    const label = header.includes('Amoksisilin') ? 'Amoksisilin 500 mg (500 mg, kapsul)' : 'Parasetamol 500 mg (500 mg, tablet)';
    await page.getByTestId(`product-select-${i}`).selectOption({ label });
    await item.getByText('FEFO', { exact: true }).locator('xpath=ancestor::label').locator('input').check();
    for (let k = 0; k < qty; k++) await item.getByRole('button', { name: `Tambah Jumlah item ${i + 1}` }).click();
  }
  await page.getByRole('button', { name: /Lanjut ke etiket/ }).click();
  for (let i = 0; i < n; i++) {
    const resep = (await page.locator('text=/^Resep: “/').nth(i).textContent()) ?? '';
    const instr = resep.replace(/^Resep: “/, '').replace(/”$/, '');
    await page.getByTestId(`label-select-${i}`).selectOption(instr);
  }
  await page.getByTestId('label-ready').click();
  await page.getByTestId('dispense').click();
  await expect(page.getByText(/Obat diserahkan/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('quick-pos').click();
  await page.getByTestId('pos-complete').click();
  await page.keyboard.press('Escape');

  await page.getByTestId('hud-tablet').click();
  await page.getByTestId('tile-pelajaran').click();
  await expect(page.getByTestId('lesson-lesson-rx')).toContainText('Selesai');
  await expect(page.getByTestId('lesson-lesson-rx')).toContainText('Umpan balik terakhir');
});
