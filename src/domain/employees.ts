import { TIME } from './config';
import { addLedger, challengeMods, emit, fail, getEffects, notify, ok, today, type Result } from './core';
import { nextId } from './ids';
import { expiredBatches, quarantineBatch, restockShelf, stockOf } from './inventory';
import { findPatient } from './patients';
import { addSaleItem, cancelSale, completeSale, findSale, openSale } from './pos';
import { autoDraft, dispensePrescription, findPrescription, rejectPrescription, RESOLVABLE_ISSUES, confirmWithPrescriber } from './prescriptions';
import { autoReorder, receiveOrder } from './procurement';
import { addReputation, finishPatient, isFeatureUnlocked } from './progression';
import { chance, pick, rand, randInt } from './rng';
import { minuteOfDay } from './time';
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES } from '@/data/names';
import { SYMPTOM_PRODUCTS } from '@/data/medicines';
import type { Candidate, Employee, EmployeeRole, GameState, Patient, PatientCategory, Shift } from './types';

export const ROLE_INFO: Record<EmployeeRole, { label: string; baseSalary: number; description: string; serves: PatientCategory[] }> = {
  cashier: { label: 'Kasir', baseSalary: 110_000, description: 'Memproses pembayaran pasien yang menunggu di kasir, termasuk pembatalan.', serves: [] },
  warehouse: { label: 'Petugas Gudang', baseSalary: 100_000, description: 'Menerima kiriman, mengisi rak dari gudang, dan mengarantina batch kedaluwarsa.', serves: [] },
  assistant: { label: 'Asisten Pelayanan', baseSalary: 130_000, description: 'Melayani pasien obat bebas, pertanyaan ketersediaan, dan informasi umum.', serves: ['otc', 'canceller', 'inquiry', 'info'] },
  pharmacist: { label: 'Apoteker (simulasi)', baseSalary: 240_000, description: 'Melayani resep & tebus ulang serta pasien obat bebas. Tidak menangani racikan.', serves: ['prescription', 'refill', 'otc', 'canceller', 'inquiry', 'info'] },
  manager: { label: 'Manajer', baseSalary: 200_000, description: 'Menurunkan biaya operasional 5% dan dapat memesan ulang stok otomatis.', serves: [] },
};

export const SHIFT_LABELS: Record<Shift, string> = { pagi: 'Pagi (08–14)', siang: 'Siang (14–20)', penuh: 'Penuh (08–20)', libur: 'Libur' };

export function isOnShift(e: Employee, minute: number) {
  if (e.shift === 'libur') return false;
  if (minute < TIME.openMinute || minute >= TIME.closeMinute) return false;
  if (e.shift === 'pagi') return minute < 14 * 60;
  if (e.shift === 'siang') return minute >= 14 * 60;
  return true;
}

export function dailySalary(e: Employee) {
  if (e.shift === 'libur') return 0;
  return e.shift === 'penuh' ? e.salary : Math.round(e.salary * 0.6);
}

function candidateName(s: GameState) {
  const f = chance(s, 0.5);
  return `${pick(s, f ? FIRST_NAMES_F : FIRST_NAMES_M)} ${pick(s, LAST_NAMES)}`;
}

export function generateCandidates(s: GameState, n = 4) {
  const roles: EmployeeRole[] = ['cashier', 'warehouse', 'assistant', 'pharmacist', 'manager'];
  s.candidates = [];
  for (let i = 0; i < n; i++) {
    const role = i < roles.length && chance(s, 0.7) ? roles[(i + randInt(s, 0, 4)) % roles.length] : pick(s, roles);
    const skill = Math.round((0.45 + rand(s) * 0.5) * 100) / 100;
    const speed = Math.round((0.75 + rand(s) * 0.55) * 100) / 100;
    const level = 1 + Math.floor(rand(s) * 3);
    const salary = Math.round((ROLE_INFO[role].baseSalary * (0.7 + skill * 0.4 + (speed - 1) * 0.3 + (level - 1) * 0.08)) / 5000) * 5000;
    const c: Candidate = { id: nextId(s, 'CD'), name: candidateName(s), role, salary, speed, skill, level, appearance: randInt(s, 0, 7) };
    s.candidates.push(c);
  }
}

