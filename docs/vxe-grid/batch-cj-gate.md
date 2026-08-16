Gate complete. Working tree clean.

## ✅ Batch CJ Gate — PASS

**Review verdict**: PASS (`docs/vxe-grid/batch-cj-review.md` — 0 MAJOR / 0 MEDIUM; 1 P3 + 1 P4 info). **P3 fixed in this gate**: `props.ts` `shortcutHints` JSDoc — `*/` moved to its own line per the `charCount` precedent, so the generated manifest description no longer truncates at `…Additive; default` — regenerated manifest now carries the full fail-closed ending `Additive; default off (fail-closed).` (verified in both manifest.json occurrences).

**Gate results:**

| Step                                                                   | Result                                                                                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (4m29s, 54 cached)                                                                                                                      |
| `audit:security`                                                       | **0 vulnerabilities** (No known vulnerabilities found)                                                                                                               |
| `gen:manifest` + `check:manifest`                                      | **up to date** — 155 components × 4 frameworks, 86 tokens, propCount **170** / eventCount **31**; the only manifest diff is the P3-fixed `shortcutHints` description |
| `gen:docs-reference` + `check:docs-reference`                          | up to date (components.md / iris-tokens.css / explorer-data.ts)                                                                                                      |
| `iris-ui-spec.py --mode all --json`                                    | **0 violations** (1416 files)                                                                                                                                        |
| Framework-free invariant                                               | core 0 framework imports                                                                                                                                             |
| Comparison doc                                                         | `docs/vxe-grid-comparison.md` updated — iris 独有 section (`表格快捷键提示 shortcutHints` row) + 构建状态 paragraph (批 CJ entry)                                    |

**Final test counts:**

- **react: 2492/2492** (11 new shortcut-hints tests, 2481→2492)
- **core: 1548/1548** (6 new `formatKeyBinding`/`formatKeyBindings` tests, 1542→1548)
- manifest propCount 170 / eventCount 31 · spec 0 violations · audit 0

**Commit**: `9a1dacb4` (adapt stage) carried the implementation (11 files, +528/−4: core `keymap.ts` 2 formatters + i18n + barrel, `ShortcutHintsPanel.tsx` + `Table.tsx` + `props.ts` + 11 react tests, plugin-locale-zh +9, manifest 169→170). This gate commit folds the accumulated docs + the P3 JSDoc fix + the regenerated manifest description: `props.ts` (JSDoc), `manifest.json` (full description), comparison doc (iris 独有 `shortcutHints` row + 构建状态 批 CJ entry), DECISIONS.md (gate log), batch-ci-gate.md (CI gate final polish), and the CJ stage docs (baseline/adapt/review/gate).

## Implementation recap

`shortcutHints?: boolean` (after `charCount`) — vxe has zero shortcut-help UI. Toolbar `?` trigger (`data-iris-shortcut-hints-trigger`, after the perf trigger) opens a floating `ShortcutHintsPanel` (AuditPanel pattern: useFloating bottom-end + portal, Esc/outside/scroll close, trigger exempt) listing all 8 built-in shortcuts with their **effective** keys (F2 / Delete·Backspace / Ctrl+Z·Ctrl+Y(+Shift+Z) / Ctrl+C / Ctrl+V / Ctrl+D / Ctrl+K; i18n `table.shortcuts` header + 8 action labels en+zh, full coverage + placeholder parity). **Single source of truth**: the panel consumes the same `keyBindings` memo all 8 handlers match against — `keymap` remaps reflect live, invalid overrides fail-closed to defaults, a listed key always actually works. Read-only reference (no rebind UI), additive, default off. Core: 2 framework-free pure formatters (`formatKeyBinding` modifier order + Space/uppercase display, `formatKeyBindings` `' / '` join). core 6 + react 11 new tests; manifest propCount 169→**170**, events 31 / tokens 86 unchanged; vue/solid/svelte untouched.
