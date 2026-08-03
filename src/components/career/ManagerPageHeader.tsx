import type { ReactNode } from "react";

export interface ManagerHeaderMetric {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "accent" | "positive" | "warning" | "danger" | undefined;
}

interface ManagerPageHeaderProps {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  metrics?: readonly ManagerHeaderMetric[];
  actions?: ReactNode;
  compact?: boolean;
}

export function ManagerPageHeader({ eyebrow, title, subtitle, badge, metrics = [], actions, compact = false }: ManagerPageHeaderProps) {
  return (
    <header className={`manager-page-head${compact ? " manager-page-head--compact" : ""}`}>
      <div className="manager-page-head__identity">
        {badge !== undefined && <span className="manager-page-head__badge">{badge}</span>}
        <div>
          <small>{eyebrow}</small>
          <h1>{title}</h1>
          {subtitle !== undefined && <p>{subtitle}</p>}
        </div>
      </div>
      {metrics.length > 0 && (
        <div className="manager-page-head__metrics">
          {metrics.map((metric) => (
            <span key={metric.label} className={metric.tone ? `is-${metric.tone}` : undefined}>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              {metric.detail !== undefined && <em>{metric.detail}</em>}
            </span>
          ))}
        </div>
      )}
      {actions !== undefined && <div className="manager-page-head__actions">{actions}</div>}
    </header>
  );
}
