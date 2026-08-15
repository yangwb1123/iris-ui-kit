All green. Final verification summary:

## Report — batch BG: 快捷键自定义 (`keymap`)

### Files changed (4 + tests, per baseline file map)

| File                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/keymap.ts`                         | **new** — framework-free keymap engine: `IrisTableKeyAction` union (8 actions), `IrisTableKeymap` / `TableKeyBinding` / `TableKeyEvent` / `NormalizedTableKeymap` named interfaces, `DEFAULT_TABLE_KEYMAP` (string form, `clear`/`redo` aliases), `parseTableKey` (invalid forms → null), `normalizeKeymap(overrides?)` (per-action wholesale override + fail-closed fallback), `matchTableKey` (exact modifier match, ctrl-or-meta, case + space normalization)                                         |
| `packages/core/src/index.ts`                          | +12: barrel export of keymap functions + types                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `packages/react/src/primitives/table/props.ts`        | +1: `keymap?: Partial<Record<IrisTableKeyAction, string>>` after `tableShortcuts` (single-line; `IrisTableKeyAction` core type import — prettier would break the inline literal union across lines, breaking the manifest's single-line prop parse)                                                                                                                                                                                                                                                      |
| `packages/react/src/primitives/table/Table.tsx`       | +~30: `keyBindings = normalizeKeymap(keymap)` memo + `queryInputRef`; the 4 existing hardcoded key sites rewired to `matchTableKey` (F2/Delete in `handleTableShortcutKey`, undo/redo + copy/paste window listeners with `defaultPrevented` first-handler-wins guards); **2 new defaults**: `Ctrl+D` one-step drag-down via the existing `fillRangeFromHandle` pipeline (zero new mutation logic) and `Ctrl+K` query-input focus; root onKeyDown gate extended with `rangeFill \|\| query !== undefined` |
| `packages/core/src/keymap.test.ts`                    | new, 159 lines (≤500): **12 tests**                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/react/src/primitives/table/keymap.test.tsx` | new, 347 lines (≤500): **10 tests**                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

(`docs/vxe-grid/DECISIONS.md` M + `batch-bf-gate.md` M + `batch-bg-baseline.md` ?? are pre-existing stage-runner entries, untouched by me.)

### Tests added (22, per baseline plan)

**Core (12)**: default map shape (8 actions + aliases) · parse plain/modifier combos · case + Ctrl/Cmd/Meta/Alt/Option synonyms · 11 invalid forms rejected · normalize defaults (aliases expanded) · per-action override merge (others untouched) · wholesale alias replacement (clear/redo) · invalid overrides fail-closed to defaults + mixed · exact modifier matching (Ctrl+Shift+Z → redo, never undo) · ctrl-or-meta · shift/alt exactness (Alt+Ctrl+Z inert, Shift+F2 inert) · end-to-end rebinding + space normalization.

**React (10)**: defaults regression (F2 edit / Delete clear / Ctrl+Z undo / Ctrl+C copy / Ctrl+D fill / Ctrl+K query) · override edit F3 + wholesale clear Delete (Backspace alias killed) · override undo Ctrl+Q · invalid overrides ignored → defaults retained · exactness (Alt+Ctrl+Z inert, Ctrl+Shift+Z redoes) · feature gates ×5 (tableShortcuts / rangeFill / query / clipConfig / undo) · collision first-handler-wins (edit-bound Ctrl+C never also copies — window listener backs off on `defaultPrevented`). Existing `Table.shortcuts` / `undo-batch-edit` / `clip-fnr` suites stay green as the default-bindings regression net.

### Verification (all pass)

- core test: **1469/1469** (95 files, +12); core typecheck clean; core lint 0 errors (7 pre-existing complexity warnings)
- react typecheck: clean; react test: **2150/2150** (191 files, +10); react lint: **0 errors** (1 pre-existing `IrisTable` complexity warning)
- spec validator `--mode all`: **0 violations** (1414 files)
- `gen:manifest`: regenerated — **propCount 148→149**, `keymap` captured single-line as `Partial<Record<IrisTableKeyAction, string>>` (react only; other frameworks have no keyboard parity, per baseline)

### Constraints honored

- Core framework-free (new pure `keymap.ts`, zero framework imports); react-only bridge; additive only (defaults byte-compatible — exact-match tightening of Ctrl+Shift+Y is the documented deviation)
- No dist/tgz/node_modules edits (core `dist` rebuilt by the normal build flow, gitignored); CSS untouched (no new styling)
- Manifest hygiene: single-line prop with a named exported core type; named exported interfaces (`TableKeyBinding`/`TableKeyEvent`/`NormalizedTableKeymap`); all new types barrel-exported
- Test files 159/347 lines (≤500); changed files = 4 + 2 test files

### Left (deliberate, per baseline fiats)

- `keymap` never enables a disabled feature (all 6 feature-flag gates unchanged — `keymap={{ edit: 'F3' }}` without `tableShortcuts` stays inert)
- New fill/query defaults are strictly gated (`rangeFill` + live range; controlled `query` present)
- Collision arbitration = first handler wins (root handlers beat window listeners via `defaultPrevented`; undo beats clip by registration order)
- Exact-match tightening: `Ctrl+Shift+Y`/`Alt+Ctrl+Z` are now inert (previously loose) — documented behavior change, no existing test relied on it
