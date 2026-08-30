import { useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";

import type { SiteSnapshot } from "../core/sitepayload.js";
import { SiteProvider, useSite } from "./context.js";
import { Shell, type ShellProps } from "./shell.js";

export type AppProps = ShellProps & {
  snapshot: SiteSnapshot;
};

/** The shared root for initial browser hydration and static prerendering. */
export function App({ snapshot, ...shellProps }: AppProps): ComponentChildren {
  return (
    <SiteProvider snapshot={snapshot}>
      <SnapshotSync snapshot={snapshot} />
      <Shell {...shellProps} />
    </SiteProvider>
  );
}

function SnapshotSync({ snapshot }: { snapshot: SiteSnapshot }): null {
  const { dispatch } = useSite();
  useEffect(() => {
    dispatch({ type: "snapshot-received", snapshot });
  }, [dispatch, snapshot]);
  return null;
}
