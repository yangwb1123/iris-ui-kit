Review complete. **Verdict: PASS** — written to `docs/vxe-grid/batch-s-review.md`. No source files modified.

## Verification (all run)

- `react test` **1750/1750** ✅ · typecheck ✅ · lint **0 errors** (1 pre-existing complexity warning) ✅
- `check:manifest` ✅ up-to-date (new props + `IrisTableCustomConfig` present, react-only additive) · core + zh plugin typecheck ✅ · `audit:security` 0 vulns ✅ · core framework-free grep = 0 ✅
- `audit:tokens` exit 1 — **pre-existing** (same 3 legacy tokens in parent; panel uses only canonical tokens)

## Check results

1. **columnOrder** — correct: unknown keys ignored, deduped stable sort, unnamed keys keep relative order after ordered ones, `[]` = no-op, reference-preserving without the prop; flows into header/body/footer via `leafColumns`; grouped tables coherent (top-level only, documented). ✅
2. **Panel** — search display-only; toggles live via `onColumnVisibilityChange`; drag splices the draft by key `indexOf` (correct even under an active search filter); confirm closes + fires `onColumnOrderChange(draftOrder)`; Esc discards; reset restores snapshot + `undefined` order + re-seeds draft. ✅
3. **Existing behavior** — button opens, `data-iris-table-column-settings` kept → `vxe-parity.test.tsx:329` green; only in-repo consumer; menu→panel replacement is baseline decision (a). ✅
4. **Additive/hygiene** — optional props only; i18n keys in both en/zh; manifest regenerated; tokens canonical. ✅

## Findings (3 × LOW, non-blocking)

1. **A11y regression** — `Table.tsx:3889-3897`: checkbox has no accessible name (old menu used `<label>`), title not clickable despite `cursor:pointer`. Fix: wrap in `<label>`.
2. **Reset spec drift** — `Table.tsx:1574-1576,1632-1636`: baseline specified `onColumnVisibilityChange({})`; impl fires a **first-open, never-refreshed** snapshot → reset behavior varies with panel history and clobbers parent-side visibility changes. Fix: re-snapshot per open; record in DECISIONS.md.
3. **Stuck drag** — `Table.tsx:3808-3809`: pointerup outside the ~200px panel leaves `activeId` set (row/col drags bind to the table root, `4108-4123`). Fix: window-level pointerup/pointercancel during drag.
