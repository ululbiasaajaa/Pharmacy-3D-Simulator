import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenShell } from './ScreenShell';
import { Badge, Button, Callout, ConfirmDialog } from '@/components/ui/primitives';
import { deleteSave, importSaveFile, listSaves, loadGame, SLOT_LABELS, type SlotInfo } from '@/services/persistence/saveService';
import { useGame } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { formatMoney } from '@/domain/time';
import type { GameState } from '@/domain/types';

const MODE_LABEL: Record<string, string> = { career: 'Karier', learning: 'Pembelajaran', challenge: 'Tantangan' };

export function LoadScreen() {
  const nav = useNavigate();
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => void listSaves().then(setSlots), []);
  useEffect(refresh, [refresh]);

  const start = (state: GameState, slot: SlotInfo['slot'] | null) => {
    useUi.getState().reset();
    useGame.getState().load(state, slot);
    nav('/play');
  };

  const onLoad = async (slot: SlotInfo['slot']) => {
    setError(null);
    const r = await loadGame(slot);
    if (!r.ok) {
      setError(r.error + (r.corrupt ? ' Data ini tidak dapat dipulihkan; hapus slot atau muat cadangan.' : ''));
      return;
    }
    start(r.state, slot);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const r = await importSaveFile(file);
    if (!r.ok) setError(r.error);
    else start(r.state, null);
  };

  return (
    <ScreenShell title="Muat Permainan">
      <div className="space-y-3">
        {error && <Callout tone="error">{error}</Callout>}
        {slots.map((s) => (
          <div key={s.slot} className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4" data-testid={`slot-${s.slot}`}>
            <div>
              <div className="flex items-center gap-2 font-semibold text-white">
                {SLOT_LABELS[s.slot]}
                {s.corrupt && <Badge tone="red">Rusak</Badge>}
              </div>
              {s.record ? (
                <div className="text-muted text-sm">
                  {s.record.summary.pharmacyName} · {s.record.summary.playerName} · {MODE_LABEL[s.record.summary.mode] ?? s.record.summary.mode} · Hari {s.record.summary.day} · Level {s.record.summary.level} ·{' '}
                  {formatMoney(s.record.summary.money)}
                  <div className="text-xs">Disimpan {new Date(s.record.savedAt).toLocaleString('id-ID')}</div>
                </div>
              ) : (
                <div className="text-muted text-sm">{s.corrupt ? 'Data slot tidak dapat dibaca.' : 'Kosong'}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" disabled={!s.record} onClick={() => onLoad(s.slot)}>
                Muat
              </Button>
              <Button variant="danger" disabled={!s.record && !s.corrupt} onClick={() => setConfirmDelete(s.slot)}>
                Hapus
              </Button>
            </div>
          </div>
        ))}
        <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
          <div>
            <div className="font-semibold text-white">Impor cadangan (.json)</div>
            <div className="text-muted text-sm">Berkas diekspor dari menu jeda → Simpan. Data divalidasi sebelum dimuat.</div>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
          <Button onClick={() => fileRef.current?.click()}>Pilih berkas…</Button>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Hapus simpanan?"
          message={`Data pada ${SLOT_LABELS[confirmDelete as SlotInfo['slot']]} akan dihapus permanen.`}
          confirmLabel="Hapus"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            await deleteSave(confirmDelete);
            setConfirmDelete(null);
            refresh();
          }}
        />
      )}
    </ScreenShell>
  );
}
