## Verdict: PASS — post-gate re-review

The historical medium finding below was fixed in the gate stage by deriving
the current width from the leading pinned prefix and adding the gapped-state
no-op regression. The full repository gate completed at 180/180 tasks. The
pre-fix record is retained for traceability.

### Historical pre-gate verdict: FAIL — resolved

### What was verified

- **Spec correctness** — every delivered mechanic present (8px grip + 2px `--iris-primary` line at boundary cell, translateX ghost, commit-on-release, Arrow ±1, per-column `setColumnPinned` through the single pin throat, controlled no-optimistic-flip, right-block clamp, resize-grip suppression, zero-i18n plain-English aria, 17 tests all covering the promised scenarios). **One violation found** (below).
- **Additive only** — `pinnedDrag = false` default; the single source "deletion" is the `resizableColumns` condition swap, gated to identity when off. New test file only.
- **Manifest hygiene** — `check:manifest` green; IrisTable react quality **182 props / 32 events**, exactly the baseline prediction.
- **Core framework-free** — zero core files touched; grep invariant empty.
- **CSS tokens** — `var(--iris-primary)`, no hardcoded hex, logical `insetInlineStart`, inline styles follow `ColumnResizeHandle` precedent.

### Gates (all run)

core test **1559/1559** · react test **2635/2635** · react typecheck clean · react lint **0 errors** (1 complexity warning, verified pre-existing at parent) · check:manifest ✓ · check:docs-reference ✓ · prettier ✓ · security audit no vulns · audit-tokens/arch-check warnings verified pre-existing (re-checked at parent commit).

### Finding 1 (FAIL driver, MEDIUM)

`Table.tsx:3572` `resolvePinnedCount` sums **all** left-pinned widths, while `commitPinnedCount` (`:3584`) treats "current" as the leading **prefix** count (`leftPinnedCount`). In a reachable gapped state `[A(left), B(null), C(left)]` (pin menu can create this), the handle sits on C; a zero-dx click resolves count 2 vs current 1 → **pins B, unpins C, fires `onColumnPinnedChange` ×2 + `onPinnedCountChange(2)`** — violating the spec's "no-op drags fire nothing". Fix: derive `currentWidth` from the prefix only (`i < leftPinnedCount`) so `resolve(0) === leftPinnedCount` in every state, plus a gapped-state regression test.

Findings 2–3 (informational): pointercancel commits the count (differs from resize-handle precedent); aria-label stringifies `col.title` ReactNode.

Working tree untouched except the new verdict file (pre-existing stage dirt intact).
