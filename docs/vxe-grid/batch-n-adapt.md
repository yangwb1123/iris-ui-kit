All gates green. Final report:

## Report: iris-ui vxe-grid batch N (height + header/footer align + footerMethod + hover highlight)

### Files changed (5 source + 1 test; core untouched, React-only, additive)

| File                                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/props.ts`                           | +7 props: `height` / `minHeight` / `maxHeight` (each single line, number\|string), `headerAlign` / `footerAlign` (`IrisTableAlign`), `footerMethod` (function-type, **one line**), `highlightHoverRow`                                                                                                                                                                                                                                                                                                                                           |
| `packages/react/src/primitives/table/types.ts`                           | +2 types: `IrisTableAlign` alias, `IrisTableFooterMethodParams<Row>` (`columns` = leaf columns, `data` = full body rows)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `packages/react/src/primitives/table/Table.tsx`                          | root container height/overflow + `data-iris-table-fixed-height`/`data-iris-no-hover` attrs; `justifyFor` helper wired into flat + grouped header cells (leaf: `headerAlign ?? col.align ?? 'left'`; group headers: `headerAlign ?? 'center'`), summary cells + footerMethod cells (`footerAlign ?? col.align`) and footerData cells (`footerAlign ?? col.align ?? number→'right'`); footerMethod rows replacing the summary path (`&& !footerMethod`); active `TABLE_ROW_CSS` gains sticky-header rule + `:not([data-iris-no-hover])` hover gate |
| `packages/react/src/primitives/table/styles.ts`                          | Mirrored the same two CSS rules into the exported copy (kept in sync)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/react/src/primitives/table/index.ts`                           | Exports the 2 new types (manifest hygiene)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/react/src/primitives/table/height-align-footermethod.test.tsx` | **New, 213 lines** (≤500), 13 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Design decisions

- Sticky header: `[data-iris-table-fixed-height] [data-iris-table-row="header"] { position: sticky; top: 0; z-index: 2 }` — verified both flat (`Table.tsx` grouped `:2930`/flat `:3074` equivalent) variants carry `data-iris-table-row="header"`; z-index 2 > pinned-cell zIndex 1.
- `highlightHoverRow` (default `true`): `data-iris-no-hover` attr gates the hover rule via `:not()` — no re-injection needed (singleton stylesheet).
- footerMethod rows reuse the summary row styling (`data-iris-table-row="summary"` + `data-iris-table-footer-method-row` index marker); 2px borderTop on row 0, light `borderStyle` on subsequent rows; `footerData` renders below; summary op path fully skipped; both skipped on empty data (consistent with existing summary behavior).

### Verification

- ✅ `pnpm --filter @iris-ui-kit/react typecheck` — clean
- ✅ `pnpm --filter @iris-ui-kit/react test` — **1673 passed / 152 files** (incl. 13 new)
- ✅ `pnpm --filter @iris-ui-kit/react lint` — **0 errors** (1 pre-existing `complexity` warning on `IrisTable`, was 131 → 143 — already flagged before this batch)
- ✅ `iris-ui-spec.py --mode all --json` — **0 violations** / 1403 files
- ✅ Prettier clean on all changed files; no dist/tgz/node_modules/manifest.json touched

### Unfinished / open items (baseline's 6 questions, resolved)

1. **group-summary × footerMethod**: footerMethod replaces only the _global_ summary row; per-group summaries (batch M grouped mode) still render — vxe footer-method is a global footer, documented simplification.
2. **empty-data footer**: footerMethod skipped when `bodyData` is empty (matches summary behavior).
3. **height × virtualScroll**: root becomes the scroller; `IrisVirtualScroll`'s internal scroller nests inside (user's combination choice).
4. **pager-in-scroller**: proxy pager renders inside the scroll container when fixed height is set (may scroll out of view).
5. **borderTop per multi-row footer**: 2px on first row, light border on the rest.
6. **z-index**: sticky header = 2 (above pinned body cells at 1); verified in the injected stylesheet, which the test asserts.