export function hireCandidate(s: GameState, candidateId: string): Result<Employee> {
  if (!isFeatureUnlocked(s, 'employees')) return fail('Fitur pegawai terbuka di Level 2.');
  if (challengeMods(s).noHiring) return fail('Tantangan ini tidak mengizinkan perekrutan.');
  const c = s.candidates.find((x) => x.id === candidateId);
  if (!c) return fail('Kandidat tidak ditemukan.');
  if (s.employees.length >= getEffects(s).maxEmployees) return fail('Slot pegawai penuh. Buka perluasan ruangan untuk menambah slot.');
  const e: Employee = {
    id: nextId(s, 'EM'),
    name: c.name,
    role: c.role,
    salary: c.salary,
    speed: c.speed,
    skill: c.skill,
    level: c.level,
    xp: 0,
    status: 'idle',
    shift: 'penuh',
    energy: 100,
    hiredDay: today(s),
    task: null,
    tasksDone: 0,
    errors: 0,
    appearance: c.appearance,
    autoEnabled: true,
  };
  s.employees.push(e);
  s.candidates = s.candidates.filter((x) => x.id !== candidateId);
  s.stats.employeesHired += 1;
  emit(s, { type: 'employee-hired', refId: e.id });
  notify(s, 'success', `${e.name} bergabung sebagai ${ROLE_INFO[e.role].label}.`);
  return ok(e);
}

/** Memberhentikan pegawai dengan pesangon satu hari gaji. */
export function fireEmployee(s: GameState, employeeId: string): Result<number> {
  const e = s.employees.find((x) => x.id === employeeId);
  if (!e) return fail('Pegawai tidak ditemukan.');
  releaseTask(s, e);
  s.employees = s.employees.filter((x) => x.id !== employeeId);
  const severance = e.salary;
  addLedger(s, 'salary', -severance, `Pesangon ${e.name}`, e.id);
  return ok(severance, `${e.name} diberhentikan. Pesangon Rp ${severance.toLocaleString('id-ID')}.`);
}

export function setShift(s: GameState, employeeId: string, shift: Shift): Result {
  const e = s.employees.find((x) => x.id === employeeId);
  if (!e) return fail('Pegawai tidak ditemukan.');
  e.shift = shift;
  if (shift === 'libur') releaseTask(s, e);
  return ok();
}

export function setAutomation(s: GameState, employeeId: string, enabled: boolean): Result {
  const e = s.employees.find((x) => x.id === employeeId);
  if (!e) return fail('Pegawai tidak ditemukan.');
  e.autoEnabled = enabled;
  if (!enabled) releaseTask(s, e);
  return ok();
}

/** Mengembalikan pasien yang sedang ditangani ke antrean bila tugas dihentikan. */
function releaseTask(s: GameState, e: Employee) {
  if (e.task?.kind === 'serve' && e.task.targetId) {
    const p = findPatient(s, e.task.targetId);
    if (p && p.status === 'serving' && p.servedBy === e.id) {
      p.status = 'waiting';
      p.servedBy = undefined;
      s.queue.unshift(p.id);
    }
  }
  e.task = null;
  e.status = 'idle';
}

function gainXp(s: GameState, e: Employee, amount: number) {
  e.xp += amount;
  e.tasksDone += 1;
  const need = 60 * e.level;
  if (e.xp >= need) {
    e.xp -= need;
    e.level += 1;
    e.skill = Math.min(0.98, Math.round((e.skill + 0.03) * 100) / 100);
    e.speed = Math.min(1.6, Math.round((e.speed + 0.03) * 100) / 100);
    notify(s, 'success', `${e.name} naik ke level ${e.level}.`);
  }
}

function concurrentServing(s: GameState) {
  return s.employees.filter((x) => x.task?.kind === 'serve').length;
}

function taskDuration(s: GameState, e: Employee, base: number) {
  const effects = getEffects(s);
  const tired = e.energy < 30 ? 1.4 : 1;
  return (base * tired) / (e.speed * effects.serviceSpeed);
}

