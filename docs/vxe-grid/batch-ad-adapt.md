Done. Committed as `6754d32f`.

## Report

**Key finding from the baseline**: the batch-AB interaction surface (rowDrag/columnDrag, row edit mode, contextMenu, filterValues, tableRef) **already landed** in `8f40aaac` with parity-ab tests, and the AB review's 2 MEDIUM + 2 LOW findings were already addressed in that commit (verified: rowMode-first click path, dblclick re-begins the row, proxy page-change clears `localRows`, epoch guards on pending async commits). The one genuinely outstanding in-scope feature was **lazyLoad** (in scope per baseline §2f since solid has `getSubRows` tree support; handed off).

### Files changed (4 source + tests)

| File                                                     | Change                                                                                                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/solid/src/primitives/table/types.ts`           | +`IrisTableLazyLoad` named type                                                                                                                                                                             |
| `packages/solid/src/primitives/table/props.ts`           | +`lazyLoad?` (single-line prop)                                                                                                                                                                             |
| `packages/solid/src/primitives/table/index.ts`           | re-export `IrisTableLazyLoad`                                                                                                                                                                               |
| `packages/solid/src/primitives/table/IrisTable.tsx`      | lazyLoad machinery (epoch + reactive loading set + closure cache winning over `getSubRows` + spinner caret + stale-fetch drop) + row-mode session liveness guard (blur-after-close double-commit hardening) |
| `packages/solid/src/primitives/table/parity-ad.test.tsx` | **new — 486 lines / 15 tests** (≤500 ✓)                                                                                                                                                                     |
| `manifest.json`/`llms.txt`                               | regenerated (155 comps, 4×155; solid contract gains `lazyLoad?` + `IrisTableLazyLoad`)                                                                                                                      |

### Tests added (15)

lazyLoad ×5 (caret + first-expand/expand + cache reuse · pending spinner + empty resolve drops caret · throwing load retryable · data-source change drops stale result (epoch) · lazy cache wins over `getSubRows`) · rowDrag/columnDrag reorder ×2 · row mode (all editors open + Escape cancels; Enter-then-blur commits exactly once) ×2 · contextMenu (cursor anchor + onSelect; Esc closes + header excluded) ×2 · filter panel (OR-match + clear; remote comma-join) ×2 · tableRef (loadData no query / reloadData / proxy info; clearSort + clearFilter) ×2.

### Counts

- typecheck **0 errors** · lint **0 errors** · tests **974 unit + 34 SSR all pass** (128 files) · build ✓ · prettier ✓ · manifest tests 69 ✓
- `iris-ui-spec.py --mode all --json` → **0 violations**
- CSS: only `--iris-*` tokens (spinner keyframes token-driven in the singleton stylesheet)

### Handoff list

1. **Svelte interaction round** — svelte still lacks filterValues/filter panel, contextMenu, rowDrag/columnDrag, row edit mode, lazyLoad, tableRef (AC baseline handoff); react/solid now define reference semantics.
2. `editConfig.showAsterisk` — declared but unrendered in all adapters (react's is a style-only no-op); confirm vxe semantics or drop the type field.
3. `trigger: 'manual'` — unwired in react + solid; needs vxe manual-trigger (grid methods) semantics first.
4. `editor: 'select'` row-mode editors — row sessions are text/number only.
5. Handle scope — solid exposes the 6 proxy/reset methods; react also has row/view ops (additive growth per batch; `IrisTable.tsx` ~3250 lines).
