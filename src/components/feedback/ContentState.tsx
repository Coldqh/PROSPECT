import type { ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "spark", title, description, action }: EmptyStateProps) {
  return (
    <section className="content-state content-state--empty">
      <span className="content-state__icon"><Icon name={icon} size={24} /></span>
      <div><h3>{title}</h3><p>{description}</p></div>
      {action}
    </section>
  );
}

export function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className={`skeleton-card ${tall ? "skeleton-card--tall" : ""}`} aria-hidden="true">
      <span className="skeleton-card__visual" />
      <span className="skeleton-card__line skeleton-card__line--title" />
      <span className="skeleton-card__line" />
      <span className="skeleton-card__line skeleton-card__line--short" />
    </div>
  );
}
