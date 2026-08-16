Baseline complete. Zero source files touched — `git status` shows only the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-ci-gate.md`) plus the new baseline; HEAD `b2579454`.

## Baseline essence (batch CJ：表格快捷键提示 — iris 独有)

**Design** — `shortcutHints?: boolean` (additive, fail-closed), one floating panel, two core pure formatters, 9 i18n keys:

- **Prop** (`props.ts:411` after `charCount`) → manifest **169→170**; admitted to the toolbar gate at `Table.tsx:8284` like `undo`/`chartPreview` (the prop alone renders the toolbar).
- **Trigger** — `?` button (`data-iris-shortcut-hints-trigger`) after the perf trigger, aria/title = `t('table.shortcuts')`, chart/audit toggle precedent.
- **Panel** — NEW `ShortcutHintsPanel.tsx` (AuditPanel pattern: `useFloating` bottom-end + portal, Esc/outside/scroll close, trigger exempt from outside-close). Lists all 8 actions in core `TABLE_KEY_ACTIONS` order: label `t('table.shortcuts.<action>')` + formatted effective keys.
- **Single source of truth** — the panel consumes the table's `keyBindings` memo (`Table.tsx:6239`): the _same_ normalized map every handler matches against (defaults + keymap overrides, invalid overrides fail-closed), so the panel can never show a key that doesn't actually work; remaps reflect live via the `keymapJson` memo.
- **Core** `keymap.ts` +2 framework-free formatters: `formatKeyBinding` (modifier order `Ctrl+`/`Shift+`/`Alt+`, `' '`→`'Space'`, case-normalized, `Cmd`→`Ctrl+` shared flag) and `formatKeyBindings` (`' / '` join, empty→`''`).
- **i18n** — 9 keys (header + 8 action labels), EN in core `defaultMessages` + zh in `plugin-locale-zh`, landed together (zh parity test gates full coverage + placeholder parity).
- **Scope cuts**: no per-feature gating (BG's "keymap never enables a disabled feature" constrains handling, not the reference list — gating would plumb 5 flags into the panel); read-only reference, no rebind UI; zero new style tokens/types/events.

**Test plan** — react NEW `shortcut-hints.test.tsx` (~2481→2492): ①渲染 fail-closed/gate/open + ②映射列表: default 8-action list with exact keys (`F2` / `Delete / Backspace` / `Ctrl+Z` / `Ctrl+Y / Ctrl+Shift+Z` / `Ctrl+C` / `Ctrl+V` / `Ctrl+D` / `Ctrl+K`), override reflection (wholesale, Backspace alias gone), invalid-override fail-closed, close paths, zh labels, live remap; core `keymap.test.ts` +formatting (~1542→1547); CI gates zh parity, manifest 169→170, docs reference, existing keymap/shortcuts/query suites stay green.
