Committed as `2517c08b`, working tree clean. All verification gates green.

## Report

**Commit:** `2517c08b` — `feat(table): grid 批 AV——电子表格键盘（Tab/Shift+Tab 行主序、Enter 下移、PageUp/PageDown 虚拟滚动）`

### Files changed (1 source + 1 new test + 3 docs; manifest no diff)

| File                                                                        | Change                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/Table.tsx`                             | `type GridCell` import · module-scope `nextRowMajorCell` (row-major, no-wrap clamp) · `handleGridKey` extended: Tab/Shift+Tab, Enter = ArrowDown alias, virtual PageUp/PageDown viewport scroll (±10 × itemHeight, clamped) + non-virtual root scroll (±10 × measured row height) · `pendingGridFocusRef` + rAF-poll layout effect for virtual focus follow-up |
| **NEW** `packages/react/src/primitives/table/keyboard-extra.test.tsx`       | 7 tests, 228 lines                                                                                                                                                                                                                                                                                                                                             |
| `apps/docs/components.md`                                                   | `keyboardNavigation` prop row → full key map (gitignored generated file — lives in working tree for the docs build)                                                                                                                                                                                                                                            |
| `docs/vxe-grid-comparison.md`                                               | 批 AV batch-table row + 构建状态 header + test-count line (react 2027→2034)                                                                                                                                                                                                                                                                                    |
| `docs/vxe-grid/batch-av-baseline.md` · `batch-av-adapt.md` · `DECISIONS.md` | baseline doc (pre-existing) + adapt report + workflow log                                                                                                                                                                                                                                                                                                      |

### Tests added (7)

1. Tab moves focus right, row-major (`(0,1)` → `(1,0)`), roving tabindex flips
2. Shift+Tab moves left; clamped at both bounds (first cell Shift+Tab stays, last cell Tab stays — no wrap)
3. Home/End jump to row first/last cell
4. Enter moves down (alias of ArrowDown), clamped at last row
5. No `keyboardNavigation` → all keys inert (no preventDefault, no grid coords)
6. Virtual PageDown: viewport scrollTop = 10 × itemHeight, window re-renders, focus lands on row 10
7. Virtual PageUp: scrolls back up, focus lands on row 10

### Verification counts

- **react typecheck**: clean
- **react test**: 2034 passed (+7, 0 regressions, 180 files)
- **react lint**: 0 errors (1 pre-existing `IrisTable` complexity warning, unchanged at 240)
- **spec script `--mode all --json`**: 0 violations (1412 files)
- **`pnpm gen:manifest`**: 155×4 components, 86 tokens — **no diff** (zero API change: `keyboardNavigation` stays a plain boolean, no new props)
- **prettier**: clean on changed source

### Design notes

- **Editing Tab path (batch J) untouched** — the editor input carries no `data-grid-row`, so the existing early-return leaves `moveEditOnTab`/`moveRowEditOnTab` byte-identical; Home/End/PageUp/PageDown math reuses core `nextGridCell` (no core change).
- **Virtual focus follow-up**: the target 10 rows away is outside the rendered window, and the window re-renders inside the `IrisVirtualScroll` child (its own rAF → state → commit) — a Table effect alone never re-runs. Solution: `pendingGridFocusRef` + a `[focusedCell]`-keyed layout effect that polls on rAF until the pending cell exists (bounded to a few frames, cancelled on re-navigation/unmount, stale pending dropped).

### What is left

- vue/solid/svelte wiring (core unchanged — adapter-only keyboard enhancement; "react only" scope per baseline)
- Review/gate stages per the workflow (full turbo run, E2E/visual regression, size, RSC)