/** Mencari pekerjaan berikutnya sesuai peran. */
function findWork(s: GameState, e: Employee) {
  const role = ROLE_INFO[e.role];
  if (role.serves.length && concurrentServing(s) < getEffects(s).serviceCounters) {
    const pid = s.queue.find((id) => {
      const p = findPatient(s, id);
      return p && p.status === 'waiting' && role.serves.includes(p.category) && (p.blockedUntil ?? 0) <= s.time.now && !p.scripted;
    });
    if (pid) {
      const p = findPatient(s, pid)!;
      p.status = 'serving';
      p.servedAt = s.time.now;
      p.servedBy = e.id;
      s.queue = s.queue.filter((q) => q !== pid);
      const base = p.category === 'prescription' || p.category === 'refill' ? 9 : p.category === 'otc' || p.category === 'canceller' ? 5 : 3;
      e.task = { kind: 'serve', targetId: pid, remaining: taskDuration(s, e, base) };
      return;
    }
  }
  if (e.role === 'cashier') {
    const p = s.patients.find(
      (x) => x.status === 'checkout' && x.saleId && findSale(s, x.saleId)?.status === 'open' && !s.employees.some((o) => o.task?.targetId === x.id),
    );
    if (p) {
      e.task = { kind: 'checkout', targetId: p.id, remaining: taskDuration(s, e, 2.5) };
      return;
    }
  }
  if (e.role === 'warehouse') {
    const arrived = s.purchaseOrders.find((o) => o.status === 'arrived' && !s.employees.some((x) => x.task?.targetId === o.id));
    if (arrived) {
      e.task = { kind: 'receive', targetId: arrived.id, remaining: taskDuration(s, e, 6) };
      return;
    }
    if (expiredBatches(s, 'shelf').some((b) => b.status === 'active')) {
      e.task = { kind: 'quarantine', remaining: taskDuration(s, e, 3) };
      return;
    }
    const low = s.medicines.find(
      (m) => m.active && stockOf(s, m.id, 'shelf') < m.minStock && stockOf(s, m.id, 'warehouse') > 0 && !s.employees.some((x) => x.task?.targetId === m.id),
    );
    if (low) {
      e.task = { kind: 'restock', targetId: low.id, remaining: taskDuration(s, e, 3) };
      return;
    }
  }
  if (e.role === 'manager' && s.pharmacy.autoReorder) {
    e.task = { kind: 'reorder', remaining: 90 };
  }
}

function completeTask(s: GameState, e: Employee) {
  const t = e.task!;
  e.task = null;
  switch (t.kind) {
    case 'serve': {
      const p = findPatient(s, t.targetId);
      if (p && p.status === 'serving' && p.servedBy === e.id) employeeResolvePatient(s, e, p);
      gainXp(s, e, 5);
      break;
    }
    case 'checkout': {
      const p = findPatient(s, t.targetId);
      const sale = p?.saleId ? findSale(s, p.saleId) : undefined;
      if (p && sale && sale.status === 'open') {
        if (p.cancelRequested) {
          cancelSale(s, sale.id);
        } else {
          const r = completeSale(s, sale.id, p.paymentMethod, e.id);
          if (r.ok && !chance(s, 0.6 + e.skill * 0.4)) {
            e.errors += 1;
            addReputation(s, -0.3);
            notify(s, 'warning', `${e.name} sempat keliru menghitung kembalian.`);
          }
        }
      }
      gainXp(s, e, 3);
      break;
    }
    case 'receive': {
      const r = t.targetId ? receiveOrder(s, t.targetId, e.id) : null;
      if (r && !r.ok) notify(s, 'warning', `${e.name}: ${r.error}`);
      gainXp(s, e, 5);
      break;
    }
    case 'quarantine': {
      const list = expiredBatches(s, 'shelf').filter((b) => b.status === 'active');
      for (const b of list) quarantineBatch(s, b.id);
      if (list.length) notify(s, 'info', `${e.name} mengarantina ${list.length} batch kedaluwarsa dari rak. Musnahkan di Inventaris.`);
      gainXp(s, e, 3);
      break;
    }
    case 'restock': {
      if (t.targetId) restockShelf(s, t.targetId);
      gainXp(s, e, 2);
      break;
    }
    case 'reorder': {
      autoReorder(s, e.name);
      break;
    }
    case 'rest':
      break;
  }
}

