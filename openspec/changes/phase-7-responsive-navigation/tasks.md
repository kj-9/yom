## 0. 実装前提

- [x] 0.1 `migrate-site-to-vite-preact`を完了し、移行後のcomponent、共有reducer、dev/static rendering経路と要件・設計・tasksの整合を再レビューしてから1章以降へ着手する。

## 1. ナビゲーション構造と状態管理

- [x] 1.1 移行後の共有Preact shellと`DocumentTree`へモバイル背景レイヤーを追加し、文書一覧を「Documents」、ページ内見出しを「On this page」として区別し、component testまたはE2Eで各アクセシブルネームを確認する。
- [x] 1.2 モバイルナビゲーションの開閉を共有reducerへ集約し、開閉ボタン、`Escape`、背景クリック、文書選択、デスクトップ幅への変更で状態を正しく解除できることをreducer testとレスポンシブE2Eで確認する。
- [x] 1.3 閉じる操作後の開閉ボタンへのフォーカス復帰、`aria-expanded`、背景操作・ページスクロールの抑止と解除を実装し、キーボード操作とaxe監査で確認する。

## 2. レスポンシブレイアウト

- [x] 2.1 `src/site/styles.css`へ1,200pxと900pxの段階的レイアウトを実装し、1,440pxで3ペイン、1,024pxで2ペインかつ本文側レイアウト領域640px以上になることをE2Eの境界値で確認する。
- [x] 2.2 900px未満の文書ツリーを本文位置を変えない固定オーバーレイドロワーとして実装し、390pxで開閉前後の本文境界が一致することをE2Eで確認する。
- [x] 2.3 320px幅で長いパス、コード、表、画像がページ全体を横方向にあふれさせないスタイルを追加し、`scrollWidth <= clientWidth`と要素内スクロールをE2Eで確認する。

## 3. devとstatic buildの回帰検証

- [x] 3.1 `tests/e2e/dev.spec.ts`へ390px、1,024px、1,440pxの表示状態と主要配置を検証するシナリオを追加し、`bun run test:e2e -- --grep "responsive navigation"`が成功することを確認する。
- [x] 3.2 同じE2Eヘルパーをdevとstatic buildへ適用し、各幅の主要状態とスクリーンショットが一致することを確認する。
- [x] 3.3 `README.md`と`README.ja.md`の閲覧UI説明を同じ内容で更新し、`bun run format`が成功することを確認する。

## 4. 全体検証

- [x] 4.1 `./scripts/check.sh`を実行し、型検査、フォーマット、unit、benchmark、package、E2Eの全検証が成功することを確認する。
