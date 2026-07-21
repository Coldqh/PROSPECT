interface SectionTab<T extends string> {
  id: T;
  label: string;
  badge?: string;
}

interface SectionTabsProps<T extends string> {
  tabs: readonly SectionTab<T>[];
  active: T;
  onChange(tab: T): void;
  ariaLabel: string;
}

export function SectionTabs<T extends string>({ tabs, active, onChange, ariaLabel }: SectionTabsProps<T>) {
  return (
    <nav className="section-tabs" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? "is-active" : ""}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.label}</span>
          {tab.badge && <small>{tab.badge}</small>}
        </button>
      ))}
    </nav>
  );
}
