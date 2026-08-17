Done. Full gate closed for grid 批 DC 列冻结复用（冻结区内 reorder，iris 独有）.

## Summary

**Review verdict**: PASS (batch-dc-review.md) — 3 doc-level findings, all fixed in this commit:

1. propCount 185 → **186** (`batch-dc-adapt.md:19`, `vxe-grid-comparison.md:74` DC row, `DECISIONS.md` ledger — actual manifest 186 props/32 events, verified against `manifest.json`)
2. test file "384 行" → **402 行** (`vxe-grid-comparison.md:74` DC row — `pinned-reorder.test.tsx` is 402 lines, verified with `wc -l`)
3. `Table.tsx:240` comment claimed "tests call it directly"; no test imports `clampReorderZone` (all 15 go through the full drag pipeline) — comment rewritten to say tests exercise it through the drag pipeline.

**Full gate**: `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks successful** (135 cached, 45 fresh)

- `pnpm audit` → **0 vulnerabilities**
- `gen:manifest` → regenerated 155 components ×4, 86 tokens; `check:manifest` → **up to date, zero diff**
- `docs/vxe-grid-comparison.md` updated: DC row (in iris 独有 table, from adapt) + 构建状态 paragraph append

**Final test counts** (re-verified with `--force`-style run):

- core: **1580 / 1580** (102 files)
- react: **2697 / 2697** (238 files, +15 from the new `pinned-reorder.test.tsx` 402-line suite)

**Commit**: gate commit carries the 3 review fixes + ledger/gate docs (implementation `2c0cfcb6` + docs sweep `24ff1b0c` already in tree).

Working tree clean (`.vinxi` excluded).
