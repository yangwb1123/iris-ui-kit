## Report — 批 CS：行展开滚动保持（iris 独有）

**Committed**: `feat(table): grid 批 CS——行展开滚动保持（iris 独有）`

### Files changed (4 source + manifest + docs)

| File                                                                       | Change                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                             | `expandScrollPreserve?: boolean` after `columnTotals` (propCount 178→179; JSDoc first line dropped by the manifest generator, second line opens cleanly — batch-CM P4 precedent)                                                                                                                              |
| `packages/react/src/primitives/table/Table.tsx`                            | 6 touch points: destructure · derive + 3 refs (`virtualScrollTopRef`/`preserveAnchorRef`/`prevExpandedKeysRef`) · 2 module helpers (`virtualItemKeyOf` + `singleKeyDiff`, `BodyPlanEntry` hoisted to module scope) · render-phase anchor record · `onScroll` wiring (was unused) · 1 transition layout effect |
| `packages/react/src/primitives/table/expand-scroll-preserve.test.tsx`      | **NEW — 12 tests, 330 lines** (≤500 ✓)                                                                                                                                                                                                                                                                        |
| `packages/manifest/{manifest.json,llms.txt}`                               | regenerated via `gen:manifest` (propCount **179**, eventCount **31** unchanged, 155×4, 86 tokens)                                                                                                                                                                                                             |
| `docs/vxe-grid-comparison.md`                                              | 批 CS row in 「iris 独有」section (line 66) + 构建状态 tail (`react 2582→2594`)                                                                                                                                                                                                                               |
| `docs/vxe-grid/{batch-cs-baseline.md, batch-cs-adapt.md}` + `DECISIONS.md` | stage bookkeeping (baseline was pre-written by the spec stage; DECISIONS baseline entry committed with the batch)                                                                                                                                                                                             |

### Implementation (spec-literal)

`expandScrollPreserve?: boolean` — virtual mode records the viewport scrollTop + content anchor (first visible plan entry + its partial offset) and, on the expansion transition, re-locates the anchor key in the **NEW plan** and writes `newIndex × slotHeight + relativeTop` — exact index math, zero delta bookkeeping. The gap the spec targets: pixel scrollTop ALREADY survives the virtualizer rebuild (IrisVirtualScroll local state), but a node/detail panel expanded ABOVE the viewport shifts every row below by the inserted height — the rows being read jump.

- **Anchor recording, two sites**: the transition render skips the re-record (the pre-toggle anchor must survive); the render-time pass covers mount + plan changes without a scroll event, and the `onScroll` wiring (IrisVirtualScroll's previously-unused prop) covers scrolls — the Table never re-renders on scroll (scrollTop lives in the child), so the onScroll handler re-records with a fresh scrollTop + the stable plan from the closure.
- **Transition detection**: `prevExpandedKeysRef` (advanced by the layout effect) vs current — the layout effect only acts on a **single-key symmetric diff** (`singleKeyDiff`); full-set restores (`expandAll` / `persistState` replay) fall back to the virtualizer's re-clamp (documented fiat).
- **Anchor identity**: `virtualItemKeyOf` — the JSX `keyOf` was inlined; it is now a module helper (single source of truth, both sites), with `BodyPlanEntry` hoisted to module scope (type-only refactor, zero behavior change).
- **Ordering**: child layout effects run before parent — the transition effect runs AFTER IrisVirtualScroll's re-clamp, so the DOM viewport already reflects the new plan's clamp bound. Anchor-slot-removed (a collapsed detail panel) → `findIndex` -1 → skip the write (pixel preserve stays).
- **Clamp bound**: plan total (`virtualItems.length × slotHeight`) — a real browser clamps the scrollTop setter to its own range (total − viewport) anyway; jsdom reports `scrollHeight`/`clientHeight` 0 (debug-verified), so the plan total is the only portable bound and it is exact for the uniform-slot virtual body.
- **Five documented fiats**: variable heights pixel-only (offset tree is child-internal), non-virtual inert, full-set restores → clamp, single-key commits exact, lazy-load toggle happens post-fill.

### Verification (all ✅)

- `@iris-ui-kit/core test`: **1559/1559** (core untouched; framework-free grep 0)
- `@iris-ui-kit/react typecheck`: clean
- `@iris-ui-kit/react test`: **2594/2594** (2582 + 12 new)
- `@iris-ui-kit/react lint`: **0 errors** (1 pre-existing IrisTable complexity warning, unchanged)
- spec script: **0 violations** (1416 files)
- `check:manifest`: up to date (179 props / 31 events)

### What is left

- Review stage (`batch-cs-review.md`) then gate stage, per the batch pipeline.
- Note: 3 heavy virtual-scroll tests (Cascader/CommandPalette/Tree) are flaky under full parallel load (pre-existing, pass in isolation) — unrelated to this change.
