import { useUi } from '@/stores/uiStore';
import { ServicePanel } from './ServicePanel';
import { PosPanel } from './PosPanel';
import { InventoryPanel } from './InventoryPanel';
import { CatalogPanel } from './CatalogPanel';
import { ProcurementPanel } from './ProcurementPanel';
import { FinancePanel } from './FinancePanel';
import { CompoundingPanel } from './CompoundingPanel';
import { EmployeesPanel } from './EmployeesPanel';
import { UpgradesPanel } from './UpgradesPanel';
import { MissionsPanel } from './MissionsPanel';
import { TabletPanel } from './TabletPanel';
import { PauseMenu } from './PauseMenu';
import { ReportPanel } from './ReportPanel';
import { LessonsPanel } from './LessonsPanel';
import { ChallengePanel } from './ChallengePanel';

export function PanelHost({ quickAccess }: { quickAccess: boolean }) {
  const panel = useUi((s) => s.panel);
  const args = useUi((s) => s.args);
  switch (panel) {
    case 'service':
      return <ServicePanel initialTab={args.tab} />;
    case 'pos':
      return <PosPanel />;
    case 'inventory':
      return <InventoryPanel manage={!!args.manage || quickAccess} location={args.location} category={args.category} refrigerated={args.refrigerated} initialTab={args.tab} />;
    case 'catalog':
      return <CatalogPanel />;
    case 'procurement':
      return <ProcurementPanel />;
    case 'finance':
      return <FinancePanel />;
    case 'compounding':
      return <CompoundingPanel />;
    case 'employees':
      return <EmployeesPanel />;
    case 'upgrades':
      return <UpgradesPanel />;
    case 'missions':
      return <MissionsPanel />;
    case 'tablet':
      return <TabletPanel quickAccess={quickAccess} />;
    case 'pause':
      return <PauseMenu />;
    case 'report':
      return <ReportPanel initialTab={args.tab} />;
    case 'lessons':
      return <LessonsPanel />;
    case 'challenge':
      return <ChallengePanel />;
    default:
      return null;
  }
}
