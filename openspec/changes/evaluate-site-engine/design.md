## Context

現在のyomはVite上の独自browser UIでsidebar、ページ内見出し、ページ送り、表示設定、raw表示などを提供している。Starlightはこれらの多くと静的HTML、Pagefind検索を標準提供する一方、標準のdocs loaderは`src/content/docs/`を前提とする。Astro Content Loader APIには任意sourceとdev watcherの拡張点があるため、yomの外部Markdownルートを浅いadapterでStarlightへ渡せるかが採否を決める。

## Goals / Non-Goals

**Goals:**

- 外部MarkdownルートをStarlightのdocs collectionとして読み込めるか確認する。
- frontmatterがない文書へH1由来のtitleを補完できるか確認する。
- dev中のMarkdown追加、変更、削除を再起動なしで反映できるか確認する。
- raw source表示を公開APIと浅いoverrideだけで追加できるか確認する。
- static buildのHTMLに本文が含まれ、JavaScriptなしでも読めることを確認する。

**Non-Goals:**

- Vite + Preact案を並行実装・benchmarkしない。
- Preact、Pagefindの追加設定、検索性能、大規模文書性能を検証しない。
- Node.js互換の公開CLI、package構成、設定loaderを実装しない。
- spikeを`src/`や公開package dependenciesへ接続しない。

## Decisions

### Astro + Starlightだけを先に検証する

既存UIの責務を最も多く外部へ委譲できるAstro + Starlightを第一候補とし、半日から1日程度のspikeで適合性だけを確認する。Vite + Preact + Pagefindは比較用spikeを作らず、Starlightがno-goになった場合の後続候補にする。

### custom content loaderを唯一の入力adapterにする

外部ルートのscan、Markdown sourceの読み込み、H1 title fallback、route id生成をcustom loaderへ集約し、Starlightが期待するdocs collection entryへ変換する。文書本文から言語を推測せず、検証データでも言語未指定は`und`として扱う。外部ファイルを一時的に`src/content/docs/`へcopyまたはsymlinkする案は、watchとpath意味論を複雑にするため採用しない。

### 製品コードと依存を隔離する

spikeは`spikes/site-engine/astro-starlight/`へ独立したpackageとして置き、専用fixtureを同directory配下に持つ。rootの`package.json`、`bun.lock`、`src/`、公開build成果物は変更しない。測定は依存install容量と初期build asset容量の概算記録だけに留め、性能ゲートにはしない。

### overrideの深さで保守可能性を判断する

custom CSS、Starlight設定、公開loader APIを優先する。raw source表示にcomponent overrideが必要な場合も2個以下とし、`PageFrame`や`TwoColumnContent`などlayout全体の置換、非公開API、patch、forkを必要とする場合はno-goにする。標準UIをyomの現在の見た目へ完全一致させることは求めない。

### Preactは採用判断から外す

Starlight標準のinteractionと小さなAstro componentまたはclient scriptで5条件を確認する。採用後も独自の複雑な状態管理が必要だと判明した時だけ、後続移行変更でPreact islandを検討する。

### 5条件の全通過をgoとする

外部ルート、H1 title fallback、dev add/change/remove、raw source、本文入りstatic HTMLがすべて公開APIと許容override内で動けばgoとする。一つでも実現不能、または保守性条件を超える場合はno-goとする。結果は`evaluation.md`へ、再現手順、各条件のpass/fail、override一覧、概算容量、採否理由として記録する。

## Risks / Trade-offs

- [小さなspikeでは10,000文書時の性能が分からない] → goの場合に、移行変更の受け入れ条件として大規模buildと検索性能を仕様化する。
- [Starlightがbetaで公開拡張点が変化する] → overrideと使用APIを記録し、非公開APIへ依存しないことをgo条件にする。
- [raw source追加のためにlayout overrideが連鎖する] → 高位layout置換が必要と判明した時点でno-goとし、spikeを製品実装へ膨らませない。
- [Node.js配布の難しさをspikeで見落とす] → Node.js 22／24、Bun不要、compiled ESMを後続移行変更の必須specとして扱う。

## Migration Plan

1. 隔離packageと最小fixtureを用意する。
2. custom loaderと5条件を順に確認し、条件を満たすためのoverrideを数える。
3. `evaluation.md`へgoまたはno-goを記録する。
4. goならAstro + Starlight移行、no-goならVite + Preact + Pagefind移行を新しいOpenSpec変更として提案する。
5. 移行変更にNode.js互換、配布サイズ、大規模文書性能の恒久要件を定義し、Phase 7を採用基盤に合わせて更新する。

本変更は公開経路を変えないためruntime rollbackは不要。spikeの保持または削除は採用判断とともに決める。
