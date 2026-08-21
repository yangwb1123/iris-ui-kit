## Verdict: PASS — post-gate re-review

The historical findings below were fixed in the gate stage: pointer capture is
deferred until drag activation and the cancel/press state is cleared. The
full repository gate completed at 180/180 tasks, with browser verification and
regression coverage. The original pre-fix record is retained below.

Reviewed commit `12addddc` against the baseline, inspected the full diff, re-ran every requested gate, and empirically verified the critical interaction in a real browser (Chrome 151 via Playwright — the repo's Playwright is available).

### Verification (all independently re-run ✅)

- **core test** 1517/1517 · **react test** 2294/2294 (+13 new) · **react typecheck** clean · **react lint** 0 errors (1 pre-existing complexity warning)
- **audit** no vulnerabilities · **check:manifest** up to date (propCount 159→160, `selectionDrag` on react barrel only)
- **core framework-free** — core at 0 diff lines, no framework imports
- **CSS tokens** — zero new styles, all `var(--iris-*)` reuse
- **spec check** — the 2 reported violations are pre-existing (identical on pre-BT file)

### Historical pre-gate findings (resolved by the gate)

1. **HIGH (gate-blocking)** — `Table.tsx:3394-3401`: `handleSelectionDragPointerDown` calls `setPointerCapture` on **every** left-button pointerdown. Pointer capture retargets the subsequent `click` to the capture element (cell div); the cell `onClick` does nothing for a plain click, and the label→input forwarding never fires (IrisCheckbox's input is `pointerEvents: 'none'`, so the label is the only click surface). **Verified in real Chrome**: click lands on the capture div, checkbox never toggles → with `selectionDrag` on, plain mouse clicks can no longer select a row — violating the documented contract "a plain click still toggles a single row" (props.ts:493). jsdom implements neither capture nor click retargeting, and test ③ clicks the input directly, so the suite is blind to it. **Fix**: defer `setPointerCapture` until the 4px threshold is crossed in `handleSelectionDragPointerMove`'s drag-start branch.

2. **LOW** — `Table.tsx:3394-3395` guard returns before resetting `selectionDragSuppressRef`, and `pointercancel` (8016-8027) doesn't clear it → a stale flag survives an aborted drag + `selectable` switch and silently swallows the next click.

3. **INFO** — the trailing-click comment (6132-6138) describes a label-forwarding mechanism that never occurs under capture (the flag is redundant there; its only observable effect is Finding 2); the suite should reflect the capture-retargeting model.

Everything else — drag-range semantics (closed interval, checkMethod respect, monotonic union, reverse-drag, tree, controlled, disabled-anchor, non-row-area), additive-only discipline, manifest hygiene, and all gates — is correct.
