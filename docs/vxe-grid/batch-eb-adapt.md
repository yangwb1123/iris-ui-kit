All gates verified on the committed state.

## Report

**Implemented: batch EB — 列访问统计 (`columnStats`, iris 独有)** — committed as `705fd67a feat(table): grid 批 EB——列访问统计（iris 独有）`.

### Files changed (11, incl. manifest + baseline doc)

| File                                                                                 | Change                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props/editing.ts`                               | `columnStats?: boolean` (single-line prop, after `patternFill`)                                                                                                                                                                                                                                                                                       |
| `packages/react/src/primitives/table/Table.tsx`                                      | state + `bumpColumnStats` (functional setState, sole writer) + `columnStatsEnabledRef` gate + ref-mirrored snapshot; click bite at top of `handleCellClick` + 2 narrow onClick branches (5 paths total, every click counts once); edit bites in `beginEdit` + `createRowSession`; `handle.getColumnStats()`; toolbar `▦` trigger + gate; panel render |
| `packages/react/src/primitives/table/ColumnStatsPanel.tsx` (new)                     | floating top-5 panel (`COLUMN_STATS_TOP=5`, `data-iris-column-stats-panel/row/rank/empty`), passive props, three-way close, AuditPanel mold                                                                                                                                                                                                           |
| `packages/react/src/primitives/table/types/handle.ts`                                | `getColumnStats(): ReadonlyArray<IrisTableColumnStat>` (single-line fn prop) + exported `IrisTableColumnStat`                                                                                                                                                                                                                                         |
| `packages/react/src/primitives/table/index.ts`                                       | export `IrisTableColumnStat` (scanner hygiene: export new types)                                                                                                                                                                                                                                                                                      |
| `packages/core/src/i18n-messages.ts` + `packages/plugin-locale-zh/src/core/index.ts` | +4 keys en/zh (`table.columnStats{,.clicks,.edits,.empty}`)                                                                                                                                                                                                                                                                                           |
| `packages/manifest/{manifest.json,llms.txt}`                                         | regenerated — IrisTable **205 → 206 props**, events 33 unchanged                                                                                                                                                                                                                                                                                      |
| `docs/vxe-grid/batch-eb-baseline.md`                                                 | baseline doc                                                                                                                                                                                                                                                                                                                                          |

### Tests added

`packages/react/src/primitives/table/test/batch-eb.test.tsx` — **499 lines**, **21 tests** (13 counting + 8 panel): plain/rowMode/cellRange/click-trigger 双计/dblclick/F2/row fan-out lock skip/Escape 仍计/off fail-closed/snapshot copy/paste-fill 不计/header 不计/tiebreak + trigger gate/top-5 truncation/row content/empty/three-way close/live refresh (F2 while open)/zh/tiebreak.

### Verification (all pass)

- `core test` — 1641/1641 ✓ (also `manifest test` 69/69)
- `react typecheck` ✓ · `react test` — 255 files, 2968/2968 (incl. 21 new) ✓
- `react lint` — **0 errors** (2 pre-existing complexity warnings, identical on base HEAD) ✓
- `iris-ui-spec.py --mode all --json` — **0 violations** ✓
- `gen:manifest` regenerated + committed ✓

### Design points / fiats honored

Session-local internal counting (no core controller, no persistence, no clear channel); every click counts exactly once (throat + 2 narrow branches); edits counted at OPEN (Escape still counts); paste/fill & header clicks never count; leaf-column keys; total desc + key asc tiebreak; off = zero cost (`getColumnStats` → `[]`, no bumps/re-renders); panel is zero-subscription passive (table re-render = live refresh); all styles `var(--iris-*)` only.

### What's left

Nothing for this batch: full repo `turbo run test typecheck lint build` gate + `batch-eb-gate.md`/review docs are the pipeline's post-commit stage (per repo workflow, gate stage reads a review verdict). `origin/main` divergence note: branch has 17 local commits (this + prior batches) vs 1 remote — pre-existing situation, not caused here.
