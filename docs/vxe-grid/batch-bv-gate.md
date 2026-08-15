Gate stage complete. **Review verdict was PASS** (2 × LOW findings, no gate-blocking fixes) → full repo gate green, committed.

## Review findings (documented, not fixed — PASS path)

| Finding                                                                                                                                | Severity | Note                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Masked `rowKey` column breaks composite lookup (composite pass reads post-mask key → changed rows silently lose `old → new` composite) | LOW      | Empirically verified by review probes; edge case (rowKey column also masked + masked values differ). No UI/gate impact; documented for a future hardening batch |
| Reserved key `__iris_diff` collides with a user column of the same key (duplicate columns + user data overwritten)                     | LOW      | Reserved-key collision; documented in the spec (public doc marks `__iris_diff` as reserved)                                                                     |

## Gate results

- **Full repo gate**: `env COREPACK_ENABLE_PROJECT_SPEC=0 corepack pnpm turbo run test typecheck lint build --concurrency=2` → **180/180 successful** (64 cached)
- **Audit**: `audit:security` **0 vulnerabilities**; `audit:tokens` only pre-existing warnings — BV adds zero `var(--iris-*)` (verified: 0 new usages in Table.tsx diff + test file)
- **Manifest**: `gen:manifest` → 155 components × 4 frameworks, 86 tokens; **no diff** (propCount 161 / eventCount 30 unchanged — handle + i18n both invisible, as baseline predicted) · `check:manifest` up-to-date (2 files)
- **Comparison doc**: `docs/vxe-grid-comparison.md` iris 独有 section already current at the adapt commit (new `exportComparisonCsv` 独有表行 · compareWith row 批 BV 增量 · 构建状态 +批 BV · 测试计数 2306→2320) — gate re-verified every figure

## Test counts

- **core**: 1517/1517 (97 files) · **react**: 2320/2320 (205 files, incl. +14 `export-comparison-csv`)
- vue 1531 · solid 974 + 34 hydration · svelte 916 + 31 hydration (unchanged, per doc)

## Commit

**`2ecf1da5a88fcf94930b3e4ff88f1e92be531173`** — `feat(table): grid 批 BV——导出比较（iris 独有）` (gate-stage delta: DECISIONS.md stage entries for BV gate + baseline/review/adapt docs swept in by `git add -A`; source already committed at `30c936d2`)
