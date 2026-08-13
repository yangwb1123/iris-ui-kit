Baseline complete — `/home/u1/iris-ui/docs/vxe-grid/batch-an-baseline.md` (60 lines). `git status` confirms only the new doc; zero source files touched.

**What the baseline covers** (every claim verified against the code):

**a) `tableShortcuts?: boolean`** — additive, default off:

- Wires into the existing root `onKeyDown` (Table.tsx:5562, gate extended from `keyboardNavigation || cellRange` to `|| tableShortcuts`). The root handler _is_ the focus gate — toolbar/form/pager are fragment siblings outside the root (zoom comment, Table.tsx:120), so shortcuts can never fire from them; handler also no-ops without a focused cell.
- Focused-cell resolution: `focusedCell` state (keyboardNavigation, Table.tsx:3181) → `cellRangeCtrl` anchor (cellRange) → no-op. **Flagged gap**: range cells have no `tabIndex` today, so the design adds the single-tabstop roving treatment to cells when `tableShortcuts` is on — otherwise the root handler is dead code in range-only mode.
- F2 → `beginEdit` gated `col.editable` (re-guarded at Table.tsx:2358). Delete/Backspace (gated not-editing) → one `commitRowList` (Table.tsx:2532) with `setCellValue(..., '')`.
- **`''` over `null`, documented**: `clearActiveRange` (Table.tsx:3492) already writes `''`; edit drafts seed `current == null ? '' : ...`; value-distribution treats `''` as empty; `null` would flip cell type (`Number(null) === 0` on a number editor).
- editRules not re-validated / `onCellEdit` not fired (paste/batch-edit/range-clear parity); undo covered free via commitRowList→recordUndo.

**b) `preset?: 'date' | 'money' | 'status' | 'progress'`**:

- Pure core factory `applyColumnPreset` in new `packages/core/src/column-preset.ts`, **structural typing** (`ColumnAccessor` precedent in core/columns.ts) — flagged correction: the literal `(column, preset): IrisTableColumn` react type can't live in core (dep direction is react→core); the generic returns `C`, so the react call site keeps `IrisTableColumn<Row>` with zero casts.
- Fills per preset (date `'left'` documented; money 2-decimals+thousands separator, `editor: 'number'`, editRules; status center + plain-text UPPERCASE, no CSS-var badge coupling; progress `'42%'` right).
- **Traps caught**: money `editRules: [{ type: 'number' }]` would reject every commit (drafts reaching `validateEditRulesAsync` are raw input strings, edit-rules.ts:91 requires `typeof === 'number'`) → numeric-string validator instead; date formatter must pass through `YYYY-MM-DD` strings unchanged (`new Date('2026-08-13')` is UTC midnight → `formatLocalISO` would shift the day west of UTC).
- Merge is **defined-fields-only** (plain spread would let `align: undefined` kill the preset); resolution in one memo feeding `orderedColumns` (Table.tsx:907), recursive over `children`, reference-preserving for zero-preset tables.

File map (2 new files, 5 edits), ~27 tests across core (`column-preset.test.ts`) and react (`Table.shortcuts.test.tsx`), and 6 fiats for review are all in the doc.
