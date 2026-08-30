# Astro + Starlight 評価記録

記録日: 2026-08-30

## 結論

**go**。design.md の判断規則である5条件をすべて満たした。実装は Astro Content Loader API と Starlight の公開 component override に限られ、内部 API、patch、fork、`PageFrame` または `TwoColumnContent` の置換を使用していない。

Starlight 標準の autogenerate sidebar は Content Loader の dev 更新後に新しい collection entry を表示しなかった。そのため、公開 `Sidebar` override 内で公開 `getCollection('docs')` をリクエストごとに読む必要があった。この override は layout ではなく global navigation の表示だけを置き換える。raw source 用の `MarkdownContent` override と合わせ、override は2個である。

## 再現手順

```sh
cd spikes/site-engine/astro-starlight
bun install --frozen-lockfile
bun run check
bun run test
bun run build
bun run test:e2e
```

最終実行結果:

- `bun run check`: `0 errors, 0 warnings, 0 hints`
- `bun run test`: Vitest 1 test passed
- `bun run build`: static routes `/`, `/guide/nested/`, `/raw/` を生成
- `bun run test:e2e`: Playwright 3 tests passed

E2E は Chromium で dev server を起動し、fixture に対する add/change/remove と raw toggle を確認する。静的確認では JavaScript を無効にした browser context を使う。

## 条件別結果

| 条件 | 結果 | 自動確認の根拠 |
| --- | --- | --- |
| 任意の外部 Markdown root | PASS | `readExternalDocs()` は任意の一時 directory を受け、入れ子文書を含めて読む unit test を通過した。site は `fixtures/external-docs/` を `src/content/docs/` 外から読む。 |
| H1 title fallback と未指定言語 `und` | PASS | frontmatter `title` がない文書の先頭 H1 を `title` とし、本文から言語は推測せず `language: 'und'` を記録する unit test を通過した。JavaScript 無効の static page でも `main h1` がちょうど1個かつ `External root title` であることを E2E で確認した。先頭 H1 は rendered body から取り除くため、Starlight の標準 PageTitle と重複しない。 |
| dev add/change/remove | PASS | Playwright が `live.md` の追加、`raw.md` の変更、`live.md` の削除をサーバー再起動なしで行い、各操作後の本文、document navigation、削除済み route の 404 を確認した。 |
| raw source 表示 | PASS | Playwright が rendered bold text、`View source` 操作後の raw Markdown、`View rendered` による rendered pane への復帰と raw pane の再非表示を確認した。 |
| JS 無効の static HTML | PASS | `astro build` 後、JavaScript 無効の Chromium で rendered body と `/guide/nested/` への document navigation を確認した。 |

## 使用した公開 API と override

- Astro: `defineCollection()`, `Loader`, `LoaderContext.parseData()`, `LoaderContext.renderMarkdown()`, `LoaderContext.generateDigest()`, `LoaderContext.watcher`, `getCollection()`。
- Starlight: `starlight()` integration、`docsSchema()`、`components.Sidebar`、`components.MarkdownContent`、既定 `@astrojs/starlight/components/MarkdownContent.astro` の再利用。
- override は次の2個だけ。
  - `src/components/MarkdownContent.astro`: 既定 MarkdownContent をラップし、raw pane と小さな browser toggle を追加する。
  - `src/components/Sidebar.astro`: `getCollection('docs')` から document links だけを描画する。Starlight 標準 autogenerate sidebar の dev 更新不追随を回避する。

`PageFrame`、`TwoColumnContent`、非公開 virtual module、patch、fork は使用していない。

## 依存と容量の概算

lockfile に記録した直接依存は Astro `7.2.9`、Starlight `0.41.10`、`gray-matter` `4.0.3`、Playwright `1.62.1`、Vitest `4.1.11`、TypeScript `5.9.3`、Astro check `0.9.10`。

- `du -sk node_modules`: 351,080 KiB（約343 MiB、browser download cacheは含めない）
- 初期 `dist/` の `du -sk`: 936 KiB
- `dist/` 内 regular files の合計: 888,340 bytes（約868 KiB）

これらは小規模 fixture の初期値であり、10,000文書、検索 index、配布 package の性能/容量ゲートではない。

## 不確実性と後続移行変更の範囲

- Starlight は外部 root を first-class に設定する API を持たないため、loader の `filePath` は package root からの相対 path として保存している。外部画像などの asset 解決、git last-updated、processed directory の挙動は本 spike では検証していない。
- 標準 autogenerate sidebar の live refresh が使えなかったため、採用時もこの小さな `Sidebar` override を維持するか、Starlight 側の改善を確認する必要がある。
- 採用後の OpenSpec 変更では、Node.js 22/24 compatibility、compiled ESM distribution、外部 asset/link semantics、10,000文書 build と Pagefind 検索性能、配布サイズ、アクセシビリティ/レスポンシブ navigation の受け入れ条件を定義する。
- 複雑な独自状態 UI が必要になった場合だけ、後続変更で Preact island を検討する。本 spike には Preact を導入していない。

## 最終選定

technical spikeとしての **go** 判定は維持するが、yomの既定site engineとしてAstro + Starlightは採用しない。最終選定は **Vite + Preact + `preact-render-to-string`** とし、移行はOpenSpec change `migrate-site-to-vite-preact`で扱う。

選定理由は、現在のMarkdown処理とVite基盤を維持しながら、命令的UIをcomponent化し、同じcomponent treeからstatic HTMLとhydrated UIを生成できるためである。Starlightで必要だったnavigationとraw表示のoverrideを維持せずに済み、今後のyom固有UIも直接構成できる。Bunは開発に使い、公開packageはcompiled ESMとしてNode.js 22／24で動作させる。

同一macOS arm64環境でproduction dependencyを比較した追加測定は次の通り。temporary directoryは測定後に削除した。

- 現行yom: 約148 MiB、147 packages。
- Astro + Starlight + `gray-matter`: 約223 MiB、367 packages。
- Astro + Starlightに現行相当のMermaidとCLI依存を加えた構成: 約350 MiB、491 packages。
- `--omit=optional`では約111 MiBまで下がったが、Pagefind、Sharp、Rolldownのplatform binaryも除外されるため有効な配布構成ではない。

したがって、Starlightの機能gate通過は「実現可能性」の記録として残し、配布容量、override、既存処理の再利用を含む製品選定ではVite + Preactを採る。Mermaidは現在のdynamic importを維持し、本変更で削除・optional化・別package化しない。Pagefindと検索機能も今回のmigrationから除外し、必要性が明確になった時点で別途評価する。
