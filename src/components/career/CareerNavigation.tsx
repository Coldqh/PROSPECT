import { Icon, type IconName } from "../ui/Icon";

export type CareerPrimaryView = "profile" | "home" | "team";

const items = [
  { id: "profile", label: "Профиль", icon: "user" },
  { id: "home", label: "Дом", icon: "home" },
  { id: "team", label: "Команда", icon: "team" },
] as const satisfies readonly { id: CareerPrimaryView; label: string; icon: IconName }[];

interface CareerNavigationProps {
  active: CareerPrimaryView;
  onChange(view: CareerPrimaryView): void;
}

export function CareerNavigation({ active, onChange }: CareerNavigationProps) {
  return (
    <nav className="game-bottom-nav" aria-label="Основные разделы">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${active === item.id ? "is-active" : ""} ${item.id === "home" ? "is-home" : ""}`}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          <span className="game-bottom-nav__icon"><Icon name={item.icon} size={21} /></span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
