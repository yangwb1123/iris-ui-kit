All gates pass on the working tree. Final summary:

## Report — 批 CT：表格标签页（iris 独有）

**Commit**: `feat(table): grid 批 CT——表格标签页（iris 独有）`

### Files changed (4 source + 1 test + manifest + docs)

| File                                                                       | Change                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`                             | new named export `IrisTableTab` (`{ key, label, views?: string[] }`) after the `IrisTableViewConfig` re-export (manifest type list gains `IrisTableTab`)                                                                                                                                                      |
| `packages/react/src/primitives/table/props.ts`                             | `tableTabs?: import('./types').IrisTableTab[]` after `onActiveViewChange` (propCount 179→180; JSDoc first line dropped by manifest generator, second line opens cleanly — CS precedent)                                                                                                                       |
| `packages/react/src/primitives/table/Table.tsx`                            | destructure · `tabs` dedupe memo (dup key keeps first) + `activeTabKey` state + `applyTab` callback (routes each view name through the SAME `tableViews.selectView`) · `role=tablist` strip render before the toolbar gate · toolbar top-radius conditional (fail-closed) · print media query hides the strip |
| `packages/react/src/primitives/table/index.ts`                             | barrel exports `IrisTableTab`                                                                                                                                                                                                                                                                                 |
| `packages/react/src/primitives/table/table-tabs.test.tsx`                  | **NEW — 10 tests, 284 lines** (≤500 ✓)                                                                                                                                                                                                                                                                        |
| `packages/manifest/{manifest.json,llms.txt}`                               | regenerated (propCount **180**, eventCount **31** unchanged, 155×4, 86 tokens)                                                                                                                                                                                                                                |
| `docs/vxe-grid-comparison.md`                                              | 批 CT row + 构建状态 tail (`react 2594→2604`)                                                                                                                                                                                                                                                                 |
| `docs/vxe-grid/{batch-ct-baseline.md, batch-ct-adapt.md}` + `DECISIONS.md` | stage bookkeeping (DECISIONS/baseline pre-existing prior-stage dirt carried forward)                                                                                                                                                                                                                          |

### Implementation

Spec-literal: `tableTabs?: IrisTableTab[]` — named-view tab switching. Clicking a tab applies each name in `views` **in order** through the **same `selectView` path** the toolbar select uses: unknown names skipped fail-inert (`selectView`'s built-in guard), later views win on overlapping pieces, and the toolbar select mirrors the last applied view (`onActiveViewChange` fires per select). The `role=tablist` strip (`data-iris-table-tabs`) renders ABOVE the toolbar, independent of the toolbar gate (`layouts.toolbar: 'hidden'` keeps the tabs; `views` is already in the toolbar gate so the select has a home). Active tab is internal state — nothing active until the first click. `tabs` memo dedupes duplicate keys (first wins) for both React key identity and the apply path. The toolbar's top card radius is taken over by the strip via a fail-closed conditional spread (`tabs.length > 0`), leaving the no-tabs path byte-identical (pinned by test). Print media query hides the strip (printable consistency). Zero new i18n keys (labels are data), zero core/types-events/other-framework changes, token-only CSS.

### Tests added (10)

render/position (above toolbar) + nothing-active · fail-closed zero-DOM (bare + empty array) + toolbar radius pin · single-view apply + select mirror + aria-selected · multi-view order (later wins) · unknown-name fail-inert · empty-views inert tab · no-`views` config inert · active switching · duplicate-key drop (render + apply) · radius coordination + `toolbar:'hidden'` combo.

### Verification (all ✅)

- `@iris-ui-kit/core test`: **1559/1559** (untouched; framework-free)
- `@iris-ui-kit/react typecheck`: clean · test: **2604/2604** (2594 + 10)
- `@iris-ui-kit/react lint`: **0 errors** (1 pre-existing complexity warning)
- spec script: **0 violations** (1416 files)
- `gen:manifest` regenerated + committed; `check:manifest` up to date

### What is left

- Review stage (`batch-ct-review.md`) then full-repo gate stage, per the batch pipeline.
- Pre-existing: 3 heavy virtual-scroll tests flaky under full parallel load (pass in isolation); arch-check ratchet staleness noted in prior batches.
