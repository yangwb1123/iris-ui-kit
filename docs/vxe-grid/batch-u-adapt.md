All gates green on the committed state.

## Report

**Commit:** `23f4d836` — `feat(table): vxe-grid 批 U——zoom 缩放/layouts 布局/visibleMethod 列可见（react only，final batch）` (working tree clean)

### Files changed (12)

| File                                                                        | Change                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                              | +2 props: `zoomConfig?: { showButton?: boolean }`, `layouts?: { form/toolbar: 'top'\|'hidden'; pager: 'bottom'\|'hidden' }` — each **one line** (manifest scanner-safe); 484/500 lines (97%, no types.ts migration needed)                                                                                                                                                                                                      |
| `packages/react/src/primitives/table/types.ts`                              | +1: `IrisTableColumn.visibleMethod?: () => boolean` (one line)                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/react/src/primitives/table/Table.tsx`                             | +81: displayColumns memo (visibleMethod ANDed, reference-preserving); `zoomed` state + window-Esc effect (active only while zoomed); zoom toggle button after batch button (`data-iris-table-zoom`, ⛶/✕, `table.zoomIn/zoomOut` aria-label); root `data-iris-table-zoomed` + `height: 100%` after `...style`; `fixedHeight` +zoomed; form/toolbar/pager `layouts` suppression; token-only fixed-overlay rule in `TABLE_ROW_CSS` |
| `packages/core/src/i18n.ts` / `packages/plugin-locale-zh/src/core/index.ts` | +2 keys each: `table.zoomIn/zoomOut` (en `Zoom in`/`Zoom out`; zh `放大`/`退出放大`)                                                                                                                                                                                                                                                                                                                                            |
| `packages/manifest/{manifest.json,llms.txt}`                                | regenerated (155 components baseline unchanged; react IrisTable props 115→117)                                                                                                                                                                                                                                                                                                                                                  |
| `docs/vxe-grid/{batch-u-adapt.md, DECISIONS.md, vxe-grid-comparison.md}`    | adapt record, decisions log, comparison doc rows (toolbar +zoom, new 布局 row, 批 U row, totals)                                                                                                                                                                                                                                                                                                                                |

**Tests:** new `zoom-layouts-visiblemethod.test.tsx` — **19 tests** (326→360 lines after prettier, ≤500): zoom button render/no-config, click toggles `data-iris-table-zoomed` + aria-label/icon, Esc exit, grid intact under overlay, stylesheet rule + fixedHeight engagement; layouts defaults + each `hidden` flag; visibleMethod false/true/absent, both columnVisibility interplay directions, once-per-render call count, grouped-table scope.

### Decisions (documented in types.ts, stylesheet comment, adapt doc)

- `visibleMethod() === false` **overrides** `columnVisibility: true`; scope mirrors columnVisibility (top-level only — grouped leaves not consulted)
- Zoom overlay is safe: the root is a plain block (each row is its own grid); form/toolbar/pager are fragment siblings **outside** the root and stay visible (vxe grid-zoom parity); no toolbar → no zoom entry point; caller inline `position`/`z-index` would override the stylesheet rule (documented caveat); no body scroll lock
- zh `zoomOut` = `退出放大` (explicit exit semantics, not vxe's 缩小)

### Verification

- react typecheck ✓ · react tests **1798/1798** (159 files) · lint **0 errors** (1 pre-existing complexity warning, 161→176 vs HEAD) · core **1249/1249** · zh **6/6** (incl. full-key parity guard) · spec scanner **0 violations** · `pnpm gen:manifest` regenerated + committed · prettier clean · no dist/tgz/node_modules edits (core dist rebuilt locally only — git-ignored, needed for i18n keys in react tests)

**Unfinished:** none.
