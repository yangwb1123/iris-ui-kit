## Verdict: **PASS** (0 blocker / 0 major; 2 low / 3 info)

Verdict written to `docs/vxe-grid/batch-cd-review.md`.

### Verification (all green, on HEAD `9f14eb13`)

| Check                                     | Result                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| core test                                 | 1533/1533                                                 |
| react test                                | 2419/2419 (incl. 10 new + vxe-parity rowDrag regression)  |
| react typecheck                           | clean                                                     |
| react lint                                | 0 errors (1 pre-existing `IrisTable` complexity warning)  |
| spec audit (`iris-ui-spec.py --mode all`) | 0 violations                                              |
| `check:manifest`                          | up to date — zero diff, IrisTable propCount 168 unchanged |
| prettier (changed files)                  | clean                                                     |

### Key inspection results

- **Spec correctness**: single pure `resolveRowDragDrop` (Table.tsx:171) shared by move + up handlers; side = pointer vs over-row midpoint; 1px `var(--iris-primary)` line, `pointerEvents: none`, z2, logical full-width inset, root forced `position: relative` after `...style`; cleanup on up (both branches)/leave/cancel (new gated cancel branch also fixes a pre-existing stuck-`activeId`); net-zero drops skip `onReorder`. **I simulated all 12 drag permutations** (3 rows × 2 directions × 2 sides) — the dragged row's edge lands exactly on the drawn line in every case, including the below-last-row boundary. No off-by-one.
- **Additive only**: only `Table.tsx` + new 212-line test; props/types/styles/i18n/core/manifest untouched. `rowDrag` remains the pre-existing opt-in prop.
- **Core framework-free**: zero core changes; helper is pure module-scope TS in the react adapter.
- **CSS tokens**: only `var(--iris-primary)` + logical properties; no hardcoded hex/Tailwind/Emotion.

### Findings (no blockers)

1. **[low]** Table.tsx:8916-8918 — comment claims the line renders "below … pinned columns", but pinned cells are z1 while the line is z2 (it paints _above_ them, which is correct per spec's mandated z2); reword the comment.
2. **[low]** No test for upward non-net-zero commit or below-last-row boundary; the shared pure function makes risk low, but pinning would harden the invariant.
3. **[info]** `resolveRowDragDrop` adds an `idOf` mapper vs. the baseline sketch (necessary, faithful).
4. **[info]** No-ghost dead zone around the active row's center (no line while closestCenter returns the active row) — inherent to the design, per baseline F1/O1.
5. **[info]** Line `top` mixes drag-start rects with a fresh `rootTop` — mid-drag scroll drift, documented pre-existing F1 semantics.

No files modified other than the verdict report.
