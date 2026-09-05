## Purpose

開発表示と静的buildを同じ軽量UI契約へ揃え、JavaScript無効時にも読めるHTMLと、hydration後の既存閲覧操作およびlive updateを両立する。

## ADDED Requirements

### Requirement: Shared rendering behavior
dev表示とstatic buildは同じdocument payload、route規則、UI component treeを使用し、同じ入力に対して主要な文書表示構造と操作を一致させなければならない（MUST）。

#### Scenario: 同じMarkdown treeを表示する
- **WHEN** 同じsource rootをdev serverとstatic buildで開く
- **THEN** 文書本文、文書navigation、ページ内見出し、前後ページnavigation、route、および文書metadataの結果が一致する

### Requirement: Static document prerender
static buildの各document routeは、文書本文、文書navigation、ページ内見出し、前後ページnavigationを初期HTMLへrenderしなければならない（MUST）。

#### Scenario: JavaScriptを無効にして読む
- **WHEN** JavaScriptを無効にしたbrowserでbuild済みdocument routeを直接開く
- **THEN** 文書本文を読み、文書navigation、ページ内見出し、前後ページlinkを使って移動できる

#### Scenario: default languageを出力する
- **WHEN** 文書に明示的なlanguage metadataがない
- **THEN** static HTMLのdocument languageは`und`となり、Markdown本文から推測されない

### Requirement: Hydration without initial refetch
browserはprerender済みmarkupと埋め込まれた初期payloadをhydrateし、初期document API requestや初期UI全体の置換を行ってはならない（MUST NOT）。

#### Scenario: static routeを直接開く
- **WHEN** JavaScript有効のbrowserでbuild済みdocument routeを直接開く
- **THEN** prerender済み内容が再利用され、初期document API request、hydration mismatch、可視の全体置換なしに対話操作が有効になる

#### Scenario: hydration後にdocumentを移動する
- **WHEN** hydration完了後に内部document linkまたは前後ページnavigationを選択する
- **THEN** browser navigationがrouteと表示内容を更新し、既存のclient-side操作を継続できる

### Requirement: Existing reading interactions
移行後のUIは、rendered/raw切替、themeと閲覧設定、文書treeの開閉、sidebar幅、内部linkとimageの解決、frontmatter表示、outline、ページ送りの既存挙動を維持しなければならない（MUST）。

#### Scenario: 表示modeと設定を変更する
- **WHEN** 利用者がraw表示、theme、閲覧設定、tree開閉状態、またはsidebar幅を変更する
- **THEN** 対応する表示が更新され、既存仕様で保存対象の設定は再読み込み後も復元される

#### Scenario: 文書内resourceを表示する
- **WHEN** Markdownがrelative document link、relative image、frontmatter、見出しを含む
- **THEN** devとstatic buildの両方でlink、image、metadata、outlineが同じ規則で表示される

### Requirement: Mermaid remains lazy
Mermaid diagramはdiagramを含む文書でのみbrowser側の既存の遅延読み込み経路からrenderされ、初期browser bundleへ統合されてはならない（MUST NOT）。

#### Scenario: diagramがない文書を開く
- **WHEN** Mermaid code blockを含まない文書を開く
- **THEN** browserはMermaid chunkを読み込まない

#### Scenario: diagramを含む文書を開く
- **WHEN** Mermaid code blockを含む文書を開く
- **THEN** browserは必要になった時点でMermaidを読み込み、現在と同等のdiagram表示またはerror表示を行う

### Requirement: Development live updates
dev UIはMarkdownの追加、変更、削除、再接続、内容不変の通知を処理し、必要なcomponentだけを更新しなければならない（MUST）。

#### Scenario: Markdown treeが変化する
- **WHEN** watched rootで文書を追加、変更、または削除する
- **THEN** 文書tree、現在文書、outline、前後ページnavigationは該当する最新状態へ更新される

#### Scenario: connectionが復旧する
- **WHEN** live update接続が切断後に再接続する
- **THEN** UIは最新状態へ同期し、利用可能な閲覧状態を維持する

#### Scenario: 内容が変化しない通知を受ける
- **WHEN** 表示結果を変えない更新通知を受ける
- **THEN** 文書領域全体の不要な置換や閲覧状態のresetは発生しない

### Requirement: Initial asset budgets
検索機能とPagefindを追加せず、Mermaidの遅延chunkを除く初期browser JavaScriptはgzip 50 KiB以下、初期CSSはgzip 50 KiB以下でなければならない（MUST）。

#### Scenario: production browser assetsを測定する
- **WHEN** production buildの初期routeで読み込むJavaScriptとCSSをgzip換算で測定する
- **THEN** Mermaidの遅延chunkを除くJavaScriptとCSSがそれぞれ50 KiB以下で、検索indexまたはPagefind assetが生成されない
