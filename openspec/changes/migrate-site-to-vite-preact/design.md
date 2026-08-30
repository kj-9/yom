## Context

動機は[proposal.md](./proposal.md)を参照する。現状は`src/site/main.ts`の命令的DOM処理と`src/core/`のstatic HTML生成が別経路であり、live update中の部分更新、初期表示、静的出力の同等性を個別に維持している。公開packageは現在TypeScript sourceとBun前提の実行経路を含むため、Node.jsだけのinstall先で実行できる配布境界も同時に整える必要がある。

既存のVite分離、Markdown変換、route、link書換え、`und`既定値、Mermaidのdynamic importは維持する。作業treeには進行中のUI変更があるため、移行時は現行差分をcomponentへ翻訳し、置換してはならない。

## Goals / Non-Goals

**Goals:**

- UI stateと描画責務を小さなPreact componentへ分け、dev/staticで共有する。
- static HTMLとbrowser hydrationが同一component treeおよび初期payloadを使う。
- packageのruntime boundaryをcompiled ESMとNode.js 22.12以上へ移す。
- dependency、initial asset、pack install容量を測定可能に保つ。
- 機能単位の段階移行中も既存の閲覧挙動を検証できるようにする。

**Non-Goals:**

- Phase 7のresponsive navigation再設計、検索、Pagefind、Mermaid最適化を同時に行わない。
- Markdown parser、route体系、content modelを新しいsite generatorへ置換しない。
- Astro、Starlight、state management framework、Preact専用Vite presetを導入しない。

## Decisions

### Preactと標準Vite変換を使う

`preact`と`preact-render-to-string`だけを表示層のproduction dependencyへ追加する。TypeScriptの`jsxImportSource`とVite/esbuildのautomatic JSX変換を使い、`@preact/preset-vite`は追加しない。現在必要なhydration、event、component、server string renderingにはこれで十分で、plugin dependencyとinstall容量を抑えられる。

代替のAstro/Starlightはtechnical spikeの機能gateを通過したが、production install増分とyom固有UIのoverride範囲が大きい。Reactはecosystemが広い一方、この規模ではruntime増分が不要である。LitやWeb ComponentsはSSR/hydrationの共有経路を別途設計する負担が大きいため採用しない。

### 単一のUI modelをserverとbrowserで共有する

coreが生成するserializableな`SiteSnapshot`と`DocumentPayload`をUI境界に置く。`App`配下を`Shell`、`DocumentTree`、`DocumentView`、`Outline`、`Pagination`、`Settings`へ分割し、共有reducerと必要最小限のcontextで状態遷移を管理する。route生成、relative link/image、frontmatter、outline、前後関係はcoreの純粋処理を利用し、component内で再実装しない。

大規模なglobal storeは追加しない。状態のsourceが明確なreducerでlive updateとnavigationを同じeventへ正規化し、局所状態は各componentに留める。

### prerenderとhydrateで同じcomponent treeを使う

server entryは`preact-render-to-string`で各routeの`App`をrenderする。static builderはasset manifestからhashed JavaScript/CSSを関連付け、本文、tree、outline、paginationを含む完全なHTMLを書き出す。browser entryはHTMLに安全に埋め込まれた同じsnapshotを読み、`hydrate()`で既存DOMを再利用する。

初期payloadのJSONは`<`、`</script>`相当、U+2028、U+2029をescapeし、実行可能なinline sourceとして扱わない。初期documentはpayloadから得るためAPI requestを行わない。その後のnavigationとdev更新だけが既存APIまたは更新channelを使う。

静的HTMLを別templateで組み立てる案は採らない。二重実装が残り、hydration mismatchとdev/static差分を解消できないためである。

### dev serverも同じentryと初期payloadを供給する

dev middlewareは現在のcontent APIとwatcherを維持しながら、初回requestでは共通server entryとViteの`transformIndexHtml`を通したshellを返す。clientはstatic buildと同じbrowser entry、component、reducerを使う。add/change/remove/reconnectはtyped eventへ変換し、snapshot差分がない場合はstateを更新しない。

### package buildとsite buildを分離する

repository sourceは専用のpackage buildで`lib/`へESM compileし、`bin/yom`はNode shebangから`lib/cli/index.js`をimportする。package `exports`も`lib/`を参照し、`prepack`でcompileとpack検証を行う。利用者向け`yom build`のstatic出力先`dist`とは名前とlifecycleを分離する。

CLIからViteは公開programmatic APIで起動し、`configFile: false`またはyom自身の明示的config objectを渡す。callerの`vite.config.*`探索を許さない。`yom.config.ts`はViteの公開config loaderを任意pathへ明示して読み込むか、同等の一時compile経路をpackage内に閉じる。いずれもcaller Vite configと混同せず、Node 22/24 package testで確定する。

CLI内で`bun` subprocessを起動する案、runtime TypeScript loaderを要求する案は採用しない。Bunは`bun install`、Vitest/Playwright実行、repository scriptの開発用途だけに残す。

### compatibilityと容量をpack後の実物で判定する

source checkoutだけでなく`npm pack`相当のtarballをtemporary caller projectへinstallし、BunをPATHから外したNode 22と24でbin、export、dev/build/preview、caller Vite config分離を検証する。同一platformとpackage managerで変更前baselineと`--omit=dev` installを比較し、production `node_modules`増分を10 MiB以下にする。初期browser assetはmanifestを基にgzip測定し、Mermaid lazy chunkを別集計する。

## Risks / Trade-offs

- [hydration時にserver/client markupがずれる] → 同じpayloadとcomponent treeを使用し、console warning、初期request、DOM identityをE2Eで検証する。
- [Markdown由来HTMLと埋め込みJSONがscript境界を壊す] → HTML sanitizerの既存境界を維持し、payload serializerを専用化して危険文字列のunit testを追加する。
- [live updateでlocal UI stateが失われる] → content snapshotと閲覧設定を分離し、同値snapshotではreducerが同じstateを返す。
- [TypeScriptの`yom.config.ts`読込がNode単体配布を再びloader依存にする] → Viteの公開loaderを明示pathに限定して使い、packed packageからのtestを必須にする。
- [package compileとVite browser buildの出力が混ざる] → `lib/`とsite出力`dist`を分離し、pack file listをtestする。
- [移行中に既存UI変更を失う] → component単位で現行behavior testを先に固定し、各sliceで差分を移植してから旧経路を削除する。
- [Preact追加後もMermaidがinstall容量の大半を占める] → Mermaidは本変更では現状維持とし、初期chunkからの分離だけをguardする。依存最適化は別判断にする。

## Migration Plan

1. 現在のUI、package、caller cwd、production容量をbaselineとして記録し、package compileとNode entryを追加する。
2. 現行UIをcomponent単位でPreactへ移し、旧entryとのbehavior parityをtestごとに確認する。進行中のworktree差分も対応componentへ保持する。
3. server rendering、safe initial payload、static asset manifest、hydrationを接続し、dev/static/no-JavaScriptのE2Eを通す。
4. Node 22/24のpacked installと容量budgetを満たした後だけ、旧命令的rendering pathとsource runtime entryを削除する。
5. README両言語とROADMAPを更新し、full checkとOpenSpec strict validationを行う。

公開前のrepository内移行であるため外部deployment rollbackは不要である。実装slice中は旧entryを内部fallbackとして残し、parity gateを満たせない場合はそのsliceだけを戻す。公開packageのentry切替はpacked Node matrixが成功した時点で一度に行う。
