Committed as `a50454d7 feat(table): grid 批 BG——快捷键自定义（iris 独有）`. Working tree clean.

## Report — batch BG: 快捷键自定义 (`keymap`)

### Files changed (4 source + 2 tests)

| File                                                  | Change                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/keymap.ts`                         | **new** — framework-free engine: `IrisTableKeyAction` (8 actions), named interfaces (`TableKeyBinding`/`TableKeyEvent`/`NormalizedTableKeymap`), `DEFAULT_TABLE_KEYMAP`, `parseTableKey`, `normalizeKeymap` (per-action wholesale override, fail-closed), `matchTableKey` (exact modifiers, ctrl-or-meta)                                                |
| `packages/core/src/index.ts`                          | barrel export (+12)                                                                                                                                                                                                                                                                                                                                      |
| `packages/react/src/primitives/table/props.ts`        | `keymap?: Partial<Record<IrisTableKeyAction, string>>` after `tableShortcuts` (single-line, named core type — prettier breaks the inline literal union, which would break manifest prop parsing)                                                                                                                                                         |
| `packages/react/src/primitives/table/Table.tsx`       | `keyBindings` memo wired into the 4 hardcoded key sites (F2/Delete, undo/redo, copy/paste) + **2 new defaults**: `Ctrl+D` one-step fill (existing `fillRangeFromHandle` pipeline, zero new mutation logic), `Ctrl+K` query-input focus (`queryInputRef`); `defaultPrevented` first-handler-wins guards in window listeners; root onKeyDown gate extended |
| `packages/core/src/keymap.test.ts`                    | new, 159 lines — **12 tests**                                                                                                                                                                                                                                                                                                                            |
| `packages/react/src/primitives/table/keymap.test.tsx` | new, 347 lines — **10 tests**                                                                                                                                                                                                                                                                                                                            |

### Verification (all pass, exact commands)

- core test: **1469/1469** (95 files); core typecheck clean; core lint 0 errors
- react typecheck clean; react test: **2150/2150** (191 files); react lint **0 errors** (1 pre-existing complexity warning)
- spec validator `--mode all`: **0 violations** (1414 files)
- `gen:manifest` regenerated + committed: **propCount 148→149**, `keymap` captured single-line, react-only (other frameworks have no keyboard parity)

### Counts

22 new tests (12 core + 10 react); 4 changed files + 2 test files (≤4 source constraint met); both test files ≤500 lines (159/347).

### Fiats honored

- New fill/query defaults strictly gated (`rangeFill`+live range; controlled `query`)
- Keymap never enables a disabled feature (6 feature-flag gates unchanged)
- Collision = first handler wins (root handlers beat window listeners via `defaultPrevented`)
- Invalid keys fail-closed → default retained; wholesale alias replacement; exact-match tightening (`Ctrl+Shift+Y`/`Alt+Ctrl+Z` now inert — documented deviation, no test relied on it)

### Left

- No UI for editing keymaps (spec is prop-only); `Ctrl+F` fnr key intentionally not in the 8 actions (per baseline); other frameworks untouched (no keyboard parity exists).
