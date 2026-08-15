Done. Batch BH (行分组折叠) is complete, committed, and all gates pass.

## Summary

**Commits**: `f8add631` feat + `9edb533c` adapt report (working tree clean except pre-existing BG-stage entries)

### Files changed (4 source + 1 test, ≤4 constraint met)

| File                                            | Change                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/i18n.ts`                     | +2 keys: `table.groupCollapse` / `table.groupExpand` (toggle `aria-label`)                                                                                                                                                                                                                                        |
| `packages/react/src/primitives/table/props.ts`  | `groupCollapsed` + `defaultGroupCollapsed` + `onGroupCollapseChange` after `keymap` — single-line, controlled pattern mirroring `selection`                                                                                                                                                                       |
| `packages/react/src/primitives/table/Table.tsx` | 3 sites: internal `Set` state + no-optimistic-flip memo + toggle fn; `groupPlan` memo skips collapsed rows **and** per-group summary at one choke point (both flat & virtual paths inherit); `renderGroupHeader` gains native `<button data-iris-group-toggle aria-expanded>` (▸/▾) + `data-iris-group-collapsed` |
| `packages/react/src/primitives/table/types.ts`  | `groupBy` doc touch referencing the collapse contract                                                                                                                                                                                                                                                             |
| `test/group-collapse.test.tsx` (new)            | 12 tests, 359 lines (≤500)                                                                                                                                                                                                                                                                                        |
| `packages/manifest/{manifest.json,llms.txt}`    | regenerated + committed: propCount **149→152**, eventCount **28→29**, `onGroupCollapseChange` in events                                                                                                                                                                                                           |

### Verification (all pass)

- core test: **1469/1469** (95 files)
- react typecheck clean · react test **2163/2163** (192 files) · lint **0 errors** (1 pre-existing complexity warning)
- spec `--mode all --json`: **0 violations** (1414 files)
- `gen:manifest` regenerated + committed; manifest tests 69/69; `checks/manifest.mjs` clean

### Fiats honored

Hidden = rows+summary, full count stays · true controlled semantics (no optimistic flip) · callback in both modes · collapse never mutates selection/edit/index state (summary counts hidden rows, dirty dots survive) · stale keys inert · inert without groupBy / in tree mode · pure render layer (no onDataChange/undo/audit).

### Left

- No persisted collapse state (props are additive; `persistState`/`views` don't cover it, per baseline)
- vue/solid/svelte untouched (no groupBy parity exists in those frameworks — verified in baseline)
