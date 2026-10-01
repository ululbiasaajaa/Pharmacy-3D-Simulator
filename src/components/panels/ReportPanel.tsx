import { useEffect, useState } from 'react';
import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, ConfirmDialog, Empty, Modal, Stat, Tabs } from '@/components/ui/primitives';
import { useGameState } from './shared';
import { closeDay, startNextDay } from '@/domain/simulation';
import { financeSummary } from '@/domain/finance';
import { itemDisplayName } from '@/domain/compounding';
import { formatClock, formatMoney } from '@/domain/time';
import { performanceReview } from '@/services/ai/aiService';
import type { DailyReport } from '@/domain/types';

function ReportView({ r }: { r: DailyReport }) {
  const game = useGameState();
  const [review, setReview] = useState<{ text: string; source: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void performanceReview(r).then((x) => alive && setReview(x));
    return () => {
      alive = false;
    };
  }, [r]);
  return (
    <div className="space-y-4" data-testid="daily-report">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Pemasukan" value={formatMoney(r.revenue)} tone="good" />
        <Stat label="Pengeluaran" value={formatMoney(r.expenses)} tone="bad" />
        <Stat label="Kerugian stok" value={formatMoney(r.nonCashLosses)} tone={r.nonCashLosses ? 'warn' : undefined} />
        <Stat label="Laba/rugi" value={formatMoney(r.profit)} tone={r.profit >= 0 ? 'good' : 'bad'} />
        <Stat label="Pasien dilayani" value={r.patientsServed} />
        <Stat label="Pasien pergi" value={r.patientsLeft} tone={r.patientsLeft ? 'warn' : 'good'} />
        <Stat label="Resep / racikan" value={`${r.prescriptionsDispensed} / ${r.compoundingDone}`} />
        <Stat label="Rata-rata tunggu" value={`${Math.round(r.avgWaitMinutes)} mnt`} />
        <Stat label="Transaksi" value={r.salesCount} />
        <Stat label="Kesalahan" value={r.errors} tone={r.errors ? 'warn' : 'good'} />
        <Stat label="Reputasi" value={`${Math.round(r.reputationStart)} → ${Math.round(r.reputationEnd)}`} tone={r.reputationEnd >= r.reputationStart ? 'good' : 'bad'} />
        <Stat label="Kas akhir" value={formatMoney(r.moneyEnd)} tone={r.moneyEnd >= 0 ? undefined : 'bad'} />
      </div>
      <div className="rounded-xl border border-ink-600 bg-ink-850 p-3 text-sm">
        <div className="text-muted mb-1 text-xs font-semibold uppercase">Ulasan performa {review?.source === 'ai' ? '(AI, dari data laporan)' : '(otomatis, dari data laporan)'}</div>
        <p>{review?.text ?? 'Menyusun ulasan…'}</p>
      </div>
      {r.topProducts.length > 0 && (
        <div className="text-sm">
          <span className="text-muted text-xs font-semibold uppercase">Terlaris: </span>
          {r.topProducts.map((t) => `${itemDisplayName(game, t.medicineId)} (${t.qty})`).join(', ')}
        </div>
      )}
    </div>
  );
}

function StatusView() {
  const game = useGameState();
  const d0 = game.dayStart.stats;
  const st = game.stats;
  const f = financeSummary(game, game.time.day, game.time.day);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Jam" value={formatClock(game.time.now)} />
        <Stat label="Pasien dilayani hari ini" value={st.patientsServed - d0.patientsServed} />
        <Stat label="Pasien pergi hari ini" value={st.patientsLeft - d0.patientsLeft} />
        <Stat label="Transaksi hari ini" value={st.salesCompleted - d0.salesCompleted} />
        <Stat label="Pemasukan hari ini" value={formatMoney(f.income)} />
        <Stat label="Pengeluaran hari ini" value={formatMoney(f.expenses)} />
        <Stat label="Reputasi" value={Math.round(game.progression.reputation)} />
        <Stat label="Kas" value={formatMoney(game.money)} />
      </div>
      {game.activeEvents.length > 0 && (
        <div className="space-y-1">
          {game.activeEvents.map((e) => (
            <div key={e.id} className="rounded-lg border border-violet-700 bg-violet-950/40 p-2 text-sm">
              <Badge tone="violet">Event</Badge> <strong>{e.name}</strong> — {e.description}
              <div className="text-muted text-xs">
                {e.narrative} · berakhir {formatClock(e.endAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReportPanel({ initialTab }: { initialTab?: string }) {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const [tab, setTab] = useState<'report' | 'status' | 'history'>(game.time.phase === 'closed' && initialTab !== 'status' ? 'report' : 'status');
  const [confirmClose, setConfirmClose] = useState(false);
  const today = game.reports.find((r) => r.day === game.time.day);
  return (
    <Modal
      title={game.time.phase === 'closed' ? `Laporan Hari ${game.time.day}` : 'Status Apotek'}
      onClose={close}
      testId="panel-report"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {game.time.phase === 'open' && (
            <Button variant="danger" onClick={() => setConfirmClose(true)}>
              Tutup lebih awal
            </Button>
          )}
          {game.time.phase === 'closed' && !game.gameOver && (
            <Button
              variant="primary"
              data-testid="start-next-day"
              onClick={() => {
                act(startNextDay);
                close();
              }}
            >
              ☀ Mulai hari berikutnya
            </Button>
          )}
        </div>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'report', label: 'Laporan hari ini', disabled: !today },
          { id: 'status', label: 'Status saat ini' },
          { id: 'history', label: `Riwayat (${game.reports.length})` },
        ]}
      />
      {tab === 'report' && (today ? <ReportView r={today} /> : <Empty>Laporan dibuat saat apotek tutup.</Empty>)}
      {tab === 'status' && <StatusView />}
      {tab === 'history' &&
        (game.reports.length === 0 ? (
          <Empty>Belum ada laporan.</Empty>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...game.reports].reverse().map((r) => (
              <li key={r.day} className="flex flex-wrap justify-between gap-2 rounded border border-ink-700 px-3 py-1.5">
                <span>Hari {r.day}</span>
                <span>
                  {r.patientsServed} dilayani · laba <span className={r.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatMoney(r.profit)}</span>
                </span>
              </li>
            ))}
          </ul>
        ))}
      {confirmClose && (
        <ConfirmDialog
          title="Tutup apotek sekarang?"
          message="Pasien yang masih menunggu akan pulang. Gaji & biaya operasional tetap dibayar penuh."
          confirmLabel="Tutup"
          danger
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            act(closeDay);
            setTab('report');
          }}
        />
      )}
    </Modal>
  );
}
