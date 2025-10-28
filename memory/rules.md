
# Project Rules
- Append-only; reflect newly agreed constraints.

## Baseline
- Do not overwrite existing rows/columns; append rows only.
- Keep API payload/keys/types stable.
- Normalize alphabet width only; keep digits/signs intact.
- Document every change in `memory/changelog.md`.

## Append Policy
- 行追記ではなく、照合ヒット行の右端列に横方向追記する方式を優先。
- 既存セルの上書きは禁止。右端の次列から追加する。
