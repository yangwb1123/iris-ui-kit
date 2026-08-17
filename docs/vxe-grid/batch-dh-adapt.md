All done and committed. Here's the report for **批 DH：单元格图案填充 (iris 独有)**.

## Files changed (3 source + 2 generated + 1 baseline doc)

- `packages/react/src/primitives/table/props.ts` — added `pattern?: boolean` (Data-consistency assist, default off/fail-closed)
- `packages/react/src/primitives/table/Table.tsx` — prop destructure; `patternEdit` resolution from the existing cell-edit store; module helpers `PatternEditActive` interface + `patternHintStyle()`; per-cell `data-iris-input-hint` attr + longhand `background-image` spread (after conditional styles, before `lockedRender.style`)
- `packages/react/src/primitives/table/pattern-fill.test.tsx` — 12 new tests (within 500-line budget)
- `packages/manifest/{manifest.json,llms.txt}` — regenerated via `gen:manifest`
- `docs/vxe-grid/batch-dh-baseline.md` — baseline (untracked doc)

Unrelated pre-existing dirt (`DECISIONS.md`, `batch-dg-gate.md`) left untouched.

## Tests added — 12 (≤500 lines, file is ~300)

gating off / gating idle · happy path · per-keystroke realtime (no commit) · raw-value matching (number editor) · empty-draft fail-closed · only edited column · editing cell exempt · locked attr preserved · row-mode fiat · coexists with `cellRange` · commit clears hints.

## Counts

- Change budget: 4 files (target ≤5), core logic +71 lines (target ≤300) — passed
- Core: 102 files / 1584 tests pass · React: 241 files / 2744 tests pass (incl. new 12)
- `typecheck` clean · `lint` 0 errors (2 pre-existing complexity warnings, unchanged)
- `iris-ui-spec.py --mode all` → **0 violations**
- Commit: `2da7b046`

## How it works (additive, core-touched-free)

Edits draw their live draft from the existing framework-agnostic `cellEdit.store` (already component-subscribed at `editingTarget`). When `pattern` is set and a cell-mode session is open, every other cell in the same column whose committed **raw** value `String(raw) === String(draft)` gets `data-iris-input-hint` plus a `--iris-input-hint` token background. Zero new state/handlers/core changes.

## What's left / fixtures

- **Documented fiat**: row-edit mode doesn't participate — each column's draft lives in its own per-column session, not the shared store (inline cell mode is the fully-realtime path).
- Highlight color uses `--iris-input-hint` with an inline rgba default fallback (no theme/token-file change needed).
- No other framework adapters touched (react-only per spec).
