Batch BR complete and committed (`1fb5bf54`). All verification gates green.

## Report

**Batch BR: 校验统计 `validationSummary`（iris 独有）** — implemented per baseline, zero drift.

### Files changed (4 source + tests + docs, 9 files committed)

| File                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`  | +1 `validationSummary?: boolean` (single-line prop after `freshness`)                                                                                                                                                                                                                                                                                                                                                 |
| `packages/react/src/primitives/table/Table.tsx` | 8 touch groups per baseline: module helper `hasEditRules` · destructure · state/refs/effect (`validationCounts`/`validationSummaryRef`/`validationIntentRef` + reset effect) · `commitWithSummaryIntent` + `bumpValidationCount` · cellEdit memo validate/onCommit wrappers · createRowSession 同款 · 5 commit-intent sites (cell wrapper, Tab editRules branch, row Enter/Tab/row-switch) · toolbar gate + stamp JSX |
| `packages/core/src/i18n.ts`                     | +1 `table.validationSummary` en `Passed {ok} · Failed {fail}`                                                                                                                                                                                                                                                                                                                                                         |
| `packages/plugin-locale-zh/src/core/index.ts`   | +1 zh `通过 {ok} · 失败 {fail}`                                                                                                                                                                                                                                                                                                                                                                                       |
| `test/validation-summary.test.tsx` (new)        | **12 tests, 307 lines** (≤500)                                                                                                                                                                                                                                                                                                                                                                                        |
| `packages/manifest/{manifest.json,llms.txt}`    | regenerated — **propCount 161→162**, eventCount 30 unchanged                                                                                                                                                                                                                                                                                                                                                          |
| `docs/vxe-grid-comparison.md`                   | iris 独有新行 + 构建状态 + counts 2320→2332                                                                                                                                                                                                                                                                                                                                                                           |
| `docs/vxe-grid/batch-br-adapt.md` (new)         | adapt report                                                                                                                                                                                                                                                                                                                                                                                                          |

### Implementation

- **Ledger**: ok = editRules-validated commit that landed (`onCommit` wrapper, cell + row modes); fail = commit rejected by editRules (`validate` wrapper `.then`).
- **Commit-intent marker** (`commitWithSummaryIntent` wraps all 5 commit entry points, consumed synchronously by the validate wrapper): typing/`startEdit` never count; async validators count exactly once; the marker can't leak (cleared on every validate + idle-commit guard).
- **Scope**: `hasEditRules` single throat — legacy `validate` columns, paste/fill/FNR/batch bypasses, Escape cancels excluded. Ref mirror (`validationSummaryRef`, editAutosaveRef precedent) keeps `[]`-dep memo closures fresh; re-enabling resets the ledger.
- **Display**: muted stamp `data-iris-validation-summary` (freshness-style `--iris-font-size-xs`/`--iris-muted` tokens), after perf trigger / before custom buttons, shown when on AND ≥1 outcome counted — the spec's「提交失败时」case shows `Passed 0 · Failed 1`.

### Verification — all ✅

- core test **1517/1517** · react typecheck **clean** · react test **2332/2332** (+12) · react lint **0 errors** (1 pre-existing complexity warning)
- spec `--mode all` **0 violations** (1415 files)
- `gen:manifest` → 162 props (check:manifest up-to-date) · `gen:docs-reference`/`check:docs-reference` up-to-date (gitignored) · prettier clean

### What is left

- Runner's pending review/gate stage (uncommitted `DECISIONS.md`/`batch-bv-gate.md`/`batch-br-baseline.md` are pre-existing pipeline state, untouched).
- vue/solid/svelte alignment deferred — react-only scope; zero core logic changes, purely additive bridge.
