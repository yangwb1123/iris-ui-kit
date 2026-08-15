Done — batch BW complete and committed.

## Report

**Batch BW: 右键快捷操作（复制值/清空，iris 独有）** — implemented per baseline, zero drift.

### Files changed (4 source + tests + docs)

| File                                                                                                                                    | Change                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/i18n.ts`                                                                                                             | +2 en keys `table.copyValue` `Copy value` · `table.clearCell` `Clear cell`                                                                                                                                                         |
| `packages/plugin-locale-zh/src/core/index.ts`                                                                                           | +2 zh keys `复制值` · `清空` (drift test auto-covers)                                                                                                                                                                              |
| `packages/react/src/primitives/table/Table.tsx`                                                                                         | 6 touches: 2 reserved-key consts `__iris-copy-value`/`__iris-clear-cell` · module helper `contextCellText` · 2 callbacks (`copyContextValue`/`clearContextCell`) · append point in `handleContextMenu` · onSelect wiring intercept |
| `packages/react/src/primitives/table/props.ts`                                                                                          | `contextMenu` doc + batch-BW built-in quick actions paragraph                                                                                                                                                                      |
| `packages/react/src/primitives/table/test/context-quick-actions.test.tsx` (new)                                                         | **12 tests, 321 lines** (≤500)                                                                                                                                                                                                     |
| `packages/react/src/primitives/table/{nl-summary,annotate-editing,suggest-distribution}.test.tsx` + `test/context-menu-select.test.tsx` | 12 pre-existing exact-menu-shape assertions updated for the unconditional items                                                                                                                                                    |
| `docs/vxe-grid-comparison.md`                                                                                                           | 3 places: new 独有表行 · 构建状态 · 测试计数 2332→2344                                                                                                                                                                             |
| `docs/vxe-grid/batch-bw-adapt.md` (new)                                                                                                 | adapt report                                                                                                                                                                                                                       |
| manifest                                                                                                                                | regenerated — **no structural diff** (propCount 162/eventCount 30 unchanged, as predicted; only the extracted `contextMenu` doc description lines)                                                                                 |

### Implementation

- **复制值** (`__iris-copy-value`, `table.copyValue`): copies the clicked cell's **display text** — module helper `contextCellText` = `applyCellMask` mask → formatter → `String` (null/undefined → `''`), the SAME chain as `cellTooltip` — via the existing `writeClipboardText` three-channel safe writer (registered handler → `navigator.clipboard` → hidden-textarea fallback; **no clipboard → safe no-op**).
- **清空** (`__iris-clear-cell`, `table.clearCell`): `setCellValue(current, rowKey, k, col.key, '')` → `commitRowList(next)` — the **Delete-shortcut precedent verbatim** (same undo/audit/onDataChange funnel); `isCellLocked`/`isCellReadonly` no-op; **no `onDataChange` → internal live data still updates, no crash** (documented lazy).
- **Unconditional** (no new prop): appended on EVERY context menu at `handleContextMenu`, insertion = user items → distribution? → summary? → **copy value → clear cell** → annotate? (「排在批注项前」). Both keys intercepted at the onSelect wiring (user callback never sees them) + reserved-key dedupe guard (distribution/summary/annotate pattern).

### Verification — all ✅

- core test **1517/1517** · react typecheck **clean** · react test **2344/2344** (+12) · react lint **0 errors** (1 pre-existing complexity warning)
- spec `--mode all` **0 violations** (1415 files) · manifest regenerated + committed

### Left

Runner's pending review/gate stage; vue/solid/svelte alignment deferred (react-only scope — the feature is a pure react-side menu extension, zero core logic).
