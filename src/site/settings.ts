import { useLayoutEffect, useRef, useState } from "preact/hooks";

export function useSettingsPanel(available = true) {
  const panelRef = useRef<HTMLDetailsElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const close = (restoreFocus = true) => {
    if (panelRef.current) panelRef.current.open = false;
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!available) close(false);
  }, [available]);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!panel.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return { panelRef, cardRef, triggerRef, open, close, setOpen };
}
