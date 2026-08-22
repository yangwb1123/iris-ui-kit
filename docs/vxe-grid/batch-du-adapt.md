Done. **Batch DU（批注导出）complete and committed.**

## Files changed (4 source/test files + manifest + docs)

| File                                                         | Change                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props/query.ts`         | +1 prop `exportAnnotations?: boolean` (single-line boolean — scanner-safe)                                                                                                                                                    |
| `packages/react/src/primitives/table/types/handle.ts`        | +1 method `exportAnnotationsCsv: () => string` on named `IrisTableHandle` (no new types)                                                                                                                                      |
| `packages/react/src/primitives/table/Table.tsx`              | +45 lines, 3 points, zero new imports: prop destructure · ref mirrors (`exportAnnotationsRef`/`annotationsRef`/`cellNoteRef`, auditEnabledRef precedent) · implementation via already-imported `cellNoteState` + core `toCsv` |
| `packages/react/src/primitives/table/test/batch-du.test.tsx` | new, **243 lines** (≤500 ✓), 11 tests                                                                                                                                                                                         |
| `packages/manifest/{manifest.json,llms.txt}`                 | regenerated (propCount →200, committed)                                                                                                                                                                                       |
| `docs/vxe-grid/batch-du-{baseline,adapt}.md`, `DECISIONS.md` | batch docs                                                                                                                                                                                                                    |

Zero core changes (framework-free preserved), zero CSS, additive only.

## Implementation

- Notes resolved through the **same `cellNoteState` path as the render** (dynamic `cellNote` wins over static `annotations` map); hidden columns excluded via `viewColumnsRef`; row order = bodyData; RFC-4180 quoting + OWASP neutralization via core `toCsv`; literal `rowKey,column,annotation` headers (no i18n).
- Fail-closed: prop off → `''`; on-but-no-notes → `''` (spec: 无批注返回空).

## Verification

- `@iris-ui-kit/core test`: ✅ 104 files / **1597/1597**
- `@iris-ui-kit/react typecheck`: ✅ clean
- `@iris-ui-kit/react test`: ✅ 247 files / **2837/2837** (incl. 11 DU)
- `@iris-ui-kit/react lint`: ✅ **0 errors** (2 pre-existing complexity warnings)
- `iris-ui-spec.py --mode all --json`: ✅ **0 violations**
- `gen:manifest` + `check:manifest`: ✅ regenerated, up-to-date, **committed** (`8cce5887`, `3b766d11`)

## What is left

Nothing source-side. Baseline's 4 non-blocking observations remain documented (off/empty indistinguishable, dynamic-note scope, literal headers, cross-page proxy semantics). Only pre-existing untracked `docs/GRID-PLUGIN-REFACTOR.md` left uncommitted (untouched, per baseline).
