Done. All gates pass on the committed state.

## Report — 批 CT：表格标签页（iris 独有）

**Commit**: `4dbdb9bc feat(table): grid 批 CT——表格标签页（iris 独有）` (working tree clean except pre-existing `batch-cs-gate.md` prior-stage dirt)

### Files changed (4 source + 1 test + manifest + docs)

| File                                                                                          | Change                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`                                                | new **named exported** `IrisTableTab` (`{ key, label, views?: string[] }`) next to the views types                                                                                                                           |
| `packages/react/src/primitives/table/props.ts`                                                | `tableTabs?: import('./types').IrisTableTab[]` after `onActiveViewChange` (propCount 179→180, single-line member)                                                                                                            |
| `packages/react/src/primitives/table/Table.tsx`                                               | destructure · `tabs` dedupe memo + `activeTabKey` state + `applyTab` (routes names through the **same `selectView`**) · `role=tablist` strip above the toolbar gate · toolbar top-radius fail-closed conditional · print CSS |
| `packages/react/src/primitives/table/index.ts`                                                | barrel exports `IrisTableTab`                                                                                                                                                                                                |
| `packages/react/src/primitives/table/table-tabs.test.tsx`                                     | **NEW — 10 tests, 325 lines** (≤500 ✓)                                                                                                                                                                                       |
| `packages/manifest/{manifest.json,llms.txt}`                                                  | regenerated (**180** props, events **31** unchanged, 155×4, 86 tokens)                                                                                                                                                       |
| `docs/vxe-grid-comparison.md` + `docs/vxe-grid/batch-ct-{baseline,adapt}.md` + `DECISIONS.md` | 批 CT row, build tail (`react 2594→2604`), stage bookkeeping                                                                                                                                                                 |

### Implementation

Spec-literal: clicking a tab applies each name in `views` **in order** through the existing `selectView` path — unknown names fail-inert, later views win on overlapping pieces, toolbar select mirrors the last applied view (tested via `onActiveViewChange`). Strip is independent of the toolbar gate (`toolbar:'hidden'` keeps tabs), nothing active until first click, dup keys keep first, radius transfers to the strip fail-closed (no-tabs path byte-identical, pinned by test). Zero new i18n keys (labels are data), zero core/events/other-framework changes, token-only CSS.

### Tests added (10)

render/position + nothing-active · fail-closed zero-DOM (bare + `[]`) + radius pin · single-view apply + select mirror · multi-view order (later wins) · unknown-name inert · empty-views tab · no-`views` inert · active switching · duplicate-key drop · radius + `toolbar:'hidden'` combo

### Verification (all ✅)

- `@iris-ui-kit/core test`: **1559/1559** (untouched, framework-free)
- `@iris-ui-kit/react typecheck`: clean · test: **2604/2604** (2594+10)
- `@iris-ui-kit/react lint`: **0 errors** (1 pre-existing complexity warning)
- spec script: **0 violations** (1416 files)
- `gen:manifest` regenerated + committed; `check:manifest` up to date

### What is left

- Review stage (`batch-ct-review.md`) then full-repo gate stage per the batch pipeline.
- Pre-existing: 3 heavy virtual-scroll tests flaky under full parallel load (pass in isolation); arch-check ratchet staleness noted in prior batches.
