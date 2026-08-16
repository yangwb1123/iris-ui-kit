All done. Batch CL (行展开动画) is complete and committed as `9325e4ef`.

## Report — batch CL：行展开动画（iris 独有）

**Spec**: `expandAnimation?: boolean` — detail/tree expand transition (max-height/opacity, tokens, reduced-motion off); tests for prop presence + styles. vxe has no expand animation config → no parity constraint, pure iris additive.

### Files changed (commit `9325e4ef`, 9 files)

| File                                                                        | Change                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                              | `expandAnimation?: boolean` after `lazyLoad`; multi-line JSDoc with batch label on first line (manifest parser drops it — CK/CJ/CG precedent)                                                                                                                                                                                                                                      |
| `packages/react/src/primitives/table/Table.tsx`                             | Module helper `expandAnimAttr` (`rangeFillTargetAttr` precedent) · destructure `expandAnimation = false` · derived `expandAnimOn = expandAnimation === true && !virtualScroll` · 2 injection points: detail wrap (`renderBodyEntry`) + tree row (`renderRow`, `depth > 0` gate so root rows stay static)                                                                           |
| `packages/react/src/primitives/table/Table.tsx` (live `TABLE_ROW_CSS`)      | +3 rules: `@keyframes iris-table-expand-enter` (max-height `0 → var(--iris-table-expand-max, 512px)` + opacity `0→1`, overflow hidden at both endpoints — content never permanently clipped) · `[data-iris-expand-anim="true"]` → `animation: … var(--iris-duration-md, 200ms) ease-out` (motion token + fallback) · `@media (prefers-reduced-motion: reduce) { animation: none }` |
| `packages/react/src/primitives/table/expand-animation.test.tsx`             | **NEW — 8 tests, 205 lines** (fail-closed double-check detail+tree / detail expand-collapse / keyframes / duration token / reduced-motion block / tree depth gate / initial-expand replay / virtual-mode inert both paths)                                                                                                                                                         |
| `packages/manifest/manifest.json` + `llms.txt`                              | regenerated — IrisTable props **171→172**, events 31 unchanged, 155×4 components, 86 tokens                                                                                                                                                                                                                                                                                        |
| `docs/vxe-grid-comparison.md`                                               | row 84 + build-status tail (批 CL entry)                                                                                                                                                                                                                                                                                                                                           |
| `docs/vxe-grid/DECISIONS.md` + `batch-cl-adapt.md` + `batch-cl-baseline.md` | stage records                                                                                                                                                                                                                                                                                                                                                                      |

### Verification (all green)

- **core test**: 1559/1559 (zero core changes — framework-free invariant intact)
- **react typecheck**: clean · **react test**: **2511/2511** (2503 → +8) · **react lint**: 0 errors (1 pre-existing IrisTable complexity warning, same as prior batches)
- **iris-ui-spec.py --mode all**: **0 violations** (1416 files)
- **gen:manifest** regenerated + `check:manifest` up to date; prettier clean

### Explicit fiats (per baseline)

- Virtual mode inert: lazy slots mount on scroll → would replay animation + hit the hot path
- Collapse unmounts instantly (a true collapse transition needs keep-alive, conflicting with the uniform-slot virtual model) — collapse affordance stays the existing caret rotation

### What's left

- Review/gate stages (`batch-cl-review.md` / `batch-cl-gate.md` + full repo gate). Comparison row 84 + build-status entry already in place (near-batch precedent).
- `arch-check` ratchet fails identically on clean HEAD (stale `arch-baseline.json`) — pre-existing, outside this batch's gates.
- Pre-existing dirty `docs/vxe-grid/batch-ck-gate.md` left untouched.