/** Pegawai menyelesaikan pelayanan pasien dengan peluang kesalahan berdasarkan kemampuan. */
export function employeeResolvePatient(s: GameState, e: Employee, p: Patient) {
  const correct = chance(s, 0.55 + e.skill * 0.45);
  switch (p.category) {
    case 'otc':
    case 'canceller': {
      const candidates = p.symptom ? SYMPTOM_PRODUCTS[p.symptom].products : p.requestedItems.map((r) => r.medicineId);
      const productId = candidates.find((id) => stockOf(s, id, 'shelf') > 0);
      if (!productId) {
        const inWarehouse = candidates.some((id) => stockOf(s, id, 'warehouse') > 0);
        notify(s, 'warning', `${e.name}: produk untuk ${p.name} ${inWarehouse ? 'kosong di rak (ada di gudang)' : 'habis'}.`);
        finishPatient(s, p, 'cancelled');
        if (inWarehouse) addReputation(s, -1);
        return;
      }
      const qty = p.requestedItems.find((r) => r.medicineId === productId)?.qty ?? 1;
      const sale = openSale(s, { patientId: p.id, source: 'employee', handledBy: e.id });
      const r = addSaleItem(s, sale.id, productId, Math.min(qty, stockOf(s, productId, 'shelf')));
      if (!r.ok) {
        cancelSale(s, sale.id, r.error, { skipPatient: true });
        finishPatient(s, p, 'cancelled');
        return;
      }
      if (!correct) {
        p.wrongAttempts += 1;
        e.errors += 1;
      }
      p.status = 'checkout';
      if (p.category === 'canceller') p.cancelRequested = true;
      return;
    }
    case 'inquiry':
    case 'info': {
      if (correct) {
        if (p.category === 'inquiry') s.stats.inquiriesAnswered += 1;
        else s.stats.infoAnswered += 1;
        finishPatient(s, p, 'served');
      } else {
        e.errors += 1;
        addReputation(s, -1);
        finishPatient(s, p, 'cancelled');
      }
      return;
    }
    case 'prescription':
    case 'refill': {
      const rx = p.prescriptionId ? findPrescription(s, p.prescriptionId) : undefined;
      if (!rx) {
        finishPatient(s, p, 'cancelled');
        return;
      }
      if (rx.hiddenIssue && !rx.issueResolved) {
        if (!RESOLVABLE_ISSUES.includes(rx.hiddenIssue)) {
          if (correct) {
            rejectPrescription(s, rx.id);
          } else {
            // Pegawai tidak menemukan masalah: dikembalikan ke pemain untuk ditinjau.
            e.errors += 1;
            returnToPlayer(s, p, `${e.name} ragu dengan resep ${rx.id}. Mohon tinjau di Meja Pelayanan.`);
          }
          return;
        }
        rx.status = 'on-hold';
        s.stats.issuesDetected += 1;
        confirmWithPrescriber(s, rx.id);
      }
      const draft = autoDraft(s, rx.id);
      const r = draft ? dispensePrescription(s, draft, e.id) : null;
      if (!r || !r.ok || !r.value?.saleId) {
        returnToPlayer(s, p, `${e.name} tidak dapat menyiapkan resep ${rx.id} (stok rak kurang/bermasalah).`);
        return;
      }
      if (!correct) {
        e.errors += 1;
        p.wrongAttempts += 1;
      }
      return;
    }
    default:
      returnToPlayer(s, p, `${p.name} memerlukan pelayanan pemain.`);
  }
}

function returnToPlayer(s: GameState, p: Patient, message: string) {
  p.status = 'waiting';
  p.servedBy = undefined;
  p.blockedUntil = s.time.now + 600;
  s.queue.unshift(p.id);
  notify(s, 'warning', message);
}

/** Simulasi pegawai per langkah waktu. */
export function tickEmployees(s: GameState, dt: number) {
  const minute = minuteOfDay(s.time.now);
  const effects = getEffects(s);
  for (const e of s.employees) {
    if (!isOnShift(e, minute)) {
      if (e.task && e.task.kind === 'serve') releaseTask(s, e);
      e.task = null;
      e.status = 'off';
      continue;
    }
    if (e.task?.kind === 'rest') {
      e.energy = Math.min(100, e.energy + 1.5 * effects.energyRecovery * dt);
      e.task.remaining -= dt;
      e.status = 'resting';
      if (e.task.remaining <= 0 || e.energy >= 90) e.task = null;
      continue;
    }
    const drain = e.role === 'manager' ? 0.02 : e.task ? 0.07 : 0.025;
    const managerBoost = s.employees.some((m) => m.role === 'manager' && m.id !== e.id && isOnShift(m, minute)) ? 0.8 : 1;
    e.energy = Math.max(0, e.energy - drain * dt * managerBoost);
    if (!e.task && e.energy < 15) {
      e.task = { kind: 'rest', remaining: 30 };
      e.status = 'resting';
      continue;
    }
    if (!e.task && e.autoEnabled) findWork(s, e);
    if (e.task) {
      e.status = 'working';
      e.task.remaining -= dt;
      if (e.task.remaining <= 0) completeTask(s, e);
    } else {
      e.status = 'idle';
    }
  }
}

/** Pemulihan energi harian. */
export function resetEmployeesForNewDay(s: GameState) {
  for (const e of s.employees) {
    e.energy = 100;
    e.task = null;
    e.status = e.shift === 'libur' ? 'off' : 'idle';
  }
}

