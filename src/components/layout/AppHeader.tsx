import { ProspectLogo } from "../brand/ProspectLogo";

interface AppHeaderProps {
  action?: React.ReactNode;
  compact?: boolean;
  context?: string;
}

export function AppHeader({ action, compact = false, context }: AppHeaderProps) {
  return (
    <header className={`app-header ${compact ? "app-header--compact" : ""}`}>
      <ProspectLogo compact={compact} />
      <div className="app-header__right">
        {context && <span className="app-header__context">{context}</span>}
        <span className="sync-status" title="Сохранения находятся на этом устройстве"><i /> Сохранено локально</span>
        {action}
      </div>
    </header>
  );
}
