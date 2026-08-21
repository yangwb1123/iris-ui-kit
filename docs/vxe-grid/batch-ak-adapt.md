Batch AK complete and committed (`e78974e3`), working tree clean.

## Report

**Files changed (4 source/docs + 2 tests + 2 batch docs):**

| File                                                    | Change                                                                                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/edit-rules.ts`                       | `EditRule.unique?: boolean` + new named `EditRuleContext<Row> { rows, columnKey }` + optional 5th `context` param on `validateEditRules`/`validateEditRulesAsync` (backward-compatible) |
| `packages/core/src/index.ts`                            | barrel exports `type EditRuleContext`                                                                                                                                                   |
| `packages/react/src/primitives/table/Table.tsx`         | `pasteIntoRange` multi-cell rectangle-fill branch + unique context threaded into both edit-mode validate bridges                                                                        |
| `docs/vxe-grid-comparison.md`                           | iris 独有 section +2 rows, build-status header + 批 AK row, test counts                                                                                                                 |
| `packages/core/src/edit-rules.test.ts`                  | +8 unique tests (157 lines)                                                                                                                                                             |
| `packages/react/src/primitives/table/clip-fnr.test.tsx` | +4 rectangle-paste tests (391 lines)                                                                                                                                                    |
| `docs/vxe-grid/batch-ak-adapt.md`                       | adapt report (new)                                                                                                                                                                      |

**1. Unique rule** — String compare across context rows' same column inside the existing `!isEmpty` gate; empty values exempt on both sides; editing row skipped by reference identity (changing back to your own value doesn't false-positive); failure = `rule.message` ?? `'Value must be unique'` (English, matching the other 5 defaults); missing context/rows/columnKey → documented no-op pass. React cell+row edit bridges pass `{ rows: externalDataRef.current ?? [], columnKey }` (4th arg `false` explicit). Vue/Solid/Svelte wiring was completed in the follow-up below.

**2. Range paste** — multi-cell selection fills exactly the selected rectangle from its top-left (smaller clipboard → top-left fill, rest unchanged; larger → clipped to rectangle + table bounds); single-cell keeps batch-O streaming (existing tests untouched); one byKey patch map + one `commitRowList`, values stay strings.

**Verification (all green):**

- core test: **1308 passed** (+8)
- react typecheck: clean · react test: **1896 passed** (+4) · react lint: **0 errors** (1 pre-existing complexity warning)
- vue/solid/svelte typecheck: clean (3-arg calls still valid)
- spec script: **0 violations**
- `gen:manifest` rerun: 155×4 / 86 tokens, **no diff** (additive surface invisible to the scanner; hygiene kept: single-line `unique?: boolean`, named `EditRuleContext`)

**Left (at the time of this report):** unique wiring for Vue/Solid/Svelte adapters; pre-existing `dataIndex ?? key` vs `col.key` paste write inconsistency (documented, untouched per additive-only); out-of-table pointer-drag selection has no UI-constructible test (keyboard extension already clamps).

## Follow-up: unique wiring across all adapters (2026-08-19)

The remaining adapter gap is now closed. Vue, Solid, and Svelte pass the current live row collection plus `columnKey` to `validateEditRulesAsync` in their cell/row edit bridges, matching React's core context contract. New adapter regression tests cover duplicate rejection, `aria-invalid`/error feedback, and a subsequent unique commit:

- `packages/vue/src/primitives/table/unique.test.ts`
- `packages/solid/src/primitives/table/unique.test.tsx`
- `packages/svelte/src/primitives/table/unique.test.ts`

Affected table suites and each adapter's typecheck/lint pass. The historical “Left” list above remains unchanged as a record of the original AK stage; no feature gap remains for `editRules.unique`.
