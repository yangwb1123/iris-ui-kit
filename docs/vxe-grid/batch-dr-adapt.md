Done. Working tree ready for commit.

## Report — 批 DR：单元格编辑快捷键（iris 独有）

The spec was already fully implemented at HEAD (landed in the `61ec5418`
adapter-alignment batch, recorded at DECISIONS.md:2748); this session verified
every baseline anchor, then closed baseline observation ② (`editKeys={[]}`
boundary) and the DR-specific halves of ① (F2 保留 / Space 三写匹配 / 无
`keyboardNavigation` 惰性 / 非可编辑列拦截) with dedicated cases in the same
suite.

**Spec → code anchors (all verified at HEAD):**

| Anchor | Location                                                                                                                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prop   | `props/editing.ts:234` — `editKeys?: Array<'F2' \| 'Enter' \| 'Space'>`, single-line literal union (manifest hygiene), default `undefined` (opt-in; absent → AN `tableShortcuts` F2 path)                                                                                          |
| gate   | `Table.tsx:4399-4416` `handleConfiguredEditKey` — needs `keyboardNavigation` roving focused-cell; editor-already-open / non-grid target / `!col.editable` / formula / locked / readonly → return; `preventDefault()` + `beginEdit(...)` via the shared `cellEdit.startEdit` funnel |
| match  | F2 `e.key==='F2'` / Enter / Space 三写匹配（`' '`/`'Spacebar'`/`code==='Space'`）; `!matches && e.key !== 'F2'` → return — F2 always retained, config only extends                                                                                                                 |
| mount  | root onKeyDown chain首分派 + `defaultPrevented` 短路 (`Table.tsx:8078/8082-8083`) — opted-in Enter opens the editor instead of `handleGridKey`'s Enter=ArrowDown                                                                                                                   |
| test   | `test/batch-dl-dt.test.tsx` — original 376-386 case + 4 new cases below                                                                                                                                                                                                            |

**Files changed (this session):**

| File                                                            | Change                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/react/src/primitives/table/test/batch-dl-dt.test.tsx` | +4 DR cases + `focusCell` helper; file 423 → 464 lines ≤500 ✓ |
| `docs/vxe-grid/batch-dr-adapt.md`                               | Adapt report (this file)                                      |
| `docs/vxe-grid/DECISIONS.md`                                    | Batch record appended                                         |

`gen:manifest` regenerated with **zero diff** (155×4 components / 86 tokens —
source unchanged; test-only change doesn't touch the scanner's `publicTypes` /
prop-record surface). `check:manifest` remains up to date.

**Tests added (+4, `batch-dl-dt.test.tsx`):**

1. `DR keeps F2 available when editKeys are configured` — `editKeys={['Enter']}` + F2 keyDown → editor opens (F2 保留断言)
2. `DR starts editing on Space (key + code three-way match)` — `editKeys={['Space']}` + `{ key: ' ', code: 'Space' }` → editor opens
3. `DR with an empty editKeys list keeps only F2 (Enter inert)` — `editKeys={[]}`: Enter no-op, F2 still opens (observation ②)
4. `DR is inert without keyboardNavigation and on non-editable columns` — no `keyboardNavigation` → Enter inert; non-editable column → F2 inert

**Verification counts:**

- core test **1597/1597** (104 files) — core untouched, framework-free invariant held (`grep`-verified zero framework imports in core)
- react typecheck **clean** · react test **2826/2826** (246 files; batch-dl-dt **21/21**)
- react lint **0 errors** (2 pre-existing Table.tsx complexity warnings, not DR-introduced)
- `iris-ui-spec.py --mode all --json` → **0 violations**
- `gen:manifest` → regenerated (zero diff, committed)

**What is left:** locked/readonly/formula guard branches are shared with the AN F2 path and already exercised in `locked-cells`/`cell-permission`/`Table.shortcuts` suites — not re-asserted here. Observation ③ (DR F2 shadows AN F2 first-handler-wins when `editKeys` + `tableShortcuts` coexist) is behavior-identical to AN alone and left untested by design; DR's F2 is hard-coded and unaffected by BG keymap rebinding. `editKeys` stays react-only per batch scope (spec offers it react-side only; core untouched).
