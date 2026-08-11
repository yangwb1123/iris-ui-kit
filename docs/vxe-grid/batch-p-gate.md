Gate complete. **Review verdict was FAIL → all 4 concrete fixes applied → full gate passed → committed.**

## Review fixes

1. **MAJOR – stale manifest**: `pnpm gen:manifest` regenerated; `check:manifest` now passes ("up to date"). Adds exactly the 7 batch-P props (IrisTable propCount 93→100), 155 components × 4 frameworks, `unavailable = 0`.
2. **MAJOR – footer `rowspan` corruption**: rowspan now **inert** in all three footer paths (summary / footerMethod / footerData) — removed the occupy-marking of later rows' cells and `gridRowEnd` (each footer row is its own grid container, so spans could never cover them; the probe's `'Grand'` disappearance is fixed). JSDoc updated in `props.ts`/`types.ts` to match.
3. **MINOR – `mergeHeaderCells` under `columnVirtualization`**: now fail-closed (`!!mergeHeaderCells && !columnVirtualization`), matching the prop JSDoc.
4. **MINOR – `aggregateAccuracy`**: out-of-range (n<0 / n>100) values ignored instead of `toFixed` throwing `RangeError`; documented.

Plus a bonus fix: unkeyed global summary row in the footer stack (batch-P React "unique key" warning) — now a keyed Fragment.

**+4 regression tests** (rowspan-inert, virtualization×merge fail-closed, accuracy out-of-range, empty footer tooltip).

## Gate results

- `turbo run test typecheck lint build` → **180/180 tasks**
- React tests **1709/1709** (1705 + 4 new)
- Typecheck 0 errors · lint 0 errors (1 pre-existing complexity warning)
- `pnpm audit` → **0 vulnerabilities**
- `check:manifest` passes; prettier clean
- Comparison doc updated: all 6 batch-P rows marked done (react) + 批 P build row

## Commits

- `2aa986cc` — `feat(table): vxe-grid 批 P——表头表尾合并/圆角内边距/合计精度/表头表尾提示（react only）`
- `0d771690` — `docs(vxe-grid): 批 P gate 报告` (`docs/vxe-grid/batch-p-gate.md`)

Working tree clean.
