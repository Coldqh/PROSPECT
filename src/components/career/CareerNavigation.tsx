import { Icon, type IconName } from "../ui/Icon";

export type CareerPrimaryView = "today" | "career" | "world";

const items = [
  { id: "today", label: "Сегодня", icon: "home" },
  { id: "career", label: "Карьера", icon: "chart" },
  { id: "world", label: "Мир", icon: "pulse" },
] as const satisfies readonly { id: CareerPrimaryView; label: string; icon: IconName }[];

interface CareerNavigationProps {
  active: CareerPrimaryView;
  onChange(view: CareerPrimaryView): void;
  variant?: "bottom" | "rail";
}

export function CareerNavigation({ active, onChange, variant = "bottom" }: CareerNavigationProps) {
  return (
    <nav className={`career-primary-nav career-primary-nav--${variant}`} aria-label="Основные разделы карьеры">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? "is-active" : ""}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          <span className="career-primary-nav__icon"><Icon name={item.icon} size={19} /></span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
