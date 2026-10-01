import { useUi } from '@/stores/uiStore';
import { Badge, Callout, Modal, ProgressBar } from '@/components/ui/primitives';
import { useGameState } from './shared';
import { challengeDef, challengeProgress } from '@/domain/challenge';
import { formatMoney } from '@/domain/time';

export function ChallengePanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const def = challengeDef(game);
  const prog = challengeProgress(game);
  return (
    <Modal title="Tantangan" onClose={close} width="max-w-xl" testId="panel-challenge">
      {!def || !prog || !game.challenge ? (
        <Callout tone="info">Tidak ada tantangan aktif. Pilih Mode Tantangan saat memulai permainan baru.</Callout>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="text-lg font-semibold text-white">
            {def.name}{' '}
            <Badge tone={game.challenge.status === 'won' ? 'green' : game.challenge.status === 'lost' ? 'red' : 'amber'}>
              {game.challenge.status === 'won' ? 'Berhasil' : game.challenge.status === 'lost' ? 'Gagal' : `Sisa ${prog.daysLeft} hari`}
            </Badge>
          </div>
          <p>{def.description}</p>
          <div>
            <div className="text-muted text-xs font-semibold uppercase">Kondisi awal & batasan</div>
            <ul className="list-disc pl-5">
              <li>Modal awal {formatMoney(def.startingMoney)}</li>
              {def.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-muted text-xs font-semibold uppercase">Tujuan</div>
            <div className="mb-1">
              {prog.label}: {prog.label.includes('Pasien') ? `${prog.current} / ${prog.target}` : `${formatMoney(prog.current)} / ${formatMoney(prog.target)}`}
            </div>
            <ProgressBar value={Math.max(0, prog.current)} max={prog.target} tone={prog.met ? 'green' : 'brand'} />
            {prog.secondaryLabel && <div className={`mt-1 ${prog.secondaryOk ? 'text-emerald-300' : 'text-amber-300'}`}>{prog.secondaryOk ? '✔' : '⚠'} {prog.secondaryLabel}</div>}
          </div>
          <p className="text-muted text-xs">Target jumlah dapat tercapai kapan saja; target laba dievaluasi saat tutup hari. Tantangan gagal bila batas hari habis.</p>
          {game.challenge.resultText && <Callout tone={game.challenge.status === 'won' ? 'success' : 'error'}>{game.challenge.resultText}</Callout>}
        </div>
      )}
    </Modal>
  );
}
