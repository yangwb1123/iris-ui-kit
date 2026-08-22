# batch DU — 批注导出 Review: **PASS** ✅

Verdict written to `docs/vxe-grid/batch-du-review.md`. No source files touched (only docs infra + the verdict deliverable).

## Verification results (all green)

| Gate                       | Result                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| core test                  | ✅ 104 files / **1597/1597**                                        |
| react typecheck            | ✅ clean                                                            |
| react test                 | ✅ 247 files / **2837/2837** (incl. batch-du 11/11)                 |
| react lint                 | ✅ 0 errors (2 pre-existing complexity warnings, not at DU anchors) |
| pnpm audit                 | ✅ 0 vulnerabilities                                                |
| iris-ui-spec.py --mode all | ✅ 0 violations in 1535 files                                       |
| check:manifest             | ✅ up to date, byte-identical                                       |

## Findings (all info, non-blocking — no FAIL items)

1. **info** — `batch-du-baseline.md`: quoted "propCount 162→163" is stale; actual manifest shows react contract 199→200 (delta +1 correct).
2. **info** — `Table.tsx:3712/3733`: prop-off vs on-but-no-notes both return `''` — spec-literal per 无批注返回空, consistent with fail-closed export family.
3. **info** — `Table.tsx:3722`: export invokes `cellNote` per display cell (same path as render; assumes pure callback).
4. **info** — `Table.tsx:3720`: keyless tables export index-based rowKeys (matches render/annotations contract).
5. **info** — Cross-page semantics: current `bodyData` only, same scope as other view exports.

## Adversarial checks on the core claims

- **Spec**: `exportAnnotationsCsv()` emits spec-literal `rowKey,column,annotation`, bodyData order, same `cellNoteState` resolution as render (`:3722` vs render `:6227`), hidden columns excluded via `viewColumnsRef` (verified: derives from `displayColumns` minus `columnVisibility=false`/`visibleMethod`), core `toCsv` (RFC-4180 + OWASP neutralization, verified in `packages/core/src/table-export.ts`).
- **Additive only**: Table.tsx +46/−0, query.ts +1, handle.ts +1 (named `IrisTableHandle`), test 243 lines ≤ 500 — the DU diff touches only 3 source files + test + regenerated manifest + docs.
- **Manifest hygiene**: `gen:manifest` committed, `check:manifest` byte-identical, prop registered in both manifest sections, scanner-safe single-line boolean prop.
- **Core framework-free**: zero core/tokens/theme changes; only consumes already-imported core `toCsv`.
- **CSS tokens**: no CSS changes; spec audit 0 violations.

Proceed to the gate stage.
