## Context

Phase 7後のUIは`StaticSitePage`と`DocumentTree`をdev/staticで共有し、reducerとhookで表示mode、tree開閉、モバイルdrawer、表示設定を同期している。static HTMLはJavaScript無効時にも文書とnavigationを操作できる必要がある。

現在のscanはroot配下の全候補を先に再帰列挙し、単一の`git check-ignore --stdin`へ渡す。無視対象の出力がprocess bufferを超えると結果を空集合へ置き換えるため、巨大な`node_modules`配下が文書treeへ流入する。UI側ではディレクトリをbuttonと条件付き子要素、文書を`role="button"`付きlinkでrenderしており、全枝が初期展開される。文書metadata titleはMarkdown先頭H1由来の場合も常に別見出しとして表示され、outlineは見出しlevelを持ちながら一段のlistとして描画される。

## Goals / Non-Goals

**Goals:**

- ignore判定をディレクトリ単位で早期適用し、無視対象配下を走査しない。
- `.gitignore`を既定で尊重しながら、root相対globで文書とassetを限定的にopt-inできる設定を追加する。
- static HTMLだけでも展開できる文書tree構造へ移行する。
- 既存payloadを変更せず、見出しlevelと先頭見出し情報から階層とタイトル重複を解決する。
- 現行のstate、URL、localStorage、responsive breakpointを維持し、`includeIgnored`省略時の走査結果を変えない。

**Non-Goals:**

- Phase 8の検索、履歴、pin、breadcrumb、focus mode用stateまたはdataを先行追加しない。
- Markdown rendererのtitle抽出規則や公開payload schemaを変更しない。
- UI component library、icon package、font dependencyを追加しない。

## Decisions

### Ignore判定を段階的なpruned traversalへ変える

`YomConfig`と`ResolvedYomConfig`へ`includeIgnored: string[]`を追加し、既定値を空配列とする。patternは既存のinclude/excludeと同じroot相対glob構文を使い、文書とassetの両方へ適用する。公開文書の最終条件は次の順序で評価する。

```text
matches include
AND NOT matches exclude
AND (NOT gitignored OR matches includeIgnored)
```

各ディレクトリで直下entryの相対pathだけをサイズ上限付きbatchとして`git check-ignore --stdin -z`へ渡す。無視されたdirectoryは、`includeIgnored`のどのpatternもそのdirectoryまたは子孫へ一致し得ない場合にだけ再帰前に除外する。子孫がopt-in候補なら必要な祖先だけを走査し、収集時に各pathの完全一致を再評価する。同じ結果を文書、asset、既存path一覧で共有し、Git管理外rootは従来どおり設定filterだけで走査する。

全候補の`maxBuffer`だけを増やす案は、無視対象内部を最後まで走査する時間とmemoryを解決せず、さらに大きいtreeで再発するため採用しない。entryごとにprocessを起動する案は大規模な非無視treeでprocess数が増えるため採用しない。

`include`をgitignoreの上書きとして再利用する案は、既定値`**/*.md`がすべての無視Markdownを復活させるため採用しない。`respectGitignore: false`で全解除する案も、必要な生成文書と同時に`node_modules`や一時出力まで公開しやすいため採用しない。

Git管理下でignore processが異常終了した場合は空の結果へfallbackせず、rootを含む明確なerrorにする。無視対象を公開して起動を継続するより、安全側で失敗させる。dev watcherで追加・変更されたpathも同じ`includeIgnored`と`exclude`の優先順位を利用し、`.gitignore`または設定再読込後はsite indexとasset公開範囲を再評価する。

### 文書treeをnative details/summaryで構成する

directoryを`details`と`summary`、文書を通常の`a`としてrenderする。現在文書の祖先は`open`、それ以外は初期状態で閉じる。native detailsはJavaScript無効時も展開でき、buttonへ独自にARIAとkeyboard behaviorを再実装する必要がない。

treeの`ul`はnative list markerを表示しない。directoryは展開状態を示すsummaryの三角形だけを記号とし、文書linkには追加のbulletやfile iconを付けず、同じ本文開始位置へ揃える。階層ごとのindentは12px程度の一定値に抑え、深いtreeでも文書名の表示幅を残す。

