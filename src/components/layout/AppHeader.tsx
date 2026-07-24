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
        {action}
      </div>
    </header>
  );
}
