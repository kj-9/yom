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
    const card = cardRef.current;
    const trigger = triggerRef.current;
    const sidebar = panel?.closest<HTMLElement>("#sidebar");
    if (!panel || !card || !trigger || !sidebar) return;
    const place = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      const offset = viewport?.offsetTop ?? 0;
      const bounds = sidebar.getBoundingClientRect();
      card.style.width = `${Math.max(0, Math.min(320, bounds.width - 24, width - 16))}px`;
      card.style.maxHeight = `${Math.max(0, height - 16)}px`;
      const left = Math.max(
        8,
        Math.min(bounds.left + 12, width - card.offsetWidth - 8),
      );
      const cardHeight = Math.min(card.scrollHeight, height - 16);
      const top = window.matchMedia("(max-width: 899px)").matches
        ? offset + height - cardHeight - 8
        : Math.max(
            offset + 8,
            Math.min(
              trigger.getBoundingClientRect().bottom + 8,
              offset + height - cardHeight - 8,
            ),
          );
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(sidebar);
    resize.observe(card);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !panel.open) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.contains(event.target))
        close(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      resize.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open]);

  return { panelRef, cardRef, triggerRef, open, close, setOpen };
}
