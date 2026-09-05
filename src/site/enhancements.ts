const enhancedButtons = new WeakSet<HTMLButtonElement>();

export function enhanceDocumentControls(root: ParentNode): void {
  for (const pre of root.querySelectorAll("#docRoot pre")) {
    const button = pre.querySelector<HTMLButtonElement>(".code-copy");
    if (button === null || enhancedButtons.has(button)) continue;
    enhancedButtons.add(button);
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(
        pre.querySelector("code")?.textContent ?? "",
      );
      button.textContent = "Copied";
    });
  }
  for (const heading of root.querySelectorAll<HTMLElement>(
    "#docRoot h1, #docRoot h2, #docRoot h3, #docRoot h4, #docRoot h5, #docRoot h6",
  )) {
    const link = heading.querySelector<HTMLButtonElement>(".heading-link");
    if (link === null || enhancedButtons.has(link)) continue;
    enhancedButtons.add(link);
    link.addEventListener("click", async () => {
      const url = new URL(window.location.href);
      url.hash = heading.id;
      history.replaceState({}, "", url);
      for (const outlineLink of document.querySelectorAll("#outlineList a")) {
        outlineLink.classList.toggle(
          "active",
          outlineLink.getAttribute("data-heading-id") === heading.id,
        );
      }
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      await navigator.clipboard.writeText(url.href).catch(() => {});
    });
  }
}
