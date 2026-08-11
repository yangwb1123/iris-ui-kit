Gate complete. **Review verdict was FAIL → all 6 concrete fixes applied → full gate passed → committed.**

## Review fixes

1. **MAJOR – autoResize measured-px pin rejected**: height-not-set mode now renders `height: 100%` on the root (fills AND tracks the parent; the RO observes the root, so a px-pinned root could never re-fire on container growth). The RO measure only gates `fixedHeight` (sticky-header/overflow engagement after a positive measure). Height-set mode unchanged. The 4 autoResize tests rewritten to assert `height: 100%` + `data-iris-table-fixed-height` engagement instead of measured px.
2. **MAJOR – stale manifest**: `pnpm gen:manifest` regenerated; `check:manifest` now passes ("up to date"). Adds exactly the 3 batch-Q props (`scrollbarConfig` / `editDirtyConfig` / `autoResize`) + 2 types (`IrisTableEditDirtyConfig` / `IrisTableScrollbarConfig`), react only; 155 components × 4 frameworks, `unavailable = 0`.
3. **MINOR – stale dirty keys on row removal**: `removeRow` / `removeRows` now prune the removed rows' `::`-prefixed dirty-map entries, so a re-added key (insertRow / proxy refetch / paging back) renders clean — no phantom dirty dots. +1 regression test (commit → removeRow → insertRow same key → attr null).
4. **MINOR – dirty key delimiter**: `${k}:${colKey}` → `${k}::${colKey}` (same `::` as `cellId`; `a:b`/`c` vs `a`/`b:c` can no longer collide). Centralized in a module-level `dirtyKey` helper.
5. **MINOR – class name aligned to baseline**: `iris-cell-dirty` → `iris-table-cell-dirty` (JSDoc in types.ts/props.ts + test updated).
6. **MINOR – logical property for RTL**: dirty dot `right: 4px` → `inset-inline-end: 4px` (live TABLE_ROW_CSS + styles.ts mirror); mirrors to the inline-start side in RTL.

## Gate results

- `turbo run test typecheck lint build` → **180/180 tasks**
- React tests **1722/1722** (1721 + 1 new; 13 batch-Q tests total)
- Core tests 1249/1249 (untouched)
- Typecheck 0 errors · lint 0 errors (1 pre-existing complexity warning)
- `pnpm audit` → **0 vulnerabilities**
- `check:manifest` passes; prettier clean (whole comparison table re-wrapped by prettier due to the new long rows)
- Comparison doc updated: autoResize / scrollbarConfig / editDirtyConfig rows marked done (react) + 批 Q build row + totals refreshed

## Commit

- `HEAD` — `feat(table): vxe-grid 批 Q——自动尺寸/滚动条配置/编辑脏标记（react only）`

Working tree clean.
