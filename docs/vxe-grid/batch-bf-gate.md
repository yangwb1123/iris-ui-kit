Done. The review verdict was **PASS** — no implementation changes required. Full repo gate rerun, manifest regen, comparison doc updated, committed.

## Gate results

| Check                                 | Result                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build` | **180/180 tasks successful** (2m09s, 135 cached)                                                                                   |
| react tests                           | **2140 passed** (190 files; +8 export-version-csv suite)                                                                           |
| core                                  | 1457 passed, zero diff                                                                                                             |
| `pnpm audit`                          | **0 vulnerabilities**                                                                                                              |
| `gen:manifest` + `check:manifest`     | up to date, byte-identical (155 components × 4; handle method manifest-invisible, `restoreVersion`/`exportSelectionCsv` precedent) |

Review findings disposition:

- **[LOW]** Baseline's "locked invariant" (post-`restoreVersion(i)` byte-equality) is over-scoped when a filter/sort is active — `exportVersionCsv` exports the raw ring pre-change snapshot while `exportCurrentViewCsv` exports the filtered+sorted view. No code change; scoped in the doc: comparison-doc row + JSDoc wording already converge on "unfiltered/unsorted case" for the equality (test #6 covers exactly that).
- **[INFO]** Header-only export for a valid empty-pre-change version vs `''` for unknown/no-prop — consistent with `exportCurrentViewCsv`, documented.
- **[INFO]** `audit:tokens` 5 legacy failures — pre-existing (batch P/A), batch BF added zero CSS.

`docs/vxe-grid-comparison.md` updated: new「iris 独有」row (`数据导出时间线 exportVersionCsv`), batch-table row 批 BF, 构建状态 paragraph (+BF entry), test-count summary 2132 → 2140.

## Commit

```
<HASH>
feat(table): grid 批 BF——数据导出时间线（iris 独有）
```
