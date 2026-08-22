**Verdict: PASS** — written to `docs/vxe-grid/batch-ds-review.md`.

## Summary

The DS implementation (列宽提示) was confirmed already committed in HEAD `fedc213e` (DL–DT batch `61ec5418`); this review batch made zero source changes. All 5 check categories verified independently:

**✅ Spec correctness** — every baseline anchor re-verified line-by-line:

- `widthHint?: boolean` prop at `props/layout.ts:163` (single-line, named interface, cross-exported via `props.ts:5,84`)
- Default `false` at `Table.tsx:311` (opt-in); passthrough only on resizable non-boundary handles at `Table.tsx:8753`
- Lifecycle at `column-layout.tsx:56-65` (start shows clamped width → drag refreshes via existing `onResize` → end clears; `pointercancel` shares the `pointerup` circuit in `useDrag.ts`)
- Rendering `104-120`: `data-iris-width-hint`, `position:fixed` pointer-follow, `pointerEvents:none`, `aria-hidden`, `{hint.width}px`
- Test `batch-dl-dt.test.tsx:464-483` (show `116px` / hide), 492 lines ≤ 500

**✅ Additive only** — `git log -S widthHint` → all lines from `61ec5418`; hint node rendered only when `widthHint && hint`; working tree has zero src changes.

**✅ Manifest hygiene** — `check:manifest` up to date (155×4 contracts, 86 tokens), no diff.

**✅ Core framework-free** — grep for framework imports in `packages/core/src` empty; DS commit did not touch core.

**✅ CSS tokens** — every `var(--iris-*)` maps to a canonical token (`surface-floating`, `space-xxs/xs`, `radius-sm`, `z-popover`, `font-size-xs`…); `check:tokens` + `audit:tokens` clean.

**Gates re-run (all green):** core test 1597/1597 · react test 2826/2826 (246 files) · typecheck clean · lint 0 errors (2 pre-existing complexity warnings, not at DS anchors) · `pnpm audit` 0 vulnerabilities · `iris-ui-spec.py --mode all` 0 violations in 1535 files.

**2 non-blocking P3 findings:** (1) fixed `+8/-32` pointer offset can clip at viewport edges during extreme drags; (2) no negative tests for pointercancel/pinned-boundary coexistence/disabled. Both were already noted in the baseline's non-blocking observations.
