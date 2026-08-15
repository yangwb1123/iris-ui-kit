Batch BS complete. Committed as **`982dc909`** — `feat(table): vxe-grid 批 BS——多列分组 groupBy 数组嵌套（iris 独有）`.

## Report

### What was implemented

Table-level `groupBy?: string[]` (iris-only, multi-column nested grouping) per `batch-bs-baseline.md`:

| File                                            | Change                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/props.ts`  | +1: single-line `groupBy?: string[]` (after `keymap`, before `groupCollapsed`)                                                                                                                                                                                           |
| `packages/react/src/primitives/table/Table.tsx` | 3 touchpoints (+81): destructure; `groupPlan` memo rewritten as recursive builder (`groupByKeys` resolver → recursive `build()` reusing `groupRows` + `getCellValue`); `renderGroupHeader` gains `data-iris-group-depth` + token-step indent, displays level's own value |
| `packages/react/src/primitives/table/types.ts`  | 1 doc sentence: table-level array wins over column-level flag                                                                                                                                                                                                            |
| `test/group-multicol.test.tsx` (new)            | **13 tests, 412 lines** (≤500)                                                                                                                                                                                                                                           |
| `manifest.json`/`llms.txt`                      | regenerated via `pnpm gen:manifest` (propCount **158→159**, eventCount **30 unchanged**)                                                                                                                                                                                 |
| `docs/vxe-grid-comparison.md`                   | 3 places: 独有表行 / 构建状态 / 测试计数                                                                                                                                                                                                                                 |

### Semantics (baseline zero-drift)

- Array order = nesting depth; composite keys `v0::v1::…` (`::` = cellId delimiter), level-0 bare (single-col compat)
- Parent count = subtree total; `group-summary` innermost only; parent collapse hides whole subtree; same-value-different-parent leaf collapse independent
- Array wins over column `groupBy: true`; unknown keys dropped, dupes keep first; empty/unknown-only inert; no array → batch M/BH path byte-identical; tree mode fail-closed; zero core/i18n/events

### Verification — all ✅

- core test: **1517/1517**
- react typecheck: clean
- react test: **2281/2281** (+13)
- react lint: **0 errors** (1 pre-existing complexity warning)
- spec `--mode all --json`: **0 violations**
- `pnpm gen:manifest` regenerated + `check:manifest` up-to-date (155 components)

### Files changed (9 committed)

props.ts · Table.tsx · types.ts · group-multicol.test.tsx (new) · manifest.json + llms.txt (regenerated) · vxe-grid-comparison.md · batch-bs-adapt.md (new) · batch-bs-baseline.md (new, runner pre-written)

### Left

- vue/solid/svelte alignment deferred (react-only batch scope); runner's pending review/gate stage; pre-existing `zz-bq-probe.test.tsx` + DECISIONS.md/gate-doc modifications left untouched (not this batch's content).
