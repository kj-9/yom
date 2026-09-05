## 1. Baselineと依存境界

- [x] 1.1 現在のdev/static UI、caller cwd分離、Mermaid遅延読込、production install容量とpackage数、browser asset容量をbaselineとして記録し、既存testまたは再現commandで確認する
- [x] 1.2 `preact`と`preact-render-to-string`だけを表示層依存へ追加し、JSX設定を構成して、lockfileにAstro、Starlight、Pagefind、Preact専用Vite presetが追加されていないことを検査する
- [x] 1.3 移行前に現在のrendered/raw、settings/theme、tree開閉、sidebar幅、outline、pagination、relative link/image、frontmatterのbehavior testを補強し、対象testが現行実装で通ることを確認する

## 2. Node-compatible package

- [x] 2.1 package sourceを`lib/`へcompiled ESMとして出力するbuildを追加し、生成物にruntime `.ts` importがなくNode.jsからimportできることをtestする
- [x] 2.2 `bin/yom`とpackage exportsをNode shebangおよび`lib/` entryへ切り替え、pack file listと公開exportをfixture installから検証する
- [x] 2.3 CLIの最低Node.js versionを22.12として`engines`と起動時errorへ反映し、22.12未満のversion判定testでmessageと終了状態を確認する
- [x] 2.4 CLIのVite起動を公開programmatic APIと明示configへ統一し、callerの`vite.config.*`を読み込まないことをrepository外fixtureから検証する
- [x] 2.5 Node単体で`yom.config.ts`を明示的に読み込む経路を実装し、caller Vite configから分離した設定反映をpacked fixtureで確認する
- [x] 2.6 package buildと利用者向けstatic `dist` buildの出力・script・lifecycleを分離し、双方を連続実行して生成物が競合しないことを確認する
- [x] 2.7 BunをPATHから外したpack済みpackageをNode.js 22.12以上と24でinstallし、`--help`、公開export、`dev`、`build`、`preview`のmatrix testを通す

## 3. Shared Preact UI

- [x] 3.1 coreからUIへ渡すserializableな`SiteSnapshot`と`DocumentPayload`の型と生成処理を追加し、route、`und`、metadata、outline、前後関係のunit testを通す
- [x] 3.2 `App`、`Shell`、共有reducer/contextの基盤を実装し、同値snapshotではstate identityと閲覧状態が維持されるreducer testを追加する
- [x] 3.3 `DocumentTree`とnavigationを移植し、tree開閉、active route、relative document navigationのcomponent testを通す
- [x] 3.4 `DocumentView`へrendered/raw、frontmatter、relative image/link、Mermaid dynamic importを移植し、diagramなしではMermaidをloadしないtestを通す
- [x] 3.5 `Outline`と`Pagination`を移植し、見出しlinkと前後documentが既存結果と一致するtestを通す
- [x] 3.6 `Settings`、theme、保存対象の閲覧設定、sidebar幅を移植し、reload後の復元と現行worktreeのUI差分が保持されるtestを通す
- [x] 3.7 browser navigationとhistory更新を共有reducerへ接続し、内部link移動後も対話操作が継続するE2Eを通す
- [x] 3.8 add/change/remove/reconnect/unchangedのdev eventをtyped actionへ接続し、必要部分だけが更新され閲覧状態をresetしないE2Eを通す

## 4. Prerenderとhydration

- [x] 4.1 共通Preact site componentを`preact-render-to-string`でrenderするserver entryを追加し、本文、tree、outline、paginationを含むHTMLのbuild testを通す
- [x] 4.2 `<`、script終端相当、U+2028、U+2029をescapeする初期payload serializerを追加し、危険文字列を含むpayloadのunit testを通す
- [x] 4.3 static builderを各document routeのprerenderとVite asset manifestへ接続し、hashed JS/CSSと`lang="und"`を含む出力をfixture buildで確認する
- [x] 4.4 browser entryを埋め込みpayloadからの`hydrate()`へ切り替え、初期document API request、hydration warning、root DOM置換がないことをE2Eで確認する
- [x] 4.5 dev初期HTMLを共通server entryと`transformIndexHtml`へ接続し、同じfixtureのdev/static DOM構造と主要操作が一致するE2Eを通す
- [x] 4.6 JavaScript無効のstatic E2Eを追加し、本文読取、tree、outline、前後ページlinkでの移動を確認する

## 5. Cleanupとbudget gate

- [x] 5.1 Preact経路が全parity testを通した後に旧命令的DOM render pathとsource runtime entryを削除し、未参照codeと重複templateが残らないことを検索とtestで確認する
- [x] 5.2 production browser buildを測定し、Mermaid lazy chunkを除く初期JavaScriptとCSSがそれぞれgzip 50 KiB以下で、Pagefind assetがないことを自動checkする
- [x] 5.3 同一platform・package managerでpack済みproduction installをbaselineと比較し、`node_modules`増分10 MiB以下、package数、tarball容量を検証記録へ残す
- [x] 5.4 `README.md`と`README.ja.md`をNode 22.12以上、Bunの開発用途、compiled package、dev/build/preview手順へ同期し、記載commandをpacked fixtureで確認する
- [x] 5.5 `ROADMAP.md`へVite＋Preact選定、migration完了条件、Phase 7の依存関係、検索とMermaid最適化の延期を反映し、OpenSpec成果物との整合をreviewする

## 6. Final verification

- [x] 6.1 Node.js 22／24のpacked matrix、unit test、E2E、benchmarkを実行し、全結果と容量budgetが成功することを確認する
- [x] 6.2 `./scripts/check.sh`を実行し、canonical full local verificationを成功させる
- [x] 6.3 `openspec validate migrate-site-to-vite-preact --strict`を実行し、全task完了後もchangeがvalidであることを確認する
