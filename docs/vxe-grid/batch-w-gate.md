Gate complete. Final report:

## ✅ Batch W Gate — PASS

**Verdict:** `docs/vxe-grid/batch-w-review.md` → **FAIL** with concrete fixes — applied, verified, then gated.

### Review fixes applied

| Finding                                                                                                                          | Fix                                                                                                                                                                                                                                                 | Verification                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **F1 (HIGH)** stale after mount — `tableRef` assigned once, handle methods captured mount-render `filteredData`/`displayColumns` | Mirrored `filteredData` → `filteredDataRef` and `leafColumns` → `viewColumnsRef` per render (same pattern as `liveDataRef`/`displaySelectionRef`); handle methods now read the refs; false "re-created every render → latest memo" comment replaced | +3 post-mount rerender tests: `filters` change (`ali`→`bob`), `data` shrink, `columnVisibility` change (export drops `Age`) — all pass |
| **F2 (MEDIUM)** grouped export lost leaf data — `displayColumns` held group parents (no `dataIndex`)                             | Export now uses `viewColumnsRef` (= `leafColumns`; reference-identical to `displayColumns` in flat mode → zero flat regression)                                                                                                                     | +1 grouped export test: CSV emits `Name,Age` leaf columns + all rows                                                                   |
| **F3 (LOW)** informational                                                                                                       | No fix required (matches baseline design)                                                                                                                                                                                                           | —                                                                                                                                      |

### Full repo gate

| Step                                                  | Result                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks successful** (55 executed, 125 cached, 1m39s)                          |
| `pnpm audit --audit-level low`                        | **0 vulnerabilities** ("No known vulnerabilities found")                               |
| `iris-ui-spec.py --mode all`                          | **0 violations** (1405 files)                                                          |
| `pnpm gen:manifest`                                   | regenerated: **155 components** (react/vue/solid/svelte 155×4, all aligned), 86 tokens |
| `pnpm check:manifest`                                 | **up to date** (byte-identical, no diff)                                               |

### Comparison doc

`docs/vxe-grid-comparison.md` updated:

- **最终覆盖总结** paragraph: batch V 收官 → 批 W 收官, adds `getFilteredData` / `exportCurrentViewCsv` / `showHeaderOverflow` / `showFooterOverflow`
- **表格方法** row: `+ getFilteredData/exportCurrentViewCsv ✓（批 W，react）→ 对齐（react）`
- **导入导出** row: `+ exportCurrentViewCsv 导出当前视图 ✓（批 W，react）`
- **构建状态 批 W** row added: `✅ react`
- Totals refreshed: react 1810 → **1823**, total 7411 → **7424**

### Commit

```
feat(table): vxe-grid 批 W——导出当前视图/过滤数据方法/表头表尾溢出（react only）
```

### Final test counts

- **react 1823/1823** (161 files, +13 vs batch V) · **core 1249** · **7424 total** across all packages (vue 1469, solid 950, svelte 930, plugins/apps included)

Working tree clean; batch W series closed.
