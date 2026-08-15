# Batch BL Gate Report — 性能面板 `perfStats`（iris 独有）

**Verdict: PASS** (review: 0 findings, 3 minor observations) → gate executed and committed.

## Gate results (all actually run)

| Check                                                 | Result                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks**, exit 0 (4m19s; 54 cached)                                                                                        |
| `pnpm audit:security`                                 | **0 vulnerabilities** ("No known vulnerabilities found")                                                                            |
| `pnpm audit:tokens`                                   | **37 warnings = baseline 37** (pre-BL commit `d1fdc657~1` measured identically) — **zero new**, no perf-related tokens              |
| `gen:manifest` + `check:manifest`                     | up to date — **155×4** (react/vue/solid/svelte), unavailable 0, 86 tokens, **zero diff** (already current in `d1fdc657`)            |
| Additive / framework-free                             | review-confirmed: core framework-free grep clean, vue/solid/svelte untouched, no dist committed, propCount 152→153 with `perfStats` |
| Pre-commit hooks                                      | prettier + filesize + change budget passed (4 files, 0 core logic lines)                                                            |

## Final test counts

- **core 1517** (批 BL +12, perf-stats) · **react 2206** (批 BL +12, perf-stats) · vue 1531 · solid 974 (+34 hydration) · svelte 916 (+31 hydration)
- 批 BL 新增 24 tests = core 12 + react 12, matching review-verified counts (incl. both spec-mandatory pairs).

## Docs

- `docs/vxe-grid-comparison.md` — all 3 sites already updated in implementation commit `d1fdc657` (iris 独有 table row 66 · 构建状态 line 281 · test-count line 339); verified present, no further edits needed.
- `docs/vxe-grid/batch-bl-gate.md` written (this file).

## Commit

**`fc18175e`** (amended) — `feat(table): grid 批 BL——性能面板（iris 独有）` — parent `d1fdc657`, fast-forwarded onto `main`.
