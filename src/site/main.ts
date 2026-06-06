import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <main class="shell">
    <p class="eyebrow">Phase 1</p>
    <h1>yom Bun migration scaffold</h1>
    <p class="lead">
      Bun / Vite / TypeScript based frontend entrypoint is ready. Markdown scanning and
      rendering will move here incrementally while the current Python server remains
      available.
    </p>
  </main>
`;
