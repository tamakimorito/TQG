# Changelog
- Format: `YYYY/MM/DD - vX.Y.Z`: short title
- Rules: append-only, do not rewrite history.

## 2025/12/19 - v1.3.2
- Feature: 1つのCSVを複数スプレッドシートへ連続適用する UI/処理を追加（タブ名も任意指定可、合計サマリ表示）。
- Update: バックエンド GAS v1.6.3 仕様を記録し、レスポンス項目（updatedCount 等）に合わせて画面表示を刷新。
- Docs: memory/spec.md を新設し、最新仕様と GAS スクリプト全文を保存。開発ルールを 0.01 刻み運用に明記。

## 2025/10/27 - v1.0.0
- Create TQG app: CSV.B ↔ Sheet.A lookup (zenkaku/hankaku A–Z insensitive).
- Append [Q,T,U,V,C] per hit as one row at tail.
- Sheets Registry UI + ©タマシステム2025 footer + TKG themed design.

## 2025/10/28 - v1.0.1
- Change: 追記先を「シート末尾の新行」→「一致行の右端列の次」に横方向で[Q,T,U,V,C]を追加する方式へ変更。
- Fix: フロントの ENDPOINT を正式URLに更新（省略記法除去）。
- UI: バージョン表記 v1.0.1 をフッターに追加（©タマシステム2025 と併記）。

## 2025/10/29 - v1.0.3
- Chore: アプリのバージョンを v1.0.3 に更新。
- Docs: UI上の説明文言を現在の機能に合わせて修正。

## 2025/10/30 - v1.1.0
- Enhance: 照合ロジックを更新し、英字に加えて数字の全角/半角表記の差異も吸収するように変更。

## 2025/10/31 - v1.2.3
- Feature: CSV処理時にシート名指定とデバッグモードを有効にする機能を追加。
- Enhance: CSVファイルのエンコーディング自動判定（UTF-8/Shift_JIS）に対応。

## 2025/10/28 - v1.3.1
- キー比較を normalizeKey(NFKC+不可視除去+Uppercase) に強化。
- debug で sampleCsvKeys/sampleAKeys を返却（原因即時特定用）。
- I/F互換は維持、追加プロパティは任意。
