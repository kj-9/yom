# 移行前ベースライン

記録日: 2026-08-30

同一macOS arm64環境で、移行前のlocked dependencyと既存Vite browser buildを測定した。temporary directoryは測定後に削除した。

- production `node_modules`: 約148 MiB、147 packages。
- browser build JavaScript: Mermaidをdynamic importしたchunkを含めて約3.17 MB minified。Mermaid coreは約609 kB（gzip約146 kB）で、diagramを含まない初期経路から分離されている。
- dev/staticの既存契約: `bun run dev --root .`、`bun run build --root . --out-dir dist`、`bun run preview`、`bun run test`、`bun run test:e2e`。caller cwd分離は`tests/unit/dev-cwd.test.ts`で確認する。
- 既存E2Eでは外部Markdown root、add/change/remove、raw toggle、frontmatter、outline、theme、reading preferences、sidebar幅、tree検索とfolder開閉を確認する。

本記録は移行後のproduction install容量、初期browser JS/CSS、既存操作の比較基準として使用する。Mermaidと検索は本変更で最適化せず、Mermaid lazy chunkは初期bundleのbudgetから除外する。
