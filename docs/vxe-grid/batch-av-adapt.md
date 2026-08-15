Done. Batch AV implemented, verified (react typecheck · test · lint · spec · manifest), working tree staged for commit.

## Report — batch AV (spreadsheet grid keyboard) ✅

### Files changed (1 source + 1 new test + 2 docs; manifest no diff)

| File                                                       | Change                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/.../table/Table.tsx`                       | `type GridCell` import · module-scope `nextRowMajorCell` helper · `handleGridKey` extended: Tab/Shift+Tab (row-major, no wrap), Enter (ArrowDown alias), virtual PageUp/PageDown viewport scroll · `pendingGridFocusRef` + frame-poll layout effect · comments |
| **NEW** `packages/react/.../table/keyboard-extra.test.tsx` | 7 tests, 228 lines (Tab row-major / Shift+Tab back / first+last cell clamped / Home·End / Enter down + last-row clamp / no-keyboardNavigation inert / virtual PageDown scroll+focus / virtual PageUp scroll-back)                                              |
| `apps/docs/components.md`                                  | `keyboardNavigation` prop row → full key map (arrows, Home/End, PageUp/PageDown + virtual scroll, Tab/Shift+Tab row-major no-wrap, Enter; editing Tab unchanged)                                                                                               |
| `docs/vxe-grid-comparison.md`                              | 批 AV batch-table row + 构建状态 header + test-count line (react 2027→2034)                                                                                                                                                                                    |
| `packages/manifest/{manifest.json,llms.txt}`               | regenerated via `pnpm gen:manifest` — **no diff** (zero API change; 155×4 stable)                                                                                                                                                                              |

### Verification (all green)

- **react typecheck: clean**
- **react test: 2034 passed** (+7, 0 regressions, 180 files)
- **react lint: 0 errors** (1 pre-existing `IrisTable` complexity warning, unchanged at 240)
- **iris-ui-spec.py --mode all: 0 violations** (1412 files)
- **prettier: clean** on both changed source files
- **gen:manifest**: 155 components × 4 frameworks, 86 tokens — no diff (additive, no new props)

### Design decisions (fiats from baseline)

- **Tab/Shift+Tab** = module-scope `nextRowMajorCell` (row-major `(r,c)→(r,c+1)→(r+1,0)`, **clamped no wrap** — Tab at the last cell stays put, focus never silently leaves the table). preventDefault unconditional; `setFocusedCell` (roving tabIndex) + synchronous `.focus()` — mirror of the arrow path.
- **Editing Tab path (batch J) untouched**: the editor input carries no `data-grid-row`, so the existing early-return leaves `moveEditOnTab`/`moveRowEditOnTab` exactly as before.
- **Enter** = plain `nextGridCell(current, 'ArrowDown')` alias; F2 stays the edit-start key.
- **Virtual PageUp/PageDown**: the root is `overflow: hidden` in pure-virtual mode — the `data-iris-virtual-scroll` viewport IS the body scroller. Scroll it ±10 × itemHeight (function form → current row's height, clamped ≥1), clamped to `[0, scrollHeight − clientHeight]`. Non-virtual tables scroll the root ±10 × measured row height.
- **Virtual focus follow-up**: the target 10 rows away is usually outside the rendered window, so the immediate `querySelector` no-ops. The scroll makes the **IrisVirtualScroll child** re-render (its own rAF → state → commit) — a Table effect alone never re-runs. So `pendingGridFocusRef` + a `[focusedCell]`-keyed layout effect polls on rAF until the cell exists, then focuses (bounded to a few frames; cancelled on re-navigation/unmount; stale pending — user moved on — dropped).

### Counts

react **2034 passed** (+7) · lint **0 errors** · spec **0 violations** · manifest **155×4, no diff**

### What is left

- vue/solid/svelte wiring (core unchanged — adapter-only keyboard enhancement; "react only" scope)
- Gate stage (full turbo run, E2E/visual regression, size, RSC) per the workflow's review/gate stages
