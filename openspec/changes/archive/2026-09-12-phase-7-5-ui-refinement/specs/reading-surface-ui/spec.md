## Purpose

本文を開いた直後にapp固有の情報や操作へ妨げられず、文書の主見出しまたは内容から読み始められる、一貫したレスポンシブ閲覧面を提供する。

## ADDED Requirements

### Requirement: 文書タイトルを重複表示しない

rendered表示の本文は同じ意味のタイトルを連続して二重表示してはならず（MUST NOT）、表示中の文書には一つの明確な主見出しが存在しなければならない（MUST）。

#### Scenario: Markdown先頭見出しとページタイトルが一致する

- **WHEN** 表示用タイトルとMarkdownの最初のH1が正規化後に一致する文書をrendered表示する
- **THEN** MarkdownのH1が文書の主見出しとして残り、その前に文書path、別title、表示mode操作は表示されない

#### Scenario: Markdownに同等のH1がない

- **WHEN** front matterのtitleを使う文書、または先頭に同等のH1がない文書をrendered表示する
- **THEN** 表示用タイトルが本文先頭の主見出しとして補完される

#### Scenario: raw表示へ切り替える

- **WHEN** 利用者がraw表示を選択する
- **THEN** raw本文から直接表示を開始し、文書path、別title、表示mode操作は本文面に表示されない

### Requirement: 本文面を文書内容に限定する

本文面はMarkdownからrenderした内容、H1がない場合に補完する主見出し、front matter、paginationだけを含み、文書pathと表示mode操作を含んではならない（MUST NOT）。

#### Scenario: 文書を開く

- **WHEN** 利用者が任意の文書を表示する
- **THEN** 利用者は文書pathやapp操作を挟まず、文書の主見出しまたは本文から読み始められる

### Requirement: Display settingsを左ペイン内で表示する

Display settingsは文書treeへ重なるfloating surfaceではなく、左ペイン内の専用画面として通常flowに配置しなければならない（MUST）。設定中は文書searchとtreeを隠し、Documentsへ戻る操作を提供しなければならない（MUST）。

#### Scenario: モバイルで表示設定を開く

- **WHEN** 文書ドロワー内で表示設定を開く
- **THEN** 左ペイン内に設定だけが一列で表示され、`Documents`で文書treeへ戻れ、`Close documents`はdrawer自体を閉じる操作として残る

### Requirement: 既存のレスポンシブ契約を維持する

閲覧面の整理後も、320pxから1,440pxの既存ペイン切替、テーマ、配色、設定保存、フォーカス復帰、dev/static同等性を維持しなければならない（MUST）。

#### Scenario: 主要幅と配色で閲覧する

- **WHEN** 390px、1,024px、1,440pxの各幅と既存のtheme/palette組み合わせで主要状態を表示する
- **THEN** 意図しないページ横スクロールや操作不能な重なりがなく、devとstatic buildで同じ情報階層と操作を利用できる
