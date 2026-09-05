import { h } from "preact";
import { renderToString } from "preact-render-to-string";

import { StaticSitePage, type StaticSitePageProps } from "./static.js";

/** Render the shared site component tree for dev HTML and static routes. */
export function renderSitePage(props: StaticSitePageProps): string {
  return renderToString(h(StaticSitePage, props));
}
