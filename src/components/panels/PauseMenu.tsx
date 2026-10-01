import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { useT } from '@/app/i18n';
import { Button, Callout, ConfirmDialog, Modal } from '@/components/ui/primitives';
import { SettingsForm } from '@/components/screens/SettingsForm';
import { exportSaveBlob, SLOT_LABELS, type SlotId } from '@/services/persistence/saveService';

export function PauseMenu() {
  const t = useT();
  const nav = useNavigate();
  const closePanel = useUi((s) => s.closePanel);
  const setPaused = useUi((s) => s.setPaused);
  const save = useGame((s) => s.save);
  const quit = useGame((s) => s.quit);
  const slot = useGame((s) => s.slot);
  const saving = useGame((s) => s.saving);
  const [view, setView] = useState<'main' | 'save' | 'settings'>('main');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const resume = () => {
    setPaused(false);
    closePanel();
  };
  const doSave = async (s: SlotId) => {
    const ok = await save(s);
    setMsg(ok ? { tone: 'success', text: `Tersimpan di ${SLOT_LABELS[s]}.` } : { tone: 'error', text: 'Gagal menyimpan. Penyimpanan lokal mungkin tidak tersedia.' });
  };
  const exportFile = () => {
    const game = useGame.getState().game;
    if (!game) return;
    const url = URL.createObjectURL(exportSaveBlob(game));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy3d-${game.profile.pharmacyName.replace(/\W+/g, '_')}-hari${game.time.day}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title={t('pause.title')} onClose={resume} width={view === 'settings' ? 'max-w-3xl' : 'max-w-md'} testId="panel-pause">
      {msg && (
        <div className="mb-3">
          <Callout tone={msg.tone}>{msg.text}</Callout>
        </div>
      )}
      {view === 'main' && (
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={resume} data-testid="pause-resume">
            {t('pause.resume')}
          </Button>
          <Button size="lg" onClick={() => setView('save')} data-testid="pause-save">
            {t('pause.save')}
          </Button>
          <Button size="lg" onClick={() => setView('settings')}>
            {t('pause.settings')}
          </Button>
          <Button size="lg" variant="danger" onClick={() => setConfirmQuit(true)} data-testid="pause-quit">
            {t('pause.quit')}
          </Button>
        </div>
      )}
      {view === 'save' && (
        <div className="space-y-2">
          {(['slot-1', 'slot-2', 'slot-3'] as SlotId[]).map((s) => (
            <Button key={s} className="w-full justify-between" disabled={saving} onClick={() => doSave(s)} data-testid={`save-${s}`}>
              {SLOT_LABELS[s]} {slot === s && <span className="text-muted text-xs">(slot aktif)</span>}
            </Button>
          ))}
          <Button className="w-full" onClick={exportFile}>
            ⬇ Ekspor cadangan (.json)
          </Button>
          <p className="text-muted text-xs">Simpan otomatis berjalan setiap tutup hari dan setiap 2 menit.</p>
          <Button variant="ghost" onClick={() => setView('main')}>
            ← {t('common.back')}
          </Button>
        </div>
      )}
      {view === 'settings' && (
        <div>
          <SettingsForm />
          <Button variant="ghost" className="mt-3" onClick={() => setView('main')}>
            ← {t('common.back')}
          </Button>
        </div>
      )}
      {confirmQuit && (
        <ConfirmDialog
          title="Keluar ke menu utama?"
          message="Permainan akan disimpan ke slot Simpan Otomatis sebelum keluar."
          confirmLabel="Simpan & keluar"
          onCancel={() => setConfirmQuit(false)}
          onConfirm={async () => {
            await save('auto');
            if (slot && slot !== 'auto') await save(slot);
            useUi.getState().reset();
            quit();
            nav('/');
          }}
        />
      )}
    </Modal>
  );
}
