# TQG 仕様書 v1.3.2

## 目的
- CSVをもとに複数スプレッドシートへ一括でデータ更新する。
- 入力URLを改行区切りで複数受け付け、結果をシート単位で表示・確認できるようにする。

## フロントエンド (Angular)
- シートURL入力: テキストエリアで改行区切り入力。`https://docs.google.com/spreadsheets/d/` 形式のみ有効と判定し、有効件数/無効件数を表示。
- 実行: 有効URLが1件以上、無効URLなし、CSV選択済み、処理中でない場合のみ送信可能。送信時に対象件数を確認ダイアログで表示。
- 結果表示: 処理時間、対象件数、成功件数、総更新件数をサマリ表示。各シートごとにタイトル・URL・タブ名・処理結果（成功/失敗）と統計（処理行数/一致件数/更新件数/未一致件数）をカードで表示。失敗時は理由も表示。
- 成功トースト: 成功したシート数と総更新件数を通知。トップレベルで失敗の場合はエラートーストを表示。

## バックエンド (GAS) v1.6.4
- ファイル: `memory/gas/tqg_gas_v1.6.4.js`
- エンドポイント: `action: "processCsv"`
- 入力:
  - `sheetUrls: string[]`（後方互換として `sheetUrl` も可）
  - `csvBase64: string`
  - 任意: `sheetName`, `encodingHint`, `mdqOnly`, `enableFallback`, `fallbackKeyPairs`, `keyColumnName`, `keyColumnIndex`, `csvPickByLetters`
- 処理:
  - CSVを一度だけデコードし、各シートに順次適用。
  - A列キー突合＋任意のセカンダリキー突合（既定の候補セットあり）。
  - ターゲット列見出しが無い場合は末尾に追加し、存在時は上書き。
  - 2099/12/31は空欄保存。
  - 列記号指定 `csvPickByLetters` による抽出を優先。未指定時はヘッダ名に基づき抽出。
- 出力:
  - `ok: boolean`（全シート成功時 true）
  - `results: ProcessCsvSheetResult[]`（シートごとの成功/失敗、タイトル、タブ名、統計、エラー理由など）
  - `encodingUsed`, `triedEncodings`, `version` を返す。`debug=true` 時はフォールバック例なども各結果に含める。

## バージョン管理ルール
- 0.01刻みでバージョンを上げる。
- 仕様追加・変更時は本ファイルと `changelog.md` を更新する。
