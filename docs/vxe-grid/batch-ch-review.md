## Verdict: **PASS** — review written to `docs/vxe-grid/batch-ch-review.md`

### Summary of the adversarial review

**Spec correctness — PASS.** The spec (`columnDrag 增强：拖拽列头到表格边缘外自动固定（drop 到左边缘 → pinned left）——与 columnPinMenu 组合；测试（拖出固定）`) is implemented exactly as designed in the baseline: `resolveColDrag` (`Table.tsx:3875`) does the left-edge check _first_ (`x < rootRect.left` → `setColumnPinned(activeId,'left')`), else the closestCenter reorder path runs byte-for-byte; gated on `columnDrag && columnPinMenu`; window-level `pointermove`/`pointerup`/`pointercancel` listeners resolve the previously-stuck `activeId` on outside-root release; no new props/state/i18n — it rides the pin menu's existing dual-channel throat. All 13 spec-mapped tests present and passing.

**Additive only — PASS.** `Table.tsx` +76/−4 (the 4 removed lines are just the `handleColDragPointerUp` rename); `props.ts` doc-comment only; new test file; manifest description-text only. The vxe-parity config (`columnDrag` without `columnPinMenu`) is behaviorally byte-identical (zero global hooks).

**Manifest hygiene — PASS.** `check:manifest` up to date; propCount 169 / eventCount 31 unchanged; diff is description text in exactly the two generator locations (component-level props + react framework contract). Vue/solid/svelte contracts untouched and consistent.

**Core framework-free — PASS.** `grep "from '(vue|react|solid|svelte)'" packages/core/src` = 0; core untouched; 1533/1533.

**CSS tokens — PASS.** No new CSS, no hex; pin styling reuses existing `pinnedStyle` with `var(--iris-background)`.

**Verification (all re-run):** core test 1533/1533 · react typecheck clean · react test 2467/2467 (+13) · react lint 0 errors (complexity 284 warning verified pre-existing at parent commit via worktree) · audit 0 · check:manifest up to date · iris-ui-spec 0 violations · prettier clean.

**Findings (none blocking):**

1. **LOW (perf, optional)** — `Table.tsx:3945`: effect deps include `columnDrag` object identity → listener churn if parent re-renders mid-drag with an inline object; could depend on `[colDragCtrl, colDragActive]` + ref instead.
2. **LOW (informational)** — `Table.tsx:3922`: sub-threshold press + outside release leaves core `pending` until next press; identical to pre-CH vxe behavior, zero visible artifact, out of scope.
3. **INFO** — `resolveColDrag(x, _y)` keeps unused `_y` deliberately (documented, lint-clean).
