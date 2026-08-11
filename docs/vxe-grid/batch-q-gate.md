Gate complete. **Review verdict was FAIL → all 6 concrete fixes applied → full gate passed → committed.**

## Review fixes applied

1. **MAJOR — autoResize measured-px pin rejected**: height-not-set mode now renders `height: 100%` on the root (fills AND tracks the parent; the RO observes the root, so a px-pinned root could never re-fire). The RO measure only gates `fixedHeight` (sticky/overflow engagement). 4 tests rewritten to assert `height: 100%` + `data-iris-table-fixed-height` engagement, not measured px.
2. **MAJOR — stale manifest**: `pnpm gen:manifest` regenerated → `check:manifest` passes; diff adds exactly the 3 props + 2 types (`IrisTableEditDirtyConfig`/`IrisTableScrollbarConfig`).
3. **MINOR — `removeRow`/`removeRows` prune dirty keys** (prefix-scan delete) + 1 new regression test (commit → removeRow → insertRow same key → clean).
4. **MINOR — dirty key `::` delimiter** (matches `cellId`; centralized `dirtyKey` helper).
5. **MINOR — `iris-table-cell-dirty` class** aligned to baseline (JSDoc + test updated).
6. **MINOR — `inset-inline-end`** logical property for the dirty dot (live CSS + styles.ts mirror).

## Gate results

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks** (react package re-verified after prettier formatting)
- **React tests 1722/1722** (155 files; 13 batch-Q tests incl. the new removeRow-prune test)
- Core tests 1249/1249 (untouched, framework-free)
- Typecheck 0 errors · lint 0 errors (1 pre-existing complexity warning)
- `pnpm audit` → **0 vulnerabilities** · `check:manifest` passes · prettier clean

## Commit

**`018f6d64`** — `feat(table): vxe-grid 批 Q——自动尺寸/滚动条配置/编辑脏标记（react only）`

Working tree clean. Comparison doc updated: autoResize / scrollbarConfig / editDirtyConfig rows marked done (react) + 批 Q build row + totals refreshed (react 1722 · core 1249 · 7298 total).
