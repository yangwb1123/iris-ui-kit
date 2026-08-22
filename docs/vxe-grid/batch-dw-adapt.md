Done. Batch DW (表格事件总线, iris 独有) is complete and committed as `52a5c35b`.

## Report

**Files changed (6 source/test + 2 generated):**

- `packages/react/src/primitives/table/props/layout.ts` — `onTableEvent?: (event: { type: string; detail: unknown }) => void` (spec-literal, above `onCellClick`)
- `packages/react/src/primitives/table/types/event.ts` (NEW) — public `IrisTableEvent<Row>` closed union: 14 types (`cell-click`/`cell-dblclick`/`row-click`/`row-dblclick`/`sort-change`/`multi-sort-change`/`filter-change`/`filter-value-change`/`edit-start`/`edit-commit`/`edit-cancel`/`expand-change`/`tree-expand-change`/`expanded-rows-change`)
- `packages/react/src/primitives/table/types/index.ts` + `index.ts` — type export wiring
- `packages/react/src/primitives/table/Table.tsx` — one typed `emitTableEvent(type, detail)` funnel over an `onTableEventRef` mirror (established `:1866` pattern), emitted **after** each dedicated callback at 19 sites across the 14 families (the funnel is typed against the closed `IrisTableEvent` union — a typo'd event type fails typecheck)
- `packages/react/src/primitives/table/batch-dw.test.tsx` (NEW) — **17 tests / 475 lines** (≤500 ✓)
- `packages/manifest/{manifest.json,llms.txt}` — regenerated + committed (ALWAYS)

**Tests added:** one trigger per event family (cell/row click+dblclick incl. bubbled row events, sort cycle + multiSort, filter panel confirm + `tableRef.clearFilter()`, dblclick-edit start/commit/Escape-cancel, detail/tree/rowExpandable toggles), detail-fidelity (reference-identical `row`/`column`, `onCellClick` payload `===` bus detail), gate-parity (no `onCellClick` → no cell-click event), zero-noise, and prop-omitted regression.

**Counts:** manifest propCount **201→202**, eventCount **32→33**, `IrisTableEvent` added to react publicTypes.

**Verification (all green):**

- core test: 106 files / 1641 tests ✓
- react typecheck ✓; react test: 250 files / 2870 tests ✓
- react lint: **0 errors** (2 pre-existing complexity warnings in Table.tsx)
- `iris-ui-spec.py --mode all --json`: 0 violations ✓
- Bonus: `check:manifest` up-to-date, manifest tests 69 ✓, `pnpm size` within budget, my file prettier-clean

**Design notes:** bridge-not-behavior — the bus fires after each dedicated callback so gate parity holds by construction; controllable proxy `sort` updates fire no bus event (documented in the prop JSDoc). The expansion family mirrors the shared `onExpandedRowsChange` channel: every model commit — user toggles, `expandAll` seeding, `persistState`/view `expandedKeys` restores — fires `expanded-rows-change` (gate: restore still needs `onExpandedRowsChange` + an expandable table). Pinned by two mount-path tests in the suite.

**Gate-stage review follow-up (review verdict FAIL → fixed):** contract text corrected in `props/layout.ts` + `types/event.ts` (expansion family DOES fire — was documented as silent); `IrisTableEvent` funnel typing (`Extract<IrisTableEvent<Row>, { type: K }>['detail']`); +2 pinning tests (expandAll seed, persistState restore).

**What is left:** nothing within scope — core untouched (React-only, additive), no dist/tgz edits, test file ≤500 lines, ≤4 changed files + tests + manifest. The 2 lint warnings and 4 doc format warnings in the working tree are pre-existing (not from this batch) and were left untouched; the other dirty files (`docs/*`, `core/src/index.ts`, plugin exports) belong to the ongoing grid-refactor work and were not committed.
