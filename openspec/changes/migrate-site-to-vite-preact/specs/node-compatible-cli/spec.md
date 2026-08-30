## Purpose

公開されたyom packageをBunに依存しないNode.js環境で導入・実行できるようにし、CLI、公開export、caller projectからの分離、配布容量の互換性境界を定義する。

## ADDED Requirements

### Requirement: Supported Node.js runtimes
yomの公開packageはBunがinstallされていないNode.js 22.12以上の22系およびNode.js 24系で動作しなければならない（MUST）。

#### Scenario: Node.js 22でCLIを実行する
- **WHEN** Node.js 22.12以上の環境へpack済みpackageをinstallし、`yom --help`、`yom dev`、`yom build`、`yom preview`を実行する
- **THEN** 各commandはBun executableまたはBun runtime APIを要求せず起動する

#### Scenario: Node.js 24でCLIを実行する
- **WHEN** Node.js 24環境へpack済みpackageをinstallし、`yom --help`、`yom dev`、`yom build`、`yom preview`を実行する
- **THEN** 各commandはBun executableまたはBun runtime APIを要求せず起動する

#### Scenario: 最低version未満で実行する
- **WHEN** Node.js 22.12未満で公開CLIを起動する
- **THEN** CLIは対応する最低Node.js versionを示す明確なerrorで終了する

### Requirement: Compiled ESM distribution
公開packageのexecutableと公開exportは、install先でTypeScript変換を必要としないcompiled ESMを参照しなければならない（MUST）。

#### Scenario: 公開binを検査する
- **WHEN** pack済みpackageのbin entryを実行する
- **THEN** Node.js shebangからcompiled JavaScript ESMが読み込まれ、`.ts` sourceへのruntime importは発生しない

#### Scenario: 公開exportを読み込む
- **WHEN** Node.js ESM programからpackage.jsonに定義されたyomの公開exportをimportする
- **THEN** 公開APIは追加のTypeScript loaderなしで読み込める

### Requirement: Caller project isolation
CLIはrepository外のcaller directoryから実行でき、caller projectのVite設定をyom自身の設定として読み込んではならない（MUST NOT）。

#### Scenario: callerにVite設定が存在する
- **WHEN** 独自の`vite.config.*`を持つ別project directoryでyomの`dev`または`build`を実行する
- **THEN** yomはcallerのVite設定を読み込まず、yomが定義する設定だけで処理する

#### Scenario: TypeScriptのyom設定を使用する
- **WHEN** caller projectが有効な`yom.config.ts`を指定してCLIを実行する
- **THEN** yomはcallerのVite設定から分離したままyom設定を読み込み、設定内容をcommandへ反映する

### Requirement: Bun is development-only
Bunはyom repositoryのpackage管理およびtest実行に使用できるが、公開packageのproduction実行条件になってはならない（MUST NOT）。

#### Scenario: BunをPATHから除外する
- **WHEN** BunをPATHへ含めない環境でpack済みpackageのNode.js互換testを実行する
- **THEN** install、公開export、主要CLI commandの検証が成功する

### Requirement: Production footprint budget
同一platformおよび同一測定手順で`--omit=dev` installしたproduction dependency容量は、変更前のlocked baselineから10 MiBを超えて増加してはならない（MUST NOT）。

#### Scenario: production installを比較する
- **WHEN** 変更前baselineと変更後packageを同じNode.js、package manager、platformでproduction installして容量とpackage数を記録する
- **THEN** 変更後の`node_modules`容量増分は10 MiB以下であり、比較結果とpack tarball容量が検証記録へ残る

### Requirement: Excluded site-engine dependencies
公開packageはAstro、Starlight、Pagefindを直接または選択したsite engineとして追加してはならない（MUST NOT）。

#### Scenario: production dependency graphを検査する
- **WHEN** lockfileとpack済みpackageのproduction dependency graphを検査する
- **THEN** Astro、Starlight、Pagefindは含まれない
