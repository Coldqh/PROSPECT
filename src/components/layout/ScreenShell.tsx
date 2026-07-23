import type { ReactNode } from "react";

interface ScreenShellProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  narrow?: boolean;
  className?: string;
}

export function ScreenShell({ children, header, footer, narrow = false, className = "" }: ScreenShellProps) {
  return (
    <div className={`app-shell ${className}`.trim()}>
      {header}
      <main className={`${narrow ? "screen screen--narrow" : "screen"} page-transition`}>{children}</main>
      {footer}
    </div>
  );
}
