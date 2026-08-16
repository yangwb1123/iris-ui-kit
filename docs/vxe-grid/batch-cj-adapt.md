Done. All verification gates pass; committed as `9a1dacb4`.

## Report — batch CJ：表格快捷键提示（iris 独有）

### Files changed (9 in commit, 7 source + 2 tests)

| File                                                               | Change                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/keymap.ts`                                      | +2 framework-free pure formatters: `formatKeyBinding` (modifier order `Ctrl+`/`Shift+`/`Alt+`, `' '`→`Space`, single letters uppercased, `f2`→`F2`/`delete`→`Delete`, shared ctrl-or-meta flag → `Ctrl`), `formatKeyBindings` (`' / '` join, empty→`''`) |
| `packages/core/src/keymap.test.ts`                                 | +6 formatting tests (round-trips defaults, rebinds, display-casing, empty list)                                                                                                                                                                          |
| `packages/core/src/i18n.ts`                                        | +9 EN keys (`table.shortcuts` header + 8 action labels)                                                                                                                                                                                                  |
| `packages/core/src/index.ts`                                       | barrel: export the 2 formatters                                                                                                                                                                                                                          |
| `packages/plugin-locale-zh/src/core/index.ts`                      | +9 zh keys (parity: every defaultMessages key translated, no placeholders)                                                                                                                                                                               |
| `packages/react/src/primitives/table/ShortcutHintsPanel.tsx`       | **NEW** panel (AuditPanel pattern: `useFloating` bottom-end + portal, Esc/outside/scroll close, trigger exempt; lists 8 actions in `TABLE_KEY_ACTIONS` order: label + formatted effective keys; all `--iris-*` tokens)                                   |
| `packages/react/src/primitives/table/props.ts`                     | `shortcutHints?: boolean` after `charCount` (baseline-指定位置)                                                                                                                                                                                          |
| `packages/react/src/primitives/table/Table.tsx`                    | destructure + toolbar gate admission + state/anchor ref + `?` trigger (`data-iris-shortcut-hints-trigger`, after perf trigger) + panel render consuming the `keyBindings` memo (single source of truth)                                                  |
| `packages/react/src/primitives/table/test/shortcut-hints.test.tsx` | **NEW**, 11 tests                                                                                                                                                                                                                                        |
| `packages/manifest/manifest.json` + `llms.txt`                     | regenerated via `gen:manifest`                                                                                                                                                                                                                           |

### Tests added / counts

- core `keymap.test.ts`: **+6** → core suite **1548 passed** (was 1542; baseline ~1547 ✓)
- react `shortcut-hints.test.tsx`: **+11** (fail-closed / toolbar gate / canonical 8-action list with exact defaults `F2`, `Delete / Backspace`, `Ctrl+Z`, `Ctrl+Y / Ctrl+Shift+Z`, `Ctrl+C`, `Ctrl+V`, `Ctrl+D`, `Ctrl+K` / wholesale override drops Backspace alias / modifier remap display / invalid-override fail-closed / Esc / outside close with trigger toggle / zh labels + locale-independent keys / live remap while open / read-only no controls) → react suite **2492 passed** (was 2481; baseline 2481→2492 ✓)

### Verification (all green)

- `core test`: 1548 ✓ · `react typecheck`: clean ✓ · `react test`: 2492 ✓ · `react lint`: 0 errors (1 pre-existing `IrisTable` complexity warning) ✓
- `iris-ui-spec.py --mode all --json`: **0 violations** ✓
- `gen:manifest` regenerated + committed: IrisTable props **169→170**, events 31 unchanged ✓
- zh parity (`plugin-locale-zh` 6 passed), manifest suite (69 passed), `check:manifest` + `check:docs-reference` up-to-date ✓
- Prettier clean on all 9 files; commit hook budget: 9 files / 242 core-logic lines (under hard stops; 9>5 target is the known multi-framework fan-out exception)

### Scope notes

- **File count**: 7 source files (baseline plans exactly these: keymap.ts, i18n.ts, plugin-locale-zh, ShortcutHintsPanel.tsx, props.ts, Table.tsx + the core barrel `index.ts` needed for react to resolve the new exports). The zh-parity gate forces both core EN + plugin-locale-zh; no way to stay ≤4 while keeping parity — followed the baseline spec.
- Manifest hygiene: new prop is a single-line boolean; panel props interface named + exported; no new core types (reuses `NormalizedTableKeymap`); no `as any`/TODO.

### What's left (subsequent stages)

- Review/gate stages: `docs/vxe-grid/batch-cj-adapt.md` / `-review.md` / `-gate.md` reports + `docs/vxe-grid-comparison.md` batch entry (prior batches update the comparison doc in the gate stage).
- `docs/vxe-grid/DECISIONS.md` + `batch-ci-gate.md` were pre-existing dirty before this batch — left untouched.
