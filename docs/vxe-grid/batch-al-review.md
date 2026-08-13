Review complete. Verdict: **PASS** — written to `docs/vxe-grid/batch-al-review.md`.

## Summary

**Verification run (all required commands):**

- react tests **1911 passed** (incl. 15 new undo/batch-edit tests) · typecheck 0 errors · lint 0 errors (1 pre-existing complexity warning)
- core 1308 · zh drift 6 · `check:manifest` up to date (undo prop + propCount 128→129) · core framework-free grep 0 · token audit: no new violations, no hardcoded hex

**Checklist — all confirmed:**

1. **Undo**: both mutation funnels push (`commitRowList` covers row ops/paste/fnr/range-clear/loadData/batch; `commitValue` eager block covers cell+row edits that bypass `commitRowList` — the baseline's flagged correction is correctly implemented); post-change snapshot semantics verified against core `createUndoStack`; `restoringRef` prevents re-push; keyboard gated on undo/root-containment/text-controls/open-editor; buttons disabled from `canUndo/canRedo`; selection pruned on undo+redo; no prop → inert.
2. **Batch edit**: opens with selection, editable columns only (same `c.editable` gating as inline), one `commitRowList` = one onDataChange + one undo step, selection kept, Esc/outside/trigger-toggle close, `edit:false` byte-compatible.
3. **Hygiene**: additive props only, i18n en+zh keys, CSS `var(--iris-*)` only, manifest clean.

**Numbered findings (7, all LOW/informational except one):**

- **F1 [MEDIUM]** — `arch-check:ratchet` is red and this batch grows the grandfathered `Table.tsx` (+367 over baseline 1255) without re-ratcheting; red is partly pre-existing (HEAD~1 fails too), but the adapt's "all green" claim omits this gate.
- F2 [LOW] rowId-keyed edits not undoable (documented boundary; eager snapshot uses `rowKey` field lookup, `setCellValue` misses rowId rows)
- F3 [LOW] toolbar ↶/↷ buttons not disabled during an open edit session (keyboard is gated, buttons aren't)
- F4 [LOW] batch panel opens empty with zero editable columns
- F5 [LOW] a11y: value input reuses the Apply label; no `role="dialog"`/`aria-expanded`
- F6 [LOW] external re-feed after undo-all keeps stale redo branch (interaction-scoped corner case)
- F7 [INFO] manifest doesn't surface `toolbar.batch.edit` (pre-existing nested-type limitation)

No files modified (only the review doc was created).
