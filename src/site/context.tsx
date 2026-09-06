import { createContext, type ComponentChildren } from "preact";
import { useContext, useMemo, useReducer } from "preact/hooks";

import type { SiteSnapshot } from "../core/sitepayload.js";
import {
  createSiteState,
  siteReducer,
  type SiteAction,
  type SiteState,
  type ReadingPreferences,
} from "./state.js";

export type SiteContextValue = {
  state: SiteState;
  dispatch: (action: SiteAction) => void;
};

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider(props: {
  snapshot: SiteSnapshot;
  children: ComponentChildren;
  currentPath?: string | null;
  preferences?: ReadingPreferences;
}): ComponentChildren {
  const [state, dispatch] = useReducer(
    siteReducer,
    {
      snapshot: props.snapshot,
      currentPath: props.currentPath,
      preferences: props.preferences,
    },
    ({ snapshot, currentPath, preferences }) =>
      createSiteState(snapshot, { currentPath, preferences }),
  );
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return (
    <SiteContext.Provider value={value}>{props.children}</SiteContext.Provider>
  );
}

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (value === null) {
    throw new Error("useSite must be used inside SiteProvider");
  }
  return value;
}
