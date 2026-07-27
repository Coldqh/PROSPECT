import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { CareerSave } from "../../storage/saves/schema";
import { Icon, type IconName } from "../ui/Icon";

export type CareerSecondaryView = "overview" | "season" | "matches" | "standings" | "recruiting" | "social" | "feed" | "market" | "rankings";

interface DrawerItem {
  id: CareerSecondaryView;
  label: string;
  code: string;
  icon: IconName;
}

const careerItems: readonly DrawerItem[] = [
  { id: "overview", label: "Обзор", code: "OVR", icon: "chart" },
  { id: "season", label: "Сезон", code: "SEA", icon: "calendar" },
  { id: "matches", label: "Матчи", code: "GMS", icon: "football" },
  { id: "standings", label: "Таблица", code: "STD", icon: "trophy" },
];

const worldItems: readonly DrawerItem[] = [
  { id: "social", label: "Социальная жизнь", code: "SOC", icon: "team" },
  { id: "feed", label: "Лента", code: "FED", icon: "pulse" },
  { id: "market", label: "Рынок", code: "MKT", icon: "swap" },
  { id: "rankings", label: "Рейтинг", code: "RNK", icon: "chart" },
];

interface CareerDrawerProps {
  open: boolean;
  save: CareerSave;
  active?: CareerSecondaryView | undefined;
  showRecruiting?: boolean;
  onSelect(view: CareerSecondaryView): void;
  onClose(): void;
  onExit(): void;
  minimal?: boolean;
}

function seasonLine(save: CareerSave): string {
  if (save.meta.phase === "college-season" && save.football.college.heroCareer) {
    const career = save.football.college.heroCareer;
    return `${career.seasonYear} · ${career.classYear} · W${career.week}`;
  }
  if (save.meta.phase === "professional-draft" || save.meta.phase === "professional-career") {
    return `${save.football.professional.draftYear} · DRAFT`;
  }
  return `${save.football.season.year} · WEEK ${Math.min(save.football.season.week + 1, save.football.season.totalWeeks)}`;
}

export function CareerDrawer({ open, save, active, showRecruiting = false, onSelect, onClose, onExit, minimal = false }: CareerDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const focusableSelector = "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const first = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (first ?? dialogRef.current)?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  const renderItems = (items: readonly DrawerItem[]) => items.map((item) => (
    <button
      type="button"
      key={item.id}
      className={active === item.id ? "is-active" : ""}
      onClick={() => onSelect(item.id)}
    >
      <span className="game-drawer__code">{item.code}</span>
      <span className="game-drawer__label">{item.label}</span>
      <Icon name={item.icon} size={17} />
    </button>
  ));

  return (
    <div className="game-drawer-layer" role="presentation" onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => event.currentTarget === event.target && onClose()}>
      <aside ref={dialogRef} className="game-drawer" role="dialog" aria-modal="true" aria-label="Разделы карьеры" tabIndex={-1}>
        <header className="game-drawer__header">
          <div className="game-drawer__brand"><span>P</span><strong>PROSPECT</strong></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть панель"><Icon name="close" /></button>
        </header>

        <section className="game-drawer__career">
          <small>{seasonLine(save)}</small>
          <strong>{save.character.identity.fullName}</strong>
          <span>{save.football.position} · OVR {Math.round(save.football.ratings.overall)}</span>
        </section>

        {!minimal && <nav className="game-drawer__nav">
          <div className="game-drawer__group">
            <small>КАРЬЕРА</small>
            {renderItems(careerItems)}
            {showRecruiting && (
              <button type="button" className={active === "recruiting" ? "is-active" : ""} onClick={() => onSelect("recruiting")}>
                <span className="game-drawer__code">REC</span>
                <span className="game-drawer__label">Рекрутинг</span>
                <Icon name="target" size={17} />
              </button>
            )}
          </div>
          <div className="game-drawer__group">
            <small>МИР</small>
            {renderItems(worldItems)}
          </div>
        </nav>}

        <footer className="game-drawer__footer">
          <button type="button" onClick={onExit}><Icon name="database" size={18} /><span>Сохранения</span></button>
          <span>PROSPECT</span>
        </footer>
      </aside>
    </div>
  );
}
