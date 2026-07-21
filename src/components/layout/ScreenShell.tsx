import type { ReactNode } from "react";

interface ScreenShellProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  narrow?: boolean;
}

export function ScreenShell({ children, header, footer, narrow = false }: ScreenShellProps) {
  return (
    <div className="app-shell">
      {header}
      <main className={narrow ? "screen screen--narrow" : "screen"}>{children}</main>
      {footer}
    </div>
  );
}
