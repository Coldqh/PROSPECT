import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

interface BottomSheetProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose(): void;
}

export function BottomSheet({ open, title, eyebrow, children, onClose }: BottomSheetProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    document.body.style.overflow = "hidden";

    const focusableSelector = "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
    const focusFirst = () => {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
      (focusable?.[0] ?? dialogRef.current)?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (event: KeyboardEvent) => {
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

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="bottom-sheet-layer" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        tabIndex={-1}
        onMouseDown={(event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()}
      >
        <div className="bottom-sheet__handle" />
        <header className="bottom-sheet__header">
          <div>
            {eyebrow && <small>{eyebrow}</small>}
            <h2 id="bottom-sheet-title">{title}</h2>
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
