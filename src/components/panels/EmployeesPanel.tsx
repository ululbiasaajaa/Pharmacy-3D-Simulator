import { useState } from 'react';
import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Callout, ConfirmDialog, Empty, Modal, ProgressBar, Tabs, inputClass } from '@/components/ui/primitives';
import { FeatureLock, useFeedback, useGameState } from './shared';
import { dailySalary, fireEmployee, hireCandidate, ROLE_INFO, setAutomation, setShift, SHIFT_LABELS } from '@/domain/employees';
import { getEffects, challengeMods } from '@/domain/core';
import { setAutoReorder } from '@/domain/procurement';
import { formatMoney } from '@/domain/time';
import type { Shift } from '@/domain/types';

const TASK_LABELS: Record<string, string> = {
  serve: 'Melayani pasien',
  checkout: 'Memproses pembayaran',
  restock: 'Mengisi rak',
  receive: 'Menerima kiriman',
  quarantine: 'Karantina batch ED',
  reorder: 'Meninjau stok',
  rest: 'Istirahat',
};

export function EmployeesPanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const fb = useFeedback();
  const [tab, setTab] = useState<'team' | 'hire' | 'roles'>('team');
  const [firing, setFiring] = useState<string | null>(null);
  const max = getEffects(game).maxEmployees;
  const noHiring = !!challengeMods(game).noHiring;
  const payroll = game.employees.reduce((a, e) => a + dailySalary(e), 0);
  return (
    <Modal title="Pegawai" subtitle={`${game.employees.length}/${max} slot · gaji harian ${formatMoney(payroll)}`} onClose={close} testId="panel-employees">
      <FeatureLock feature="employees">
        {fb.node}
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'team', label: `Tim (${game.employees.length})` },
            { id: 'hire', label: `Rekrut (${game.candidates.length})` },
            { id: 'roles', label: 'Peran' },
          ]}
        />
        {tab === 'team' &&
          (game.employees.length === 0 ? (
            <Empty>Belum ada pegawai. Rekrut kandidat pada tab Rekrut.</Empty>
          ) : (
            <div className="space-y-2">
              {game.employees.map((e) => (
                <div key={e.id} className="rounded-xl border border-ink-700 p-3 text-sm" data-testid={`employee-${e.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">
                        {e.name} <Badge tone="blue">{ROLE_INFO[e.role].label}</Badge> <Badge>Lv {e.level}</Badge>
                      </div>
                      <div className="text-muted text-xs">
                        Kemampuan {Math.round(e.skill * 100)}% · Kecepatan {e.speed.toFixed(2)}× · Gaji {formatMoney(e.salary)}/hari penuh · Tugas selesai {e.tasksDone} · Kesalahan {e.errors}
                      </div>
                      <div className="mt-1 text-xs">
                        Status:{' '}
                        <Badge tone={e.status === 'working' ? 'green' : e.status === 'resting' ? 'amber' : e.status === 'off' ? 'slate' : 'blue'}>
                          {e.status === 'working' ? 'Bekerja' : e.status === 'resting' ? 'Istirahat' : e.status === 'off' ? 'Tidak bertugas' : 'Siaga'}
                        </Badge>{' '}
                        {e.task && <span className="text-muted">{TASK_LABELS[e.task.kind]}</span>}
                      </div>
                    </div>
                    <div className="w-36">
                      <div className="text-muted text-[11px]">Energi {Math.round(e.energy)}%</div>
                      <ProgressBar value={e.energy} tone={e.energy > 50 ? 'green' : e.energy > 20 ? 'amber' : 'red'} label="Energi" />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-xs">
                      Jadwal{' '}
                      <select className={`${inputClass} inline-block w-auto py-1`} value={e.shift} onChange={(ev) => fb.show(act((s) => setShift(s, e.id, ev.target.value as Shift)), 'Jadwal diperbarui.')}>
                        {(Object.keys(SHIFT_LABELS) as Shift[]).map((sh) => (
                          <option key={sh} value={sh}>
                            {SHIFT_LABELS[sh]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={e.autoEnabled} onChange={(ev) => act((s) => setAutomation(s, e.id, ev.target.checked))} /> Kerja otomatis
                    </label>
                    {e.role === 'manager' && (
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={game.pharmacy.autoReorder} onChange={(ev) => fb.show(act((s) => setAutoReorder(s, ev.target.checked)))} /> Pesan ulang otomatis
                      </label>
                    )}
                    <Button size="sm" variant="danger" onClick={() => setFiring(e.id)}>
                      Berhentikan
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-muted text-xs">Gaji dibayar saat tutup hari: shift penuh 100%, pagi/siang 60%, libur 0%. Pegawai yang lelah bekerja lebih lambat.</p>
            </div>
          ))}
        {tab === 'hire' && (
          <div className="space-y-2">
            {noHiring && <Callout tone="warn">Tantangan ini tidak mengizinkan perekrutan.</Callout>}
            {game.employees.length >= max && <Callout tone="warn">Slot pegawai penuh ({max}). Buka perluasan ruangan untuk menambah slot.</Callout>}
            {game.candidates.length === 0 ? (
              <Empty>Kandidat baru datang setiap hari.</Empty>
            ) : (
              game.candidates.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700 p-3 text-sm">
                  <div>
                    <div className="font-semibold">
                      {c.name} <Badge tone="blue">{ROLE_INFO[c.role].label}</Badge> <Badge>Lv {c.level}</Badge>
                    </div>
                    <div className="text-muted text-xs">
                      Kemampuan {Math.round(c.skill * 100)}% · Kecepatan {c.speed.toFixed(2)}× · Gaji {formatMoney(c.salary)}/hari
                    </div>
                    <div className="text-muted text-xs">{ROLE_INFO[c.role].description}</div>
                  </div>
                  <Button variant="primary" disabled={noHiring || game.employees.length >= max} onClick={() => fb.show(act((s) => hireCandidate(s, c.id)), `${c.name} direkrut.`)} data-testid={`hire-${c.id}`}>
                    Rekrut
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'roles' && (
          <ul className="space-y-2 text-sm">
            {Object.entries(ROLE_INFO).map(([k, r]) => (
              <li key={k} className="rounded-lg border border-ink-700 p-3">
                <div className="font-semibold">{r.label}</div>
                <div className="text-muted text-xs">{r.description}</div>
                <div className="text-muted text-xs">Gaji dasar ±{formatMoney(r.baseSalary)}/hari</div>
              </li>
            ))}
            <li className="text-muted text-xs">Racikan selalu dikerjakan oleh pemain. Pegawai dapat keliru sesuai tingkat kemampuan — tinjau hasil kerja mereka.</li>
          </ul>
        )}
        {firing && (
          <ConfirmDialog
            title="Berhentikan pegawai?"
            message="Pesangon satu hari gaji akan dibayarkan. Tindakan ini tidak dapat dibatalkan."
            danger
            confirmLabel="Berhentikan"
            onCancel={() => setFiring(null)}
            onConfirm={() => {
              fb.show(act((s) => fireEmployee(s, firing)));
              setFiring(null);
            }}
          />
        )}
      </FeatureLock>
    </Modal>
  );
}
