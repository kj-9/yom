export function enhanceDocumentControls(root: ParentNode): void {
  for (const pre of root.querySelectorAll("#docRoot pre")) {
    if (pre.querySelector("code.language-mermaid, .code-copy")) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.setAttribute("aria-label", "Copy code block");
    button.textContent = "Copy";
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(
        pre.querySelector("code")?.textContent ?? "",
      );
      button.textContent = "Copied";
    });
    pre.append(button);
  }
  for (const heading of root.querySelectorAll<HTMLElement>(
    "#docRoot h1, #docRoot h2, #docRoot h3, #docRoot h4, #docRoot h5, #docRoot h6",
  )) {
    if (!heading.id || heading.querySelector(".heading-link")) continue;
    const link = document.createElement("button");
    link.type = "button";
    link.className = "heading-link";
    link.setAttribute(
      "aria-label",
      `Copy link to ${heading.textContent ?? heading.id}`,
    );
    link.addEventListener("click", async () => {
      const url = new URL(window.location.href);
      url.hash = heading.id;
      await navigator.clipboard.writeText(url.href);
      history.replaceState({}, "", url);
    });
    heading.append(link);
  }
}
