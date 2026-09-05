# 移行前ベースライン

記録日: 2026-08-30

同一macOS arm64環境で、移行前のlocked dependencyと既存Vite browser buildを測定した。temporary directoryは測定後に削除した。

- production `node_modules`: 約148 MiB、147 packages。
- browser build JavaScript: Mermaidをdynamic importしたchunkを含めて約3.17 MB minified。Mermaid coreは約609 kB（gzip約146 kB）で、diagramを含まない初期経路から分離されている。
- dev/staticの既存契約: `bun run dev --root .`、`bun run build --root . --out-dir dist`、`bun run preview`、`bun run test`、`bun run test:e2e`。caller cwd分離は`tests/unit/dev-cwd.test.ts`で確認する。
- 既存E2Eでは外部Markdown root、add/change/remove、raw toggle、frontmatter、outline、theme、reading preferences、sidebar幅、tree検索とfolder開閉を確認する。

本記録は移行後のproduction install容量、初期browser JS/CSS、既存操作の比較基準として使用する。Mermaidと検索は本変更で最適化せず、Mermaid lazy chunkは初期bundleのbudgetから除外する。

## 移行後のproduction install比較

記録日: 2026-08-30

同一macOS arm64環境、Node.js v26.4.0、npm、`--omit=dev --ignore-scripts`で、`npm pack`した移行前（`origin/main`）と移行後のtarballをtemporary consumerへinstallして比較した。package managerを揃えるため、冒頭の移行前記録（約148 MiB、147 packages）とは別に、同一npm手順のbaselineを測定した。

| 測定項目 | 移行前 | 移行後 | 増分 |
| --- | ---: | ---: | ---: |
| production `node_modules` | 180,780 KiB | 184,276 KiB | 3,496 KiB（約3.41 MiB） |
| package数（`package.json`数） | 145 | 153 | 8 |
| pack tarball | 35,610 bytes | 47,298 bytes | 11,688 bytes |

production `node_modules`の増分は10 MiB以下であり、容量budgetを満たす。Node.js 22／24のruntime matrixは別途実行する。

## 最終検証

記録日: 2026-09-05

macOS arm64で以下を確認した。

- `YOM_TEST_NODE=<Node executable> bun run test:package`: Node.js 22.12.0／24.20.0の各3 testsが成功。隔離PATHでBunがENOENTになることを確認し、install、help、公開export、dev、build、previewとcaller Vite設定の分離を検証。
- `./scripts/check.sh`: 型チェック、compile、Prettier、56 unit tests、benchmark、3 packed tests、3 E2Eが成功。
- benchmark: 100件 2.70 ms、1,000件 4.36 ms、10,000件 73.97 ms。
- 初期asset: JavaScript gzip 12,100 bytes、CSS gzip 5,087 bytes。diagramなしの一文書fixtureをbuildし、`bun run check:assets /private/tmp/yom-migration-verification/dist`で測定。双方50 KiB以下。packed testでもasset gateを実行する。
- hydration: dev/staticの初期本文DOM identity、初期document再取得なし、内部移動後のraw操作とhistoryをE2Eで確認。
- live update: 定期API取得なし、同内容更新で本文DOMの追加変更なし、再接続でapp DOMを維持、削除後に最新の隣接文書へ移動することを確認。
- dev初期HTMLと埋め込みpayloadで同一文書を選択し、直接routeと`$&`を含む本文もunit testで確認。
- CLIでVite server設定を保持し、SSEと競合するWebSocket再読み込みを無効化。
- 旧`app.tsx`／`shell.tsx`／`main.ts`への参照がsrcとunit testsにないことを検索で確認。

Linuxでの実行結果はこのローカル検証に含まない。CIにはNode.js 22.12／24のpacked matrixと、integration test前のcompileを設定した。
