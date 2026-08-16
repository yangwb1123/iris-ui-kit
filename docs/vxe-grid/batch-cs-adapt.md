All gates pass on the committed state. Final summary:

## Report — 批 CS：行展开滚动保持（iris 独有）

**Commit**: `f7d38344 feat(table): grid 批 CS——行展开滚动保持（iris 独有）` (working tree clean)

### Files changed (4 source/test + manifest + docs)

| File                                                                       | Change                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                             | `expandScrollPreserve?: boolean` after `columnTotals` (propCount 178→179; JSDoc first line dropped by manifest generator, second line opens cleanly)                                                                                                                                                 |
| `packages/react/src/primitives/table/Table.tsx`                            | destructure · derive + 3 refs (`virtualScrollTopRef`/`preserveAnchorRef`/`prevExpandedKeysRef`) · 2 module helpers (`virtualItemKeyOf` + `singleKeyDiff`; `BodyPlanEntry` hoisted to module scope) · render-phase anchor record · `onScroll` wiring (previously unused) · 1 transition layout effect |
| `packages/react/src/primitives/table/expand-scroll-preserve.test.tsx`      | **NEW — 12 tests, 364 lines** (≤500 ✓)                                                                                                                                                                                                                                                               |
| `packages/manifest/{manifest.json,llms.txt}`                               | regenerated (propCount **179**, eventCount **31** unchanged, 155×4, 86 tokens)                                                                                                                                                                                                                       |
| `docs/vxe-grid-comparison.md`                                              | 批 CS row + 构建状态 tail (`react 2582→2594`)                                                                                                                                                                                                                                                        |
| `docs/vxe-grid/{batch-cs-baseline.md, batch-cs-adapt.md}` + `DECISIONS.md` | stage bookkeeping                                                                                                                                                                                                                                                                                    |

### Implementation

Spec-literal: pixel scrollTop already survives the virtualizer rebuild (IrisVirtualScroll local state); the real gap is the **content anchor** — expanding a node/detail panel above the viewport shifts rows below by the inserted height. On a single-key expansion commit (detected via `singleKeyDiff` over `prevExpandedKeysRef` vs current), the anchor key is re-located in the NEW plan and `viewport.scrollTop = newIndex × slotHeight + relativeTop` is written — exact index math, zero delta bookkeeping. Anchor recorded at two sites (stable render + the wired `onScroll` — the Table never re-renders on scroll). Transition layout effect runs after the child's re-clamp (React bottom-up ordering). Clamp bound = plan total (browser clamps the setter itself; jsdom reports scrollHeight/clientHeight 0 — debug-verified). Five documented fiats: variable heights pixel-only, non-virtual inert, full-set restores → re-clamp, single-key exact, lazy-load post-fill. Zero core/i18n/types/events/other-framework changes.

### Tests added (12)

fail-closed pin · tree expand above (+C×36) / below (zero) / collapse above (−C×36) · detail +36 · partial-anchor offset · collapse-past-max clamp · handle path (`toggleRowExpand`) · anchor-removed fallback · variable fiat · non-virtual + flat-table inert

### Verification (all ✅)

- `@iris-ui-kit/core test`: **1559/1559** (untouched; framework-free grep 0)
- `@iris-ui-kit/react typecheck`: clean · test: **2594/2594** (2582 + 12)
- `@iris-ui-kit/react lint`: **0 errors** (1 pre-existing complexity warning)
- spec script: **0 violations** (1416 files)
- `gen:manifest` regenerated + committed; `check:manifest` up to date

### What is left

- Review stage (`batch-cs-review.md`) then full-repo gate stage, per the batch pipeline.
- Pre-existing: 3 heavy virtual-scroll tests flaky under full parallel load (pass in isolation); arch-check ratchet staleness noted in prior batches.
