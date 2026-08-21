## Gate: PASS

Historical review was FAIL; fixes were applied, browser-verified, and the full
gate completed at **180/180** tasks before commit.

### Historical pre-gate verdict: FAIL (all addressed)

**HIGH (gate-blocking)** — `setPointerCapture` was called on every left-button pointerdown, retargeting the subsequent `click` to the capture div so the checkbox label never received it (input is `pointerEvents:none`) → rows un-toggleable by click with `selectionDrag` on. **Fixed**: capture deferred to the drag-start branch of `handleSelectionDragPointerMove` (4px threshold), targeting the press cell stored in a new `selectionDragPressCellRef`.

**LOW** — guard returned before resetting `selectionDragSuppressRef`, and `pointercancel` didn't clear it → stale flag could swallow the next click. **Fixed**: flag reset moved before the guard in `handleSelectionDragPointerDown` + cleared in `pointercancel` (and press-cell ref cleared in up/cancel for hygiene).

**INFO** — comments rewritten to reflect the capture-retargeting model; suite extended (15 tests, +2).

## Verification

- **Negative checks**: reintroducing capture-on-press fails tests ③/④; removing the pointercancel clear fails ⑤ — all three fixes are genuinely guarded.
- **Full repo gate**: `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks successful**
- **Audit**: no vulnerabilities (0)
- **Manifest**: `gen:manifest` regenerated (155 components × 4, `selectionDrag` on react barrel only) + `check:manifest` up to date
- **Prettier**: clean on all touched files

## Test counts

- **core**: 1517/1517 · **react**: 2296/2296 (+15 selection-drag, was 13)

## Commit

`4ea223965f2fb8cbba9988a3a7e2b0134cc2f0f9` — `feat(table): grid 批 BT——行选择拖拽范围（iris 独有）` (7 files: Table.tsx, selection-drag.test.tsx, vxe-grid-comparison.md ×3 places, review/adapt/DECISIONS docs)

Working tree clean.
