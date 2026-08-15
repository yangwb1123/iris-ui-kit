Baseline complete. Deliverable: **`/home/u1/iris-ui/docs/vxe-grid/batch-bg-baseline.md`** (207 lines) — the only file created (`git status` confirms the pre-existing BE-stage `M`/`??` entries untouched; zero source files modified).

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Core** — new `packages/core/src/keymap.ts`: `IrisTableKeyAction` union (8 actions), `DEFAULT_TABLE_KEYMAP` (string form), `normalizeKeymap(overrides?)` (per-action wholesale merge + alias expansion: clear=`[delete, backspace]`, redo=`[ctrl+y, ctrl+shift+z]`), `matchTableKey` (pure, framework-free). Invalid keys (`''`, `'Meta'`, `'Ctrl+'`, whitespace…) dropped fail-closed → action keeps default. Exact modifier matching — `Ctrl+Shift+Z` hits redo, never undo; `Ctrl` = ctrl-or-meta (byte-identical to today's `const mod`).
- **React** — `keymap?: Partial<Record<...>>` prop in props.ts after `tableShortcuts` (:384); Table.tsx wires `keyBindings = normalizeKeymap(keymap)` memo into the 4 existing hardcoded key sites (F2/Delete at :4272/:4278, undo branch :4414, clip branch :4452) plus **2 new defaults**: `Ctrl+D` fill (one-step drag-down via the existing `fillRangeFromHandle` pipeline :4600 — zero new mutation logic) and `Ctrl+K` query-input focus (new `queryInputRef` at :6394). All feature-flag gates unchanged (additive).
- **6 fiats** for gate arbitration: new fill/query defaults are strictly gated; exact-match tightening (alt+Ctrl+Z inert); wholesale alias replacement; collision = first handler wins; invalid ⇒ default retained; keymap never enables a disabled feature.

**File map**: 2 new core files + 1 new react test file + 3 edits (core index, props.ts, Table.tsx) + manifest regeneration (propCount 148→149). Untouched: types.ts, vue/solid (no keyboard parity exists), i18n, RangeToolbar, existing shortcut test files.

**Test plan**: 8 core unit cases (default map, merge, alias kill, 11 invalid-key forms, case normalization, exactness, ctrl-or-meta, shift/alt flags) + 9 react integration cases (defaults regression, overrides per action, invalid ignored, feature gates ×5, exactness, window-guard hold), with existing `Table.shortcuts`/`undo-batch-edit`/`clip-fnr` suites as the default-bindings regression net.