source表示は本文面の操作ではなく、選択中の文書linkと同じrowに置く補助操作とする。rendered時は`Source`、raw時は`Rendered`を表示し、文書の選択と表示形式の操作をnavigation側へまとめる。

既存`collapsedPaths`はhydrate後のcontrolled stateへ橋渡しし、`toggle` eventからreducerを更新する。現在文書へ移動したときは祖先を展開するが、利用者が明示的に変更した他の枝の状態は保持する。

### Outlineを見出しlevelからtree化する

flatなheading列を相対levelに基づく入れ子listへ変換する。levelが飛ぶ場合は空の見出しnodeを作らず、直前に存在する最も近い上位levelへ接続する。現在heading linkへ`aria-current="location"`を付け、祖先list itemへclassを付与する。

表示件数を固定値で切る案は目的の見出しを隠すため採用しない。panel内scrollと階層的な文字・indent差で密度を制御する。

### 本文面は文書内容だけを表示する

rendered modeではMarkdown H1を本文内に残し、deep linkとcopy actionを維持する。MarkdownにH1がない場合だけmetadata titleを本文先頭のH1として補完し、文書には常に一つの主見出しを確保する。raw modeはsource本文だけを表示し、選択中の文書名はnavigation側で示す。

rendererから先頭H1を削除する案はMarkdown出力、fragment、copy linkへ影響するため採用しない。H1がない文書へ補完を行わない案は主見出しが失われるため採用しない。

### Display settingsを左ペイン内の専用画面にする

Display settingsを開いたときはsearchと文書treeを隠し、同じ左ペイン内に設定だけを通常flowで表示する。fixed positioning、floating card、外側clickによるdismissは使わない。先頭に`Documents`へ戻る操作と`Display`見出しを置き、狭い左ペインでは設定項目を一列にする。

設定を文書tree上へ重ねる案は、モバイルdrawer内にさらにmodal相当のsurfaceを作り、大きな空白とfocus境界の重複を生むため採用しない。treeの文書、directory、current state、outlineのactive/ancestor stateへ既存palette変数から背景・border・文字色を割り当てる。既存のcontrast検証対象を増やし、新しい色定数や外部assetは導入しない。

mobile drawerのcloseは`Close documents`、settingsからtreeへ戻る操作は`Documents`とし、異なるnavigationとして示す。

## Risks / Trade-offs

- [native detailsへの移行で既存tree stateとtoggle eventが二重更新される] → controlled stateとevent発火順をunit testし、dev/static共通E2Eで再読込と文書移動を確認する。
- [directory単位のGit照会が深い非無視treeでprocess回数を増やす] → 同一階層をbatch化し、1,000/10,000-file benchmarkで既存上限内を確認する。
- [`includeIgnored`のglobから子孫候補を判定し過ぎて無視directoryを余分に走査する] → static prefixが確定するpatternは祖先判定に使い、曖昧なpatternは安全側に走査しつつbenchmarkで上限を確認する。
- [opt-inした文書が意図しないassetまで公開する] → assetも`includeIgnored`完全一致を必要とし、文書から参照された既存assetだけをbuildする規則を維持する。
- [title比較が記号やinline markupで一致しない] → payloadが持つplain heading textを使い、空白だけを正規化する。曖昧なcaseでは両方を保持して情報を失わない。
- [outlineのindentが狭い右paneを圧迫する] → level差へ上限を設けたvisual indentと折返しを使用し、実際の階層はDOMで保持する。
- [視覚調整が既存screenshotを広範囲に変える] → layout境界の数値assertionを維持し、意図したbaselineだけを更新する。

## Migration Plan

1. `includeIgnored`の設定validation、既定値、優先順位testを追加する。
2. ignore traversalと回帰testを導入し、実リポジトリ相当のroot、限定opt-in、参照assetで公開集合を正常化する。
3. 文書treeのsemantic structureとstate同期を変更し、no-JavaScript static navigationを検証する。
4. outline hierarchy、本文面、左ペイン内のsource操作と表示設定を変更し、主要幅・mode・配色を検証する。
5. README両言語とROADMAPを更新し、strict validationと`./scripts/check.sh`を実行する。

各段階は独立して戻せるcommit相当の変更単位とする。回帰時は該当段階だけを戻し、公開設定や保存dataのmigrationは行わない。
