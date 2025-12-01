# Changelog
- Format: `YYYY/MM/DD - vX.Y.Z`: short title
- Rules: append-only, do not rewrite history.

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

## 2025/11/01 - v1.6.2
- Add でんき系4項目（H/M/N/O列）を同一突合条件で書き込み、ヘッダも新設（既存5列の後ろに追加する想定）。
- Allow csvPickByLetters to accept 9列指定（5列指定も後方互換）。

## 2025/11/02 - v1.6.3
- Fix: reuse existing matching headers for overwrites and only append missing ones at the sheet tail (no duplicate header growth).
- Docs: clarify header reuse/append behavior and bump version labels to v1.6.3.
