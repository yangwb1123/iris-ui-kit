Done. Working tree clean at `7f2ed0cb`.

## Report — 批 DQ：行拖拽跨表（iris 独有）

The spec was already fully implemented at HEAD (landed in the `61ec5418` adapter-alignment batch); this session verified every baseline anchor, then closed the two real gaps baseline flagged (observations ② and ③).

**Files changed (commit `7f2ed0cb`, 9 files / +201 −51):**

| File                                                            | Change                                                                                                                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props/editing.ts`          | `rowDragBetween` JSDoc single-lined — the scanner's `parsePropsBody` drops block comments whose first/last lines carry text with `*/`; single-line form makes both manifest records extract a description |
| `packages/react/src/primitives/table/index.ts`                  | Explicit barrel export of `type IrisTableRowDragBetweenTarget` (scanner `publicTypes` only reads `export type { … }` lists; `export *` chains don't count)                                                |
| `packages/react/src/primitives/table/test/batch-dl-dt.test.tsx` | +3 DQ cases (below); file 322 → 423 lines ≤500 ✓                                                                                                                                                          |
| `packages/manifest/manifest.json` + `llms.txt`                  | `gen:manifest` regen — both `rowDragBetween` records gain description, react `IrisTable` publicTypes gains the type; 155×4 / 86 tokens, zero count drift; `check:manifest` re-verified up to date         |
| `docs/vxe-grid/batch-dq-adapt.md` + `DECISIONS.md`              | Adapt report + batch record; pre-existing workspace evidence (DP gate, DQ baseline) committed together                                                                                                    |

**Tests added (+3, all in batch-dl-dt.test.tsx):** key-mismatch zone is ignored (neither `onDrop` nor `onReorder` fires) · matching zone fires `onDrop` exactly once with `rows[0]` and never `onReorder` (the组合 assertion) · `elementFromPoint` unavailable degrades gracefully to table-internal behavior with no callback leakage.

**Verification counts:**

- core test **1597/1597** (104 files) — core untouched, framework-free invariant held
- react typecheck **clean** · react test **2822/2822** (246 files; batch-dl-dt **17/17**)
- react lint **0 errors** (2 pre-existing Table.tsx complexity warnings, not DQ-introduced)
- `iris-ui-spec.py --mode all --json` → **0 violations**
- `gen:manifest` → regenerated + committed; `check:manifest` up to date

**What is left:** zone highlighting stays parent-owned by design (table is read-only; `data-iris-row-drag-active` is the parent CSS anchor — baseline observation ①, consciously not in the table). Real-mouse physical reorder coverage remains in the existing `row-drag-indicator` suite (jsdom rects are 0, so the two negative cases assert no-callback/no-crash rather than fabricating physics). Any future change to multi-zone matching priority must update `externalRowDropAt`'s first-match policy and this doc.
