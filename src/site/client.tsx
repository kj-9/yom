import "./styles.css";

import { hydrate, type ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { useMobileNavigation } from "./navigation.js";
import { SiteProvider, useSite } from "./context.js";
import { StaticSitePage } from "./static.js";
import {
  documentFromLocation,
  documentFromPayload,
  parseClientPayload,
} from "./payload.js";
import {
  readReadingPreferences,
  readingDefaults,
  writeReadingPreferences,
} from "./preferences.js";
import type { ReadingPreferences, SiteAction } from "./state.js";

const payload = readPayload();

if (payload.snapshot === undefined) {
  throw new Error("yom site payload is missing");
}

const initialDocument = documentFromPayload(payload);
const root = documentRoot();
hydrate(<HydratedPage payload={payload} document={initialDocument} />, root);

function HydratedPage(props: {
  payload: NonNullable<typeof payload>;
  document: ReturnType<typeof documentFromPayload>;
}): ComponentChildren {
  const snapshot = props.payload.snapshot!;
  return (
    <SiteProvider
      snapshot={snapshot}
      preferences={readingDefaults(props.payload)}
      currentPath={props.document?.path ?? snapshot.firstPath}
    >
      <HydratedContent payload={props.payload} />
    </SiteProvider>
  );
}

function HydratedContent(props: {
  payload: NonNullable<typeof payload>;
}): ComponentChildren {
  const { state, dispatch } = useSite();
  const { snapshot, currentPath, preferences, viewMode, collapsedPaths } =
    state;
  const navigation = useMobileNavigation(state.navigationOpen, dispatch);
  const currentDocument = props.payload.notFound
    ? null
    : (snapshot.documents.find((candidate) => candidate.path === currentPath) ??
      null);
  useEffect(() => {
    if (currentDocument === null || viewMode === "raw") return;
    let cancelled = false;
    void import("./enhancements.js").then(({ enhanceDocumentControls }) => {
      if (!cancelled) enhanceDocumentControls(root);
    });
    if (!currentDocument.html.includes("language-mermaid")) {
      return () => {
        cancelled = true;
      };
    }
    void import("./mermaid.js").then(({ renderMermaidInDocument }) => {
      if (!cancelled) void renderMermaidInDocument(root);
    });
    return () => {
      cancelled = true;
    };
  }, [currentDocument, viewMode]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusText, setStatusText] = useState(
    props.payload.mode === "dev" ? "Watching" : "Static",
  );
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const stateRef = useRef(state);
  stateRef.current = state;
  const knownDocumentsRef = useRef(
    new Map(snapshot.documents.map((document) => [document.path, document])),
  );
  for (const document of snapshot.documents) {
    knownDocumentsRef.current.set(document.path, document);
  }
  const [activeHeading, setActiveHeading] = useState<string | null>(() =>
    headingFromHash(window.location.hash),
  );
  useEffect(() => {
    const stored = readReadingPreferences(window.localStorage);
    if (Object.keys(stored).length > 0)
      dispatch({ type: "set-preferences", preferences: stored });
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
      dispatch({ type: "navigate", path: next.path });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [snapshot]);
  useEffect(() => {
    const body = document.body;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      body.dataset.theme =
        preferences.theme === "system"
          ? systemTheme.matches
            ? "dark"
            : "light"
          : preferences.theme;
    };
    updateTheme();
    systemTheme.addEventListener("change", updateTheme);
    body.dataset.palette = preferences.palette;
    body.dataset.fontSize = preferences.fontSize;
    body.dataset.contentWidth = preferences.contentWidth;
    body.dataset.outline = preferences.outline ? "visible" : "hidden";
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${preferences.sidebarWidth}px`,
    );
    return () => systemTheme.removeEventListener("change", updateTheme);
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
    let refreshQueue = Promise.resolve();
    const performRefresh = async (
      event?: Extract<SiteAction, { type: "dev-event" }>["event"],
      preferredPath?: string,
    ): Promise<void> => {
      try {
        const response = await fetch("/api/site", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as typeof snapshot;
        const currentState = stateRef.current;
        const activeDocument =
          currentState.snapshot.documents.find(
            (document) => document.path === currentState.currentPath,
          ) ??
          (currentState.currentPath === null
            ? undefined
            : knownDocumentsRef.current.get(currentState.currentPath));
        if (
          preferredPath !== undefined ||
          (activeDocument !== undefined &&
            !next.documents.some(
              (document) => document.path === activeDocument.path,
            ))
        ) {
          const adjacentPath =
            preferredPath ??
            activeDocument?.pagination.next?.path ??
            activeDocument?.pagination.previous?.path;
          const destination =
            next.documents.find((document) => document.path === adjacentPath) ??
            next.documents.find((document) => document.path === next.firstPath);
          if (destination !== undefined) {
            history.replaceState({}, "", destination.route);
          }
          dispatch(
            event === undefined
              ? {
                  type: "snapshot-received",
                  snapshot: next,
                  currentPath: destination?.path,
                }
              : {
                  type: "dev-event",
                  event,
                  snapshot: next,
                  currentPath: destination?.path,
                },
          );
          return;
        }
        dispatch(
          event === undefined
            ? { type: "snapshot-received", snapshot: next }
            : { type: "dev-event", event, snapshot: next },
        );
      } catch {
        setStatusText("Reconnecting");
      }
    };
    const refresh = (
      event?: Extract<SiteAction, { type: "dev-event" }>["event"],
      preferredPath?: string,
    ): Promise<void> => {
      refreshQueue = refreshQueue.then(() =>
        performRefresh(event, preferredPath),
      );
      return refreshQueue;
    };
    events.onmessage = (event) => {
      const update = JSON.parse(event.data) as {
        action?: unknown;
        kind?: unknown;
        path?: unknown;
      };
      const devEvent = isDevEvent(update) ? update : undefined;
      if (devEvent?.kind === "asset" && devEvent.path) {
        for (const image of document.querySelectorAll<HTMLImageElement>(
          `#docRoot img[src*="${CSS.escape(devEvent.path)}"]`,
        )) {
          const url = new URL(image.src);
          url.searchParams.set("v", String(Date.now()));
          image.src = url.href;
        }
      }
      const deletedDocument =
        devEvent?.kind === "document" &&
        devEvent.action === "remove" &&
        devEvent.path === currentPathRef.current
          ? knownDocumentsRef.current.get(devEvent.path)
          : undefined;
      const preferredPath =
        deletedDocument?.pagination.next?.path ??
        deletedDocument?.pagination.previous?.path;
      void refresh(devEvent, preferredPath);
    };
    events.onopen = () => {
      setStatusText("Watching");
      void refresh();
    };
    events.onerror = () => setStatusText("Reconnecting");
    return () => {
      events.close();
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
        dispatch({
          type: "set-preferences",
          preferences: { sidebarWidth },
        });
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
      dispatch({ type: "navigate", path: next.path });
      setActiveHeading(headingFromHash(new URL(link.href).hash));
      window.scrollTo(0, 0);
    };
    const onPopState = (): void => {
      const next = documentFromLocation(snapshot, window.location.pathname);
      if (next !== null) dispatch({ type: "navigate", path: next.path });
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
  }, [snapshot, dispatch]);
  const onPreferencesChange = (patch: Partial<ReadingPreferences>): void => {
    dispatch({ type: "set-preferences", preferences: patch });
    writeReadingPreferences(window.localStorage, patch);
  };
  return (
    <StaticSitePage
      {...navigation}
      defaults={readingDefaults(props.payload)}
      navigationOpen={state.navigationOpen}
      onNavigationChange={(open) =>
        dispatch({ type: "set-navigation-open", open })
      }
      snapshot={snapshot}
      document={currentDocument}
      title={props.payload.title ?? "yom"}
      mode={props.payload.mode ?? "static"}
      notFound={props.payload.notFound}
      preferences={preferences}
      onPreferencesChange={onPreferencesChange}
      viewMode={viewMode}
      onViewModeChange={(nextViewMode) =>
        dispatch({ type: "set-view-mode", viewMode: nextViewMode })
      }
      activeHeading={activeHeading}
      onSelectHeading={(id, event) => {
        event.preventDefault();
        history.pushState({}, "", `#${encodeURIComponent(id)}`);
        document.getElementById(id)?.scrollIntoView({ behavior: "auto" });
        setActiveHeading(id);
      }}
      collapsedPaths={collapsedPaths}
      onToggleDirectory={(path) => dispatch({ type: "toggle-directory", path })}
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

function isDevEvent(value: {
  action?: unknown;
  kind?: unknown;
  path?: unknown;
}): value is Extract<SiteAction, { type: "dev-event" }>["event"] {
  return (
    (value.action === "add" ||
      value.action === "change" ||
      value.action === "remove") &&
    (value.kind === "document" || value.kind === "asset") &&
    typeof value.path === "string"
  );
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
