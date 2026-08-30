import "./styles.css";

import { hydrate, type ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { StaticSitePage } from "./static.js";
import {
  documentFromLocation,
  documentFromPayload,
  parseClientPayload,
} from "./payload.js";
import {
  readReadingPreferences,
  writeReadingPreferences,
} from "./preferences.js";
import { defaultReadingPreferences, type ReadingPreferences } from "./state.js";

const payload = readPayload();

if (payload.snapshot !== undefined) {
  const document = documentFromPayload(payload);
  const root = documentRoot();
  hydrate(<HydratedPage payload={payload} document={document} />, root);
  if (document?.html.includes("language-mermaid")) {
    void import("./mermaid.js").then(({ renderMermaidInDocument }) =>
      renderMermaidInDocument(root),
    );
  }
  void import("./enhancements.js").then(({ enhanceDocumentControls }) =>
    enhanceDocumentControls(root),
  );
} else {
  // Dev keeps the legacy interactive entry until its controls are migrated.
  void import("./main.js");
}

function HydratedPage(props: {
  payload: NonNullable<typeof payload>;
  document: ReturnType<typeof documentFromPayload>;
}): ComponentChildren {
  const [snapshot, setSnapshot] = useState(props.payload.snapshot!);
  const [currentPath, setCurrentPath] = useState(
    props.document?.path ?? snapshot.firstPath,
  );
  const currentDocument = useMemo(
    () =>
      props.payload.notFound
        ? null
        : (snapshot.documents.find(
            (candidate) => candidate.path === currentPath,
          ) ?? null),
    [snapshot, currentPath, props.payload.notFound],
  );
  const [preferences, setPreferences] = useState<ReadingPreferences>(
    defaultReadingPreferences,
  );
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [collapsedPaths, setCollapsedPaths] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusText, setStatusText] = useState(
    props.payload.mode === "dev" ? "Watching" : "Static",
  );
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const [activeHeading, setActiveHeading] = useState<string | null>(() =>
    headingFromHash(window.location.hash),
  );
  useEffect(() => {
    if (!snapshot.documents.some((document) => document.path === currentPath)) {
      setCurrentPath(snapshot.firstPath);
    }
  }, [snapshot, currentPath]);
  useEffect(() => {
    const stored = readReadingPreferences(window.localStorage);
    if (Object.keys(stored).length > 0)
      setPreferences((current) => ({ ...current, ...stored }));
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "[" && event.key !== "]") return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
        return;
      const index = snapshot.documents.findIndex(
        (item) => item.path === currentPathRef.current,
      );
      const next = snapshot.documents[index + (event.key === "[" ? -1 : 1)];
      if (!next) return;
      event.preventDefault();
      history.pushState({}, "", next.route);
      setCurrentPath(next.path);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [snapshot]);
  useEffect(() => {
    const body = document.body;
    body.dataset.theme = preferences.theme;
    body.dataset.palette = preferences.palette;
    body.dataset.fontSize = preferences.fontSize;
    body.dataset.contentWidth = preferences.contentWidth;
    body.dataset.outline = preferences.outline ? "visible" : "hidden";
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${preferences.sidebarWidth}px`,
    );
  }, [preferences]);
  useEffect(() => {
    const selected = headingFromHash(window.location.hash) ?? activeHeading;
    for (const link of document.querySelectorAll("#outlineList a")) {
      link.classList.toggle(
        "active",
        link.getAttribute("data-heading-id") === selected,
      );
    }
  }, [activeHeading, currentPath]);
  useEffect(() => {
    if (props.payload.mode !== "dev") return;
    const events = new EventSource("/events");
    const refresh = async (): Promise<void> => {
      const response = await fetch("/api/site");
      if (!response.ok) return;
      const next = (await response.json()) as typeof snapshot;
      setSnapshot((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
      if (
        !next.documents.some(
          (document) => document.path === currentPathRef.current,
        )
      ) {
        setCurrentPath(next.firstPath);
      }
    };
    events.onmessage = (event) => {
      const update = JSON.parse(event.data) as { kind?: string; path?: string };
      if (update.kind === "asset" && update.path) {
        for (const image of document.querySelectorAll<HTMLImageElement>(
          `#docRoot img[src*="${CSS.escape(update.path)}"]`,
        )) {
          const url = new URL(image.src);
          url.searchParams.set("v", String(Date.now()));
          image.src = url.href;
        }
      }
      void refresh();
    };
    events.onopen = () => {
      setStatusText("Watching");
      void refresh();
    };
    events.onerror = () => setStatusText("Reconnecting");
    const recovery = window.setInterval(() => void refresh(), 1_000);
    return () => {
      events.close();
      window.clearInterval(recovery);
    };
  }, [props.payload.mode]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
        return;
      event.preventDefault();
      document.getElementById("treeSearch")?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    const resizer = document.getElementById("sidebarResizer");
    if (!(resizer instanceof HTMLElement)) return;
    const onPointerDown = (event: PointerEvent): void => {
      const layout = resizer.parentElement;
      if (layout === null) return;
      resizer.setPointerCapture(event.pointerId);
      document.body.classList.add("resizing-sidebar");
      const onPointerMove = (move: PointerEvent): void => {
        const left = layout.getBoundingClientRect().left;
        const sidebarWidth = Math.min(560, Math.max(220, move.clientX - left));
        setPreferences((current) => ({ ...current, sidebarWidth }));
        writeReadingPreferences(window.localStorage, { sidebarWidth });
      };
      const onPointerUp = (): void => {
        document.body.classList.remove("resizing-sidebar");
        resizer.removeEventListener("pointermove", onPointerMove);
        resizer.removeEventListener("pointerup", onPointerUp);
        resizer.removeEventListener("pointercancel", onPointerUp);
      };
      resizer.addEventListener("pointermove", onPointerMove);
      resizer.addEventListener("pointerup", onPointerUp);
      resizer.addEventListener("pointercancel", onPointerUp);
    };
    resizer.addEventListener("pointerdown", onPointerDown);
    return () => resizer.removeEventListener("pointerdown", onPointerDown);
  }, []);
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target as Element | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (link === null || link.origin !== window.location.origin) return;
      const next = documentFromLocation(
        snapshot,
        new URL(link.href, window.location.origin).pathname,
      );
      if (next === null) {
        if (new URL(link.href, window.location.origin).hash) {
          setActiveHeading(headingFromHash(new URL(link.href).hash));
        }
        return;
      }
      event.preventDefault();
      history.pushState({}, "", link.href);
      setCurrentPath(next.path);
      setActiveHeading(headingFromHash(new URL(link.href).hash));
      window.scrollTo(0, 0);
    };
    const onPopState = (): void => {
      const next = documentFromLocation(snapshot, window.location.pathname);
      if (next !== null) setCurrentPath(next.path);
      setActiveHeading(headingFromHash(window.location.hash));
    };
    const onHashChange = (): void => {
      setActiveHeading(headingFromHash(window.location.hash));
    };
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [snapshot]);
  const onPreferencesChange = (patch: Partial<ReadingPreferences>): void => {
    setPreferences((current) => ({ ...current, ...patch }));
    writeReadingPreferences(window.localStorage, patch);
  };
  return (
    <StaticSitePage
      snapshot={snapshot}
      document={currentDocument}
      title={props.payload.title ?? "yom"}
      mode={props.payload.mode ?? "static"}
      notFound={props.payload.notFound}
      preferences={preferences}
      onPreferencesChange={onPreferencesChange}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      activeHeading={activeHeading}
      onSelectHeading={(id, event) => {
        event.preventDefault();
        history.pushState({}, "", `#${encodeURIComponent(id)}`);
        document.getElementById(id)?.scrollIntoView({ behavior: "auto" });
        setActiveHeading(id);
      }}
      collapsedPaths={collapsedPaths}
      onToggleDirectory={(path) =>
        setCollapsedPaths((current) => {
          const next = new Set(current);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        })
      }
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      statusText={statusText}
    />
  );
}

function headingFromHash(hash: string): string | null {
  const id = hash.startsWith("#") ? hash.slice(1) : "";
  return id.length > 0 ? decodeURIComponent(id) : null;
}

function readPayload() {
  const element = document.getElementById("yom-config");
  return parseClientPayload(element?.textContent);
}

function documentRoot(): HTMLElement {
  const root = document.getElementById("app");
  if (root === null) throw new Error("yom app root is missing");
  return root;
}
