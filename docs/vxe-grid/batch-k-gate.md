Gate complete. Report:

## Batch K gate — PASS after fixes

**Verdict was FAIL** (2 MEDIUM races + 1 LOW format). The previous gate attempt had already applied the fixes but timed out before running the full gate and committing. I verified each fix against the review's findings, re-verified with the regression tests, then ran the complete gate:

### Fixes verified (already in worktree, confirmed correct)

1. **MEDIUM — stale lazy children re-seed** (`Table.tsx`): `lazyEpochRef` bump in the data-ref sync effect (clears cache + in-flight loading set) + epoch capture/check in the `lazyLoad` callback — stale fetch results are dropped, not re-seeded. Covered by test _"an in-flight lazyLoad resolving after a data refresh does not re-seed the cache"_.
2. **MEDIUM — Escape during async-pending commit writes back** (`core/src/cell-edit.ts`): monotonic `sessionGen` bumped on `startEdit`/`cancelEdit`/sync `commitEdit`; `commitAsync` drops when superseded. 3 new core tests + 2 react tests (cell + row mode, incl. _"Escape cancels a row whose async commit is pending without writing it back"_).
3. **LOW — prettier**: Table.tsx + new test formatted; batch K docs (`batch-k-*.md`, `DECISIONS.md`, comparison doc) formatted too.

### Full gate results

- **turbo test typecheck lint build**: **180/180 tasks passed** (concurrency=2)
- **audit**: 0 known vulnerabilities
- **gen:manifest**: 155/155 components, up-to-date (no diff)
- **Test counts**: **react 1629 passed** (1618→1629, +11) · **core 1249 passed** (1245→1249, +4) · table suite 302/302 incl. 11 new batch-K tests
- **format:check**: all batch-K files clean; 3 svelte files (`IrisCompose/IrisSelect/IrisTable.svelte`) fail identically at HEAD — pre-existing drift from the prettier 3.9.6 upgrade (44d1f86e), untouched by K (react/core only), same class as the pre-existing arch-check/audit:tokens failures the review waved through.

### Comparison doc

`docs/vxe-grid-comparison.md`: 编辑 gap updated (row 模式 done), 树形 → 批 J+K (刷新清缓存 + epoch 防陈旧回填), Tab 编辑导航 → 批 J+K (异步校验延期落焦/失败停留/Escape 取消), new 行编辑模式 row, 批 K build row, counts footer → react 1629 · core 1249.

### Commit

`2563a2856845bdd89051414030db1b28e0be036c` — `feat(table): vxe-grid 批 K——row 编辑模式 + Tab 异步校验/懒加载缓存修复（react only）` (10 files, +1193/−236; working tree clean).
