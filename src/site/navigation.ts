import { useLayoutEffect, useRef, useState } from "preact/hooks";

import type { SiteAction } from "./state.js";

/** Keep modal focus and background interaction in sync with the shared state. */
export function useMobileNavigation(
  open: boolean,
  dispatch: (action: SiteAction) => void,
) {
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [mobile, setMobile] = useState(false);
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 899px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches)
        dispatch({ type: "set-navigation-open", open: false });
    };
    document.body.dataset.enhanced = "true";
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const active = mobile && open;
    const toggle = toggleRef.current;
    if (toggle) toggle.inert = active;
    const main = mainRef.current;
    if (main) main.inert = active;
    document.body.classList.toggle("nav-open", active);
    const skip = document.querySelector<HTMLElement>(".skip-link");
    if (skip) skip.inert = active;
    if (active) {
      sidebarRef.current
        ?.querySelector<HTMLButtonElement>(".mobile-nav-close")
        ?.focus();
    } else if (wasOpen.current) {
      if (mobile) toggleRef.current?.focus({ preventScroll: true });
      else
        sidebarRef.current?.querySelector<HTMLElement>("#treeRoot a")?.focus();
    }
    wasOpen.current = active;
    return () => {
      if (toggle) toggle.inert = false;
      if (main) main.inert = false;
      if (skip) skip.inert = false;
      document.body.classList.remove("nav-open");
    };
  }, [mobile, open]);

  useLayoutEffect(() => {
    if (!mobile || !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dispatch({ type: "set-navigation-open", open: false });
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, summary, [tabindex="0"]',
        ) ?? []),
      ].filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobile, open]);

  return { mobile, sidebarRef, toggleRef, mainRef };
}
