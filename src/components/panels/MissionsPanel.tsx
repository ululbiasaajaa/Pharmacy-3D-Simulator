import { useEffect, useState } from 'react';
import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Modal, ProgressBar, Stat, Tabs } from '@/components/ui/primitives';
import { useFeedback, useGameState } from './shared';
import { claimMission, missionDef } from '@/domain/missions';
import { tutorialSignal } from '@/domain/guidance';
import { ACHIEVEMENTS } from '@/data/achievements';
import { PROGRESSION } from '@/domain/config';
import { formatMoney } from '@/domain/time';
import type { MissionStatus } from '@/domain/types';

const ORDER: MissionStatus[] = ['completed', 'active', 'locked', 'claimed'];

export function MissionsPanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const fb = useFeedback();
  const [tab, setTab] = useState<'missions' | 'achievements' | 'progress'>('missions');
  useEffect(() => {
    act((s) => tutorialSignal(s, 'opened-missions'));
  }, []);
  const missions = [...game.missions].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const st = game.stats;
  return (
    <Modal title="Papan Misi" subtitle={`Level ${game.progression.level} · ${game.achievements.length}/${ACHIEVEMENTS.length} pencapaian`} onClose={close} testId="panel-missions">
      {fb.node}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'missions', label: 'Misi' },
          { id: 'achievements', label: 'Pencapaian' },
          { id: 'progress', label: 'Progres' },
        ]}
      />
      {tab === 'missions' && (
        <ul className="space-y-2">
          {missions.map((m) => {
            const def = missionDef(m.id)!;
            const prereq = def.requiresMission ? missionDef(def.requiresMission)?.name : null;
            return (
              <li key={m.id} className={`rounded-xl border p-3 text-sm ${m.status === 'completed' ? 'border-emerald-600 bg-emerald-950/30' : 'border-ink-700'} ${m.status === 'locked' || m.status === 'claimed' ? 'opacity-70' : ''}`} data-testid={`mission-${m.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">
                      {def.name}{' '}
                      <Badge tone={m.status === 'completed' ? 'green' : m.status === 'active' ? 'amber' : m.status === 'claimed' ? 'violet' : 'slate'}>
                        {m.status === 'completed' ? 'Selesai' : m.status === 'active' ? 'Aktif' : m.status === 'claimed' ? 'Diklaim' : 'Terkunci'}
                      </Badge>
                    </div>
                    <div className="text-muted text-xs">{def.description}</div>
                    {m.status === 'locked' && (
                      <div className="text-muted text-xs">
                        Syarat: Level {def.requiredLevel}
                        {prereq ? ` · selesaikan "${prereq}"` : ''}
                      </div>
                    )}
                    <div className="text-xs text-amber-200">
                      Hadiah: {def.reward.money ? formatMoney(def.reward.money) : ''} {def.reward.xp ? `· ${def.reward.xp} XP` : ''} {def.reward.reputation ? `· +${def.reward.reputation} reputasi` : ''}
                    </div>
                  </div>
                  {m.status === 'completed' && (
                    <Button variant="success" size="sm" onClick={() => fb.show(act((s) => claimMission(s, m.id)), `Hadiah "${def.name}" diklaim.`)} data-testid={`claim-${m.id}`}>
                      Klaim hadiah
                    </Button>
                  )}
                </div>
                {(m.status === 'active' || m.status === 'completed') && (
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={m.progress} max={def.objective.target} tone={m.status === 'completed' ? 'green' : 'amber'} />
                    <span className="text-muted shrink-0 text-xs tabular-nums">
                      {def.objective.type === 'revenue-total' ? `${formatMoney(m.progress)} / ${formatMoney(def.objective.target)}` : `${Math.floor(m.progress)} / ${def.objective.target}`}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {tab === 'achievements' && (
        <ul className="grid gap-2 md:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const got = game.achievements.find((x) => x.id === a.id);
            return (
              <li key={a.id} className={`rounded-xl border p-3 text-sm ${got ? 'border-amber-600 bg-amber-950/20' : 'border-ink-700 opacity-75'}`}>
                <div className="font-semibold">
                  {got ? '🏆' : '🔒'} {a.name}
                </div>
                <div className="text-muted text-xs">{a.description}</div>
                {!got && (
                  <div className="mt-1">
                    <ProgressBar value={Math.min(game.stats[a.stat], a.threshold)} max={a.threshold} label={a.name} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {tab === 'progress' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Level" value={game.progression.level} hint={`${game.progression.xp}/${PROGRESSION.xpPerLevel(game.progression.level)} XP`} />
            <Stat label="Reputasi" value={Math.round(game.progression.reputation)} />
            <Stat label="Hari selesai" value={st.daysCompleted} />
            <Stat label="Pasien dilayani" value={st.patientsServed} />
            <Stat label="Transaksi" value={st.salesCompleted} />
            <Stat label="Resep dilayani" value={st.prescriptionsDispensed} hint={`${st.perfectPrescriptions} sempurna`} />
            <Stat label="Racikan" value={st.compoundingCompleted} />
            <Stat label="Kesalahan" value={st.dispenseErrors} hint={`${st.fefoViolations} pelanggaran FEFO`} tone={st.dispenseErrors ? 'warn' : undefined} />
          </div>
        </div>
      )}
    </Modal>
  );
}
