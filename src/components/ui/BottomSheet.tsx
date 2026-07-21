import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

interface BottomSheetProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose(): void;
}

export function BottomSheet({ open, title, eyebrow, children, onClose }: BottomSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="bottom-sheet-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bottom-sheet__handle" />
        <header className="bottom-sheet__header">
          <div>
            {eyebrow && <small>{eyebrow}</small>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button icon-button--quiet" aria-label="Закрыть" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="bottom-sheet__content">{children}</div>
      </section>
    </div>
  );
}
