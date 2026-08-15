Batch AY (grid data mask) implemented, verified, and committed as `4a5a79fb`.

## Report

**Files changed** (4 modified source + 2 new source + 2 test files + 5 docs/config, one commit):

| File                                                                                      | Change                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/mask.ts`                                                               | **NEW** — `maskValue(value, 'sensitive')` + `MaskKind`; precedence email (local masked, domain kept) → 11-digit phone (3+4+4) → generic ≥6 (first2+`****`+last2) → short `'****'` → null `''` |
| `packages/core/src/index.ts`                                                              | barrel export of `maskValue`/`MaskKind`                                                                                                                                                       |
| `packages/core/src/mask.test.ts`                                                          | **NEW test** — 7 tests (email/phone/generic/short/null/coercion/fail-open)                                                                                                                    |
| `packages/react/src/primitives/table/types.ts`                                            | single-line `mask?: 'sensitive' \| ((value: unknown) => string)` + `exportRaw?: boolean` on `IrisTableColumn` (manifest-scanner hygiene)                                                      |
| `packages/react/src/primitives/table/Table.tsx`                                           | mask-first display chain (`render`/`html`/`link`/`formatter`/raw fallback + tooltip all see masked; formatter receives masked string); `buildRangeTsv` copy path masks unless `exportRaw`     |
| `packages/react/src/primitives/table/exportCsv.ts`                                        | `applyCellMask` shared helper + masked-by-default serializer (batch-AO shadow-row pattern, no core serializer change)                                                                         |
| `packages/react/src/primitives/table/mask.test.tsx`                                       | **NEW test** — 11 tests (display, custom fn, formatter-sees-mask, tooltip, edit-raw, export default/`exportRaw`, both handle exports, dataIndex+coercion, clipConfig TSV)                     |
| `apps/docs/guide/table-data-mask.md` + `config.ts` + `DECISIONS.md` + `batch-ay-adapt.md` | iris 独有 guide + example snippet, nav entry, decisions (F1 null→`''`, F10 exportExcel out-of-scope mirror)                                                                                   |

**Tests added / counts:**

- core: **92 files / 1424 passed** (was 1417, **+7**)
- react: **183 files / 2065 passed** (was 2054 at HEAD, **+11**); typecheck clean; lint **0 errors** (1 pre-existing `IrisTable` complexity warning — verified pre-existing via stash)
- `iris-ui-spec.py --mode all --json`: **0 violations**
- `gen:manifest`: regenerated, **up to date** (155 components, no diff — `mask`/`exportRaw` are column-level, not manifest-tracked, per baseline); `check:manifest` + `gen:docs-reference` clean

**What is left:** the pipeline's gate stage — full-repo `turbo run test typecheck lint build`, 27-package checks, browser E2E/visual regression, `pnpm bench` (not part of this task).

Notes: editing reads RAW by construction (all three edit entry points start from `String(getCellValue(...))` — zero code change, documented); sorting/filtering/grouping/summary/range-stats/conditional-styles keep raw values (display-only mask, batch AX contract intact). One incident: a stale lint-staged WIP stash from an older feature got popped mid-work — resolved to HEAD's version (Form contract test present and passing) and dropped the orphan.
