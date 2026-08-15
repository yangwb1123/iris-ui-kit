Verdict written to `docs/vxe-grid/batch-bg-review.md`. Summary:

## Verdict: **FAIL** (1 medium finding, 2 low, 1 nit)

**Verification (all run fresh, all green):**

- core test 1469/1469 · core typecheck clean
- react test 2150/2150 · react typecheck clean · react lint 0 errors (1 pre-existing complexity warning)
- `pnpm audit:security` 0 vulnerabilities
- `check:manifest` up to date (propCount 148→149, `keymap` react-only in frameworkContracts)
- spec validator `--mode all`: 0 violations (1414 files)
- core framework-free (no framework imports in `core/src`) · zero CSS/token changes · additive-only commit (no dist/tgz committed)

**Findings:**

1. **[MEDIUM] Table.tsx:7102–7113** — the new `fill`/`query` branches in the root onKeyDown lack the editing/text-control guards that every sibling shortcut path has (`handleTableShortcutKey`:4269, undo listener:4417–4426, clip listener:4452–4459). **Empirically confirmed** with a scratch vitest probe: with `rangeFill` + a live range, pressing Ctrl+D inside an open F2 editor commits a fill (`onDataChange` fires, data mutates) under the uncommitted draft, and Ctrl+K steals focus and closes the session. Fix: add `if (editTarget.editing !== null || rowEditing !== null) return` before the branches + regression test.
2. **[LOW] Table.tsx:4277,4284** — exact-match tightening also silences legacy modifier combos (Shift+Delete, Ctrl+F2, …) beyond the two the adapt doc enumerates; intended per baseline but under-documented.
3. **[LOW] keymap.ts:41** — `TABLE_KEY_ACTIONS` "handler-arbitration order" comment overstates its role (arbitration is by wiring order).
4. **[NIT] Table.tsx:4403** — `keyBindings` memo churns with inline `keymap`, re-registering window listeners per render.

No implementation files were modified; scratch probe files were removed.
