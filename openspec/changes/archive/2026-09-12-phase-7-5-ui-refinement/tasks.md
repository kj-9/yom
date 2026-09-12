## 1. 文書検出の正しさ

- [x] 1.1 `YomConfig`と`ResolvedYomConfig`へ既定値が空配列の`includeIgnored`を追加し、未知値、非配列、空要素を拒否し、設定読込と公開exportの型をconfig testで確認する。
- [x] 1.2 標準process bufferを超える無視対象、nested ignore、限定opt-in、無視された親の子孫opt-in、include/exclude/includeIgnored競合、Git ignore異常終了のfixtureを`tests/unit/scan.test.ts`とrepository関連testへ追加し、期待する公開path集合を固定する。
- [x] 1.3 `src/core/scan.ts`のignore収集を、直下entryのbatch照会、opt-in候補を考慮した無視directoryの早期prune、path完全一致の再評価へ変更し、文書・asset・既存path一覧が同じ優先順位を利用することをunit testで確認する。
- [x] 1.4 Git管理外rootでは従来どおり走査し、Git管理下のignore照会異常はrootを含む明確なerrorにすることをCLIまたはcore testで確認する。
- [x] 1.5 dev watcherでopt-in文書の追加・変更・削除と`.gitignore`変更を反映し、static buildがopt-in文書から参照された一致assetだけを出力することをrepository/build/E2E testで確認する。
- [x] 1.6 `./scripts/check.sh`を実行し、設定とscan変更sliceが型検査、unit、benchmark、package、E2Eを回帰させないことを確認する。

## 2. 文書ツリーの意味と初期状態

- [x] 2.1 `DocumentTree`をnative details/summaryと通常linkへ変更し、文書から`role="button"`を除き、current link、directory展開状態、通常link操作をcomponent testで確認する。
- [x] 2.2 現在文書の祖先を初期展開し無関係な枝を折りたたむstate生成とnavigation時の展開更新を実装し、reducer/component testで利用者の既存展開状態を失わないことを確認する。
- [x] 2.3 devとstatic buildでtree操作をE2E検証し、JavaScript無効のstatic routeでもnative detailsを展開して文書linkへ移動できることを確認する。
- [x] 2.4 `./scripts/check.sh`を実行し、文書tree変更sliceが既存のmobile drawer、focus復帰、live update、static prerenderを回帰させないことを確認する。

## 3. 文書ヘッダーとアウトライン

- [x] 3.1 タイトル同等判定と見出しlevelからoutline treeを構成するpure helperを追加し、一致・不一致・raw・level飛び・同名下位見出しをunit testで確認する。
- [x] 3.2 文書path、条件付きtitle、Rendered/Raw切替を一つのheaderへ整理し、同等H1の二重表示を避けながらH1がない文書とraw表示では主見出しを維持することをcomponent/E2E testで確認する。
- [x] 3.3 outlineを入れ子listへ変更し、current linkの`aria-current="location"`とancestor状態がscrollおよび直接fragment移動へ追従することをcomponent/E2E testで確認する。
- [x] 3.4 tree、document header、mode switch、outline active/ancestor、mobile close文言のCSSとcopyを整え、390px、1,024px、1,440pxのdev/static画像比較と全theme/paletteのaxe監査を成功させる。
- [x] 3.5 `./scripts/check.sh`を実行し、閲覧面UI変更sliceの全検証を成功させる。

## 4. 文書化と最終検証

- [x] 4.1 `README.md`と`README.ja.md`へ`includeIgnored`の安全な使用例、設定優先順位、新しいtree、title、outline、mobile closeの操作説明を同じ内容で反映し、Prettier検証を成功させる。
- [x] 4.2 `ROADMAP.md`へPhase 7.5の目的、実装範囲、Phase 8との境界、完了状況を反映し、既存Phase 8のscopeが変わっていないことをレビューする。
- [x] 4.3 `bunx openspec validate phase-7-5-ui-refinement --strict`と`./scripts/check.sh`を実行し、OpenSpec、型、format、unit、benchmark、pack/install、dev/static E2E、axeの最終検証を成功させる。

## 5. 視覚ノイズの追加調整

- [x] 5.1 文書treeからnative list markerを除き、folderの展開三角形だけを残して文書linkの開始位置を揃え、component/E2E testで構造を固定する。
- [x] 5.2 文書headerを補助的なpathと単一のcontextual view actionを持つcompact toolbarへ変更し、条件付きtitleを維持しながらcomponent/E2E testを更新する。
- [x] 5.3 主要幅と配色でtreeと文書headerの表示、keyboard操作、axe監査を確認し、README両言語とROADMAPの操作説明を同期する。
- [x] 5.4 `bunx openspec validate phase-7-5-ui-refinement --strict`と`./scripts/check.sh`を実行し、追加調整の全検証を成功させる。

## 6. 読書面と左ペインの責務分離

- [x] 6.1 本文headerを削除し、rendered表示では既存H1または不足時に補完するH1、raw表示ではsource本文から直接開始するcomponent/E2E testを追加する。
- [x] 6.2 表示形式操作を選択中の文書rowへ移し、`Source`と`Rendered`の切替、通常link操作、mobile drawer内操作をcomponent/E2E testで確認する。
- [x] 6.3 treeの階層indentを狭い一定幅へ調整し、深いtreeの表示幅を主要viewportの画像比較で確認する。
- [x] 6.4 Display settingsを左ペイン内の専用画面へ変更し、Documentsへの復帰、Escape、focus復帰、設定保存、dev/static同等性、axe監査を確認する。
- [x] 6.5 README両言語とROADMAPを新しい読書面、source操作、settings navigationへ同期する。
- [x] 6.6 `bunx openspec validate phase-7-5-ui-refinement --strict`と`./scripts/check.sh`を実行し、追加調整の全検証を成功させる。
