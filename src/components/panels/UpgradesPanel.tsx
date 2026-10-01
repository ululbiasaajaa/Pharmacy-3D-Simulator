import { act } from '@/stores/gameStore';
import { useUi } from '@/stores/uiStore';
import { Badge, Button, Modal, Stat } from '@/components/ui/primitives';
import { FeatureLock, useFeedback, useGameState } from './shared';
import { buyUpgrade, upgradeAvailability, upgradeLevel } from '@/domain/upgrades';
import { getEffects } from '@/domain/core';
import { UPGRADES } from '@/data/upgrades';
import { formatMoney } from '@/domain/time';

export function UpgradesPanel() {
  const game = useGameState();
  const close = useUi((s) => s.closePanel);
  const fb = useFeedback();
  const e = getEffects(game);
  const groups: { kind: 'upgrade' | 'cosmetic' | 'expansion'; title: string }[] = [
    { kind: 'upgrade', title: 'Peningkatan Fasilitas' },
    { kind: 'cosmetic', title: 'Kosmetik (efek kecil)' },
    { kind: 'expansion', title: 'Perluasan Ruangan' },
  ];
  return (
    <Modal title="Denah Pengembangan" subtitle={`Kas ${formatMoney(game.money)}`} onClose={close} testId="panel-upgrades">
      <FeatureLock feature="upgrades">
        {fb.node}
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Stat label="Kapasitas rak" value={e.shelfCapacity} />
          <Stat label="Kapasitas gudang" value={e.warehouseCapacity} />
          <Stat label="Kapasitas antrean" value={e.queueCapacity} />
          <Stat label="Slot pegawai" value={e.maxEmployees} />
          <Stat label="Biaya operasional" value={`${Math.round(e.operationalCostMult * 100)}%`} />
        </div>
        {groups.map((g) => (
          <section key={g.kind} className="mb-5">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-300">{g.title}</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {UPGRADES.filter((u) => u.kind === g.kind).map((u) => {
                const level = upgradeLevel(game, u.id);
                const av = upgradeAvailability(game, u);
                const next = u.levels[level];
                return (
                  <div key={u.id} className="rounded-xl border border-ink-700 p-3 text-sm" data-testid={`upgrade-${u.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-white">{u.name}</div>
                      <Badge tone={level >= u.levels.length ? 'green' : 'slate'}>
                        Lv {level}/{u.levels.length}
                      </Badge>
                    </div>
                    <div className="text-muted text-xs">{u.description}</div>
                    {next ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs">
                          Berikutnya: <span className="text-slate-100">{next.description}</span>
                          <div className="font-semibold">{formatMoney(next.cost)}</div>
                        </div>
                        <Button size="sm" variant="primary" disabled={!av.canBuy} title={av.reason} onClick={() => fb.show(act((s) => buyUpgrade(s, u.id)), `${u.name} ditingkatkan.`)}>
                          {av.canBuy ? 'Beli' : av.reason}
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-emerald-300">Level maksimum tercapai.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </FeatureLock>
    </Modal>
  );
}
