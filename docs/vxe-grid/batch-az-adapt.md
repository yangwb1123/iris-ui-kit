Batch AZ complete and committed (`cd098a08`, working tree clean).

## Report

**Files changed** (4 hand-written + 1 test + 3 generated/bookkeeping):

| File                                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`             | `annotations?: Record<string, string>` + `cellNote?: (row: Row, column: IrisTableColumn<Row>) => string \| null` — both **single-line** declarations (manifest-scanner hygiene)                                                                                                                                                                                                                                                                                                             |
| `packages/react/src/primitives/table/Table.tsx`            | Module-level `cellNoteOf` (dynamic wins, `annotations[cellId(k, col.key)]` fallback) + `cellNoteState` + `renderCellNoteBadge` (keeps the cell arrow **at pre-existing complexity** — verified 1 warning, same as HEAD); cell gets `data-iris-cell-note` attr, `...noteInfo.posStyle` (`position: relative` only when noted — pinned sticky cells override it, badge still anchors to the sticky box, documented), title chain `editing → note → compare → tooltip`, badge span at cell end |
| `packages/react/src/primitives/table/styles.ts`            | `CELL_NOTE_STYLE` — 6px, absolute top-right (`inset-inline-end` logical, RTL-safe), `var(--iris-warning, var(--iris-primary))` (existing token-with-fallback pattern)                                                                                                                                                                                                                                                                                                                       |
| `docs/vxe-grid-comparison.md`                              | iris 独有 table row (单元格标注 `annotations`/`cellNote`, 8 test mention, propCount 140→142) + 用法示例 snippet                                                                                                                                                                                                                                                                                                                                                                             |
| `packages/react/src/primitives/table/annotations.test.tsx` | **NEW** — 8 tests, ~170 lines                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Tests added** (all 5 mandated + 3): static note badge+attr+title · `::` key delimiter · dynamic cellNote receives (row, col) · dynamic wins over static · no note → no badge/attr/title · note title beats `tooltipConfig` (un-noted cells keep tooltip) · editing exempt from note title but badge/attr stay · badge token-only colors.

**Counts:**

- `typecheck` — clean
- `test` — **2078 passed** (184 files, +8 this batch)
- `lint` — **0 errors** (1 pre-existing `IrisTable` complexity warning, verified pre-existing via stash)
- `iris-ui-spec.py --mode all --json` — **0 violations**, exit 0
- `gen:manifest` — regenerated & committed; `check:manifest` up-to-date; `check:docs-reference` up-to-date (generated files are gitignored build artifacts); manifest captures both props single-line, react propCount **141 → 143** (both TABLE-level, per baseline)
- Commit: `cd098a08` — 9 files, +331/−8

**What is left:** the pipeline gate stage (full-repo `turbo run test typecheck lint build`, 27-package pack-install checks, browser E2E/visual regression, `pnpm bench`) — outside this task's scope, per the baseline. Pinned-cell badge interaction documented (sticky overrides relative; badge positions against the sticky cell box).
