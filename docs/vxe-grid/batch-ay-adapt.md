# Batch AY (grid data mask) — adapt report

Done. Batch AY (grid data mask) implemented, verified.

## Report

**Files changed** (4 modified + 4 new + 1 generated-config + docs, one commit):

- Modified: `packages/core/src/index.ts` (barrel export of `maskValue`/`MaskKind`), `packages/react/src/primitives/table/types.ts` (single-line `mask`/`exportRaw` props on `IrisTableColumn` — manifest-scanner hygiene), `packages/react/src/primitives/table/Table.tsx` (mask-first display chain + tooltip + `buildRangeTsv` copy path), `packages/react/src/primitives/table/exportCsv.ts` (`applyCellMask` + masked-by-default serializer via the batch-AO shadow-row pattern)
- New: `packages/core/src/mask.ts` (`maskValue` + `MaskKind`, sensitive precedence email → 11-digit phone → generic ≥6 → short → `''` for null), `packages/core/src/mask.test.ts` (7 tests), `packages/react/src/primitives/table/mask.test.tsx` (11 tests), `apps/docs/guide/table-data-mask.md` (iris 独有 guide page + example snippet)
- Config/docs: `apps/docs/.vitepress/config.ts` (nav entry), `docs/vxe-grid/DECISIONS.md` (entry)

**Tests added / counts:**

| Check                               | Result                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| core test                           | 92 files, **1424 passed** (was 1417, +7)                                                       |
| react typecheck                     | clean                                                                                          |
| react test                          | 183 files, **2065 passed** (+11 from this batch)                                               |
| react lint                          | **0 errors** (1 pre-existing `IrisTable` complexity warning — verified pre-existing via stash) |
| `iris-ui-spec.py --mode all --json` | **0 violations**                                                                               |
| `gen:manifest`                      | up to date, committed (below)                                                                  |

React mask tests cover: display masked (`'sensitive'`), custom mask function,
formatter receives the MASKED string (mask-first), tooltip masked, edit shows
RAW value, `exportCsv` masked by default, `exportRaw` exports raw,
`exportCurrentViewCsv` masked, `exportSelectionCsv` masked (with a raw column),
dataIndex-resolved masking + non-string coercion, clipConfig TSV copy masked
unless `exportRaw`.

**Design (per baseline):** core `maskValue(value, 'sensitive')` in new `mask.ts`
(email local-part masked + domain kept → `/^\d{11}$/` phone 3+4+4 → generic ≥6
first2+`****`+last2 → short `'****'` → null `''`); `IrisTableColumn.mask`
applied FIRST in the display chain (all display branches + tooltip see the
masked value; a `formatter` receives the masked string — documented), editing
entry points start from `getCellValue` so they stay RAW (zero code change,
documented only); export masks by default at the single `exportCsv` choke point
(covers `exportCurrentViewCsv` + `exportSelectionCsv` with zero handle changes),
`exportRaw` opts a column out; the clipConfig TSV builder applies the same rule.

**Flagged decisions (gate arbitration):**

- **F1 (null → `''`)**: `maskValue` renders null/undefined/empty as `''`,
  matching core `toCsv`'s empty-cell parity — masked exports never invent
  filler text for empty cells.
- **F10 (`exportExcel` one-line mirror)**: `exportExcel` is NOT masked this
  batch — the task contract scopes export masking to the CSV trio +
  clipConfig TSV. `exportExcel` remains a raw-value serializer; extending it
  later is a one-line mirror of the `exportCsv` shadow-row loop.
- Conditional styles (`when(row, value)`) keep receiving the RAW value — batch
  AX contract unchanged.
- Sorting / filtering / grouping / summary / range stats / suggest keep reading
  the RAW value (display-only mask, matching `formatter`'s documented scope).

**What is left:** the pipeline's gate stage — full repo `turbo run test typecheck
lint build` plus the 27-package checks, browser E2E/visual regression, `pnpm
bench`, and `gen:docs-reference` (`components.md` regenerated — this batch adds
no components, so no change expected), per the batch pipeline (not part of this
task).
