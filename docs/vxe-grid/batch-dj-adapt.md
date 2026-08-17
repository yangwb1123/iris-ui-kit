All verification passes. The manifest diff correctly shows the new `hotkeyScope`/`outerScope` props across all four adapters and propCount 190→192.

## Summary — Batch DJ: 表格快捷键监听增强 (hotkeyScope)

### Files changed (4 source/test + manifest regeneration)

| File                                                           | Change                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                 | +`hotkeyScope?` (default true) / `outerScope?` (default false) with full docs, right after `keymap`                                                                                                                                               |
| `packages/react/src/primitives/table/Table.tsx`                | Added `inShortcutScope` gate helper; rewired the **4 window keydown listeners** (undo/redo, clip copy/paste, fnr Ctrl+F+Escape, batch-edit Escape); destructured new props; added `data-iris-table-surface` markers to fnr-bar & batch-edit panel |
| `packages/react/src/primitives/table/hotkey-scope.test.tsx`    | **New** — 12 tests (226 lines, under 500)                                                                                                                                                                                                         |
| `packages/react/src/primitives/table/undo-batch-edit.test.tsx` | Updated 1 test to fire Escape from the panel's own input (was `document`) to match the intentional scope tightening                                                                                                                               |
| `packages/manifest/{manifest.json,llms.txt}`                   | Regenerated (propCount 190→192)                                                                                                                                                                                                                   |

### Design

- `inShortcutScope(e.target)`: `outerScope` → global; `hotkeyScope:false` → permissive (legacy anywhere); default → in-table only. Scope read live from keydown target (no new focus/blur state).
- The gate also treats the table's own floating surfaces (fnr bar, batch-edit panel — rendered outside `rootRef`) as in-scope so Esc keeps closing them from within their inputs.
- Default behavior byte-equivalent for undo/clip (still in-table); fnr/batch-edit tighten anywhere→in-table (intentional, per baseline). No core changes — react-only, additive.

### Tests added (12)

In-focus fnr open / defocused blocked / focus-return recovery / undo in-table vs defocused / clip copy in-table vs defocused (blocked) / outerScope global (fnr, wins over hotkeyScope, clip) / permissive mode (fnr, undo) / prop-change takes latest (outerScope flip) / unmount cleanup.

### Gates

- ✅ core test: 1584 passed
- ✅ react test: 2770 passed / typecheck clean
- ✅ react lint: **0 errors** (2 pre-existing warnings)
- ✅ spec scanner: **0 violations**
- ✅ `gen:manifest` regenerated + diff committed

### What's left

None — complete. (Dirty files `docs/vxe-grid/DECISIONS.md` and `batch-di-gate.md` in `git status` are pre-existing from parallel sessions, not part of this batch.)
