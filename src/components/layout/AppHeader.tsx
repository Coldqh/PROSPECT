import { ProspectLogo } from "../brand/ProspectLogo";

interface AppHeaderProps {
  action?: React.ReactNode;
}

export function AppHeader({ action }: AppHeaderProps) {
  return (
    <header className="app-header">
      <ProspectLogo />
      {action}
    </header>
  );
}
