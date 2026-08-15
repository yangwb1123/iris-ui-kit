Gate stage complete — verdict **FAIL → FIXED → PASS** (all 4 review findings addressed).

## Review findings → fixes

1. **[MEDIUM] editing guard** (`Table.tsx` root onKeyDown): added `if (editTarget.editing !== null || rowEditing !== null) return` before the fill/query branches (mirrors `handleTableShortcutKey`/undo/clip gates) — Ctrl+D can no longer fill under an uncommitted draft, Ctrl+K no longer steals focus mid-session. **Regression test added** (`keymap.test.tsx` "editing guard: Ctrl+D / Ctrl+K never run while an inline editor is open").
2. **[LOW] legacy modifier combos under-documented**: `handleTableShortcutKey` comment now documents that exact-match tightening makes Shift+Delete / Ctrl+F2 / Ctrl+Shift+Backspace … inert by design (per BG baseline).
3. **[LOW] keymap.ts `TABLE_KEY_ACTIONS` comment**: corrected — the array is canonical normalization iteration order, NOT handler arbitration (arbitration is by wiring order / `preventDefault`).
4. **[NIT] `keyBindings` memo churn**: memoized on the JSON serialization of `keymap` (parse-back), so inline `keymap={{…}}` literals don't re-register the window undo/clip listeners per render. Lint-clean (`exhaustive-deps` satisfied, prettier clean).

## Results

**Gate** (all run fresh, after fixes): `turbo run test typecheck lint build` → **180/180 tasks successful** · `pnpm audit` → **0 vulnerabilities** · `gen:manifest` + `check:manifest` → up to date (manifest unchanged — prop surface untouched, internal wiring only; propCount 149, `keymap` react-only) · prettier clean on all touched files.

**Final test counts**: core **1469** · react **2150** (191 files; keymap suite now 11 tests incl. editing-guard regression) · vue 1531 · solid 974 + 34 hydration · svelte 916 + 31 hydration.

**Doc**: `docs/vxe-grid-comparison.md`「iris 独有」row `快捷键自定义 keymap` updated — review fixes documented (editing guard, legacy-combo deviation, stable memo), test count 12+10 → 12+11.

## Commit

```
5e69585d
feat(table): grid 批 BG——快捷键自定义（iris 独有）
```

7 files, +114/−38, working tree clean (`.vinxi` excluded).
