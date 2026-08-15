Done. Batch BT complete and committed (`12addddc` + `df08796e`).

## Report

### Files changed (9 committed)

| File                                                                                  | Change                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                                        | +1: `selectionDrag?: boolean` (after `checkboxRange`)                                                                                                                                       |
| `packages/react/src/primitives/table/Table.tsx`                                       | destructure + 4 refs + 3 handlers + `hitTestSelectionRowKey` helper · `__selection` cell `onPointerDown` + onClick suppression gate · root pointer gates 3→4 drag dispatch (move/up/cancel) |
| `packages/react/src/primitives/table/test/selection-drag.test.tsx` (new)              | 13 tests, 269 lines (≤500)                                                                                                                                                                  |
| `packages/manifest/manifest.json` + `llms.txt`                                        | regenerated — propCount **159→160**, eventCount 30 unchanged                                                                                                                                |
| `docs/vxe-grid-comparison.md`                                                         | 3 places: 独有表行 / 构建状态 / 测试计数                                                                                                                                                    |
| `docs/vxe-grid/batch-bt-adapt.md` (new) + `batch-bt-baseline.md` (runner pre-written) | reports                                                                                                                                                                                     |

### Implementation (baseline zero-drift)

- Press on the `__selection` cell (multi mode) selects **nothing**; pointermove past **4px threshold** starts the drag
- `elementFromPoint` → `closest('[data-iris-table-row]')` (range-fill precedent — group headers/detail slots lack the attr, summaries/footers unresolvable → ignored); String-key `findIndex`; **closed interval [anchor, hover]**, checkMethod-eligible only, **monotonic union** via `seen` → `rebaseToProp()` + `selModel.set([...display, ...add])` (reverse drags never uncheck)
- Trailing-click suppression reuses the shift-click mechanism (`preventDefault` cancels label→input forwarding); plain clicks toggle a single row; flag re-armed per press; pointer capture + pointercancel cleanup

### Tests added (13)

① 1→4 full interval · ② checkMethod skipped+disabled · ③ plain click toggles (sub-threshold no-op) · ④ trailing click no double-toggle · ⑤ reverse drag · ⑥ additive retention · ⑦ monotonic shrink · ⑧ no-prop laziness · ⑨ single no-op · ⑩ controlled no optimistic flip · ⑪ tree flattened · ⑫ disabled anchor starts drag · ⑬ non-row area keeps range

### Verification — all ✅

- core test **1517/1517** · react typecheck clean · react test **2294/2294** (+13) · react lint **0 errors** (1 pre-existing complexity warning) · spec `--mode all` **0 violations** · `gen:manifest` regenerated + `check:manifest` up-to-date · prettier clean on all touched files

### Left

Runner's pending review/gate stage; vue/solid/svelte alignment deferred (react-only scope); pre-existing `DECISIONS.md`/`batch-bs-gate.md` modifications left untouched (not this batch's content).
