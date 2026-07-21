import { ProspectLogo } from "../brand/ProspectLogo";

interface AppHeaderProps {
  action?: React.ReactNode;
  compact?: boolean;
}

export function AppHeader({ action, compact = false }: AppHeaderProps) {
  return (
    <header className="app-header">
      <ProspectLogo compact={compact} />
      <div className="app-header__right">
        <span className="system-chip"><i /> LOCAL / OFFLINE</span>
        {action}
      </div>
    </header>
  );
}
