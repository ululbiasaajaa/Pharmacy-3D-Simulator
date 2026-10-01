import { ScreenShell } from './ScreenShell';
import { SettingsForm } from './SettingsForm';
import { useT } from '@/app/i18n';

export function SettingsScreen() {
  const t = useT();
  return (
    <ScreenShell title={t('settings.title')}>
      <div className="panel rounded-2xl p-5">
        <SettingsForm />
      </div>
    </ScreenShell>
  );
}
