Review complete. Verdict written to `docs/vxe-grid/batch-ec-review.md`: **FAIL**.

## What I verified (all on committed state `db121dfb` + `22de00a9`)

| Gate                                | Result                                                                |
| ----------------------------------- | --------------------------------------------------------------------- |
| core test                           | ✓ 1641/1641                                                           |
| react test (full)                   | ✓ 256 files, 2987/2987 (+19 EC, batch-ec 19/19)                       |
| react typecheck / lint              | ✓ / ✓ (0 errors; 2 complexity warnings pre-existing, outside EC diff) |
| audit:tokens                        | ✓ clean                                                               |
| check:manifest                      | ✓ regenerated == committed (207 props, 33 events)                     |
| manifest tests                      | ✓ 69/69 (incl. framework-contracts, contract-coverage)                |
| iris-ui-spec.py                     | ✓ 0 violations                                                        |
| core framework-free / additive-only | ✓ (zero core changes; only 2 in-place replaced lines in Table.tsx)    |

## The blocking finding

**1. HIGH — clamp feedback trap breaks the documented self-healing** (`cell-helpers.tsx:178`, `Table.tsx:861-883`)
Once a row is pinned (`height: h` inline), that row's layout box height _is_ `h`. Any later growth (data commit, narrower resize, font/density change) is clipped by the cells' inline `overflow: hidden` (`Table.tsx:6612`), and `row.offsetHeight` still returns the clamped `h` — so every re-measure reads back the pin: same-value bail, row permanently frozen (and never shrinks either). The prop doc and baseline explicitly promise "数据/编辑/字体/density 变化经重渲自愈" + resize/RO 重测 — that's dead in real browsers. **jsdom can't see it**: the tests stub `offsetHeight` directly, bypassing the pin↔read feedback loop. Fix: clear the inline height (`row.style.height = 'auto'`) before reading in `measureAdaptiveRowHeights`, plus add a real-browser (Playwright) verification path.

**2. LOW — perf**: the dependency-free layout effect re-measures all rows on _every_ commit (selection/hover included), forcing O(rows) synchronous layout each time; the identity bail only stops render noise, not the layout cost. Optional: dep-gate the effect to content-affecting changes.

## Otherwise clean

Three-state inert gate matches the BN throat (rowHeight/virtual ⇒ inert) ✓; reserved-role exclusion consistent between helper and CSS (header/summary/loading/empty/error/footer-*) ✓; marker-gated rule, default byte-identical ✓; `rowStyle` escape hatch ✓; ≤0/SSR natural-height ✓; CSS keyword-only rule, no bare values ✓; manifest 206→207 with other-framework contracts still native ✓.

No implementation files were modified; only the review doc was created.
