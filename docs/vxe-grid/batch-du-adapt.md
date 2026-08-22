# batch DU — 批注导出（iris 独有）Adapt

**Status**: ✅ Complete. Spec implemented, verified, committed at
`8cce5887` (`feat(table): grid 批 DU——批注导出（iris 独有）`).

## Spec

`exportAnnotations?: boolean` — batched boolean feature gate (auditLog
precedent, default off). `tableRef.current.exportAnnotationsCsv(): string` —
per-annotated-cell CSV with spec-literal 3 columns `rowKey,column,annotation`,
one line per noted body cell in bodyData order. Tests: content assertions
(exact bytes) + no-annotations → `''`.

## Files changed (4 source/test files + manifest + docs)

| File                                                         | Change                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props/query.ts`         | +1 prop `exportAnnotations?: boolean` (doc'd, single-line boolean — scanner-safe; sits in the annotation cluster after `onAnnotationsChange`)                                                                                                  |
| `packages/react/src/primitives/table/types/handle.ts`        | +1 method `exportAnnotationsCsv: () => string` on the named exported `IrisTableHandle` (no new types)                                                                                                                                          |
| `packages/react/src/primitives/table/Table.tsx`              | 3 points, +45 lines, zero new imports: destructure prop · ref mirrors (`exportAnnotationsRef` / `annotationsRef` / `cellNoteRef`, auditEnabledRef precedent) · handle implementation using the ALREADY-imported `cellNoteState` + core `toCsv` |
| `packages/react/src/primitives/table/test/batch-du.test.tsx` | new, **243 lines ≤ 500** ✓ — 11 tests                                                                                                                                                                                                          |
| `packages/manifest/{manifest.json,llms.txt}`                 | regenerated (propCount 199→200 for IrisTable; scanner picked up the boolean prop with description)                                                                                                                                             |
| `docs/vxe-grid/{batch-du-baseline.md,DECISIONS.md}`          | baseline + decision log                                                                                                                                                                                                                        |

No core changes (framework-free preserved — `grep -rE "from '(vue|react|solid|svelte)'" packages/core/src` untouched), no CSS touched.

## Implementation notes

- **Resolution parity**: the export resolves each cell's note through the SAME
  `cellNoteState` path as the cell render (`cellNoteState(annotationsRef,
cellNoteRef, row, col, k)` → dynamic `cellNote` wins over the static
  `annotations` map; keyless rows fall back to the row index via `rowKeyOf`).
- **Hidden columns** excluded via `viewColumnsRef` (leaf display columns —
  `columnVisibility: false` columns dropped, tested).
- **Serializer**: core `toCsv` with literal `rowKey`/`column`/`annotation`
  titles — RFC-4180 quoting (comma-containing note → `"注意,含逗号"`) +
  OWASP formula neutralization (`=SUM(A1)` → `'=SUM(A1)`, tested). Column
  titles are spec-literal English — zero new i18n.
- **Fail-closed family**: `exportAnnotations` off → `''`; on but no notes →
  `''` (spec-literal 无批注返回空). Both states indistinguishable (mirrors
  `exportSelectionCsv`; documented, baseline observation #1 accepted).
- Mount-time handle freshness: `annotationsRef`/`cellNoteRef` mirror props
  every render so export always sees post-rerender annotation state (tested
  with a rerender).

## Tests added (11)

1. Content — exact bytes `rowKey,column,annotation\n1,name,高亮\n2,city,"注意,含逗号"`
2. bodyData row order + multiple noted cells per row (column order)
3. Prop on, no notes → `''`
4. Fail-closed — no `exportAnnotations` prop → `''`
5. Dynamic `cellNote` wins over the static map
6. OWASP formula-leading note neutralized
7. Hidden columns excluded
8. Ref mirror — post-rerender annotations seen
9. Literal headers (no i18n)
10. Regression — other handle exports (`exportCurrentViewCsv`/`exportRowsCsv`)
    byte-identical with the prop on; badge rendering intact
11. Regression — inline cell edit of a noted cell still flows through
    `onCellEdit` (annotation map untouched)

## Verification results

| Gate                                            | Result                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `corepack pnpm --filter @iris-ui-kit/core test` | ✅ 104 files / **1597/1597**                                                                   |
| `--filter @iris-ui-kit/react typecheck`         | ✅ tsc --noEmit clean                                                                          |
| `--filter @iris-ui-kit/react test`              | ✅ 247 files / **2837/2837** (incl. 11 DU)                                                     |
| `--filter @iris-ui-kit/react lint`              | ✅ **0 errors** (2 pre-existing `complexity` warnings on the monolithic `IrisTable` render fn) |
| `iris-ui-spec.py --mode all --json`             | ✅ **0 violations**                                                                            |
| `pnpm gen:manifest` + `pnpm check:manifest`     | ✅ regenerated, up-to-date, committed                                                          |

Prettier: created files re-verified with `--write` (repo `format:check` clean).

## What is left

- Nothing source-side. Baseline's 4 non-blocking observations remain accepted:
  off/empty indistinguishable (documented), dynamic-note scope (export covers
  the current body only), literal headers (spec), cross-page proxy semantics
  (export covers the loaded page — bodyData mirror).
- Only the pre-existing unrelated untracked `docs/GRID-PLUGIN-REFACTOR.md`
  remains uncommitted (baseline: untouched).
