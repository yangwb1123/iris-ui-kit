All done. Final report:

## Batch AF — complete

The previous session timed out mid-work; I audited every leftover change, fixed what was broken (7 files were not prettier-clean), completed missing pieces, and verified everything.

### Files changed (23)

**1. Excel styling (core, additive)**

- `packages/core/src/table-export.ts` — `toSpreadsheetXml` new options: `headerStyle?: boolean` (emits `<Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles>` + `ss:StyleID="Header"` on header cells only) and `columnWidths?: number[]` (`<Column ss:Width>` in points, 5.25pt/char, clamped to column count, non-finite/non-positive skipped). Default output is byte-identical (locked by test).
- `packages/core/src/table-export.test.ts` — **+6 tests** (byte-compat lock / headerStyle / widths conversion / clamp / skip invalid / combined)
- `packages/react/src/primitives/table/Table.test.tsx` — **+1 test** (react `exportExcel` forwards options; the adapter already passed `options` through verbatim → **zero adapter changes**, verified untouched)
- `packages/react/src/primitives/table/Table.tsx` — kept the failed session's cross-framework parity fix: react `IrisTable` grid tracks for `rowDrag`/`seq` were missing (seq column wrapped to a second line, react-only). Load-bearing for the parity screenshots (example page uses seq). All react tests pass.

**2. e2e specs (3 new, one per app; 3 tests each, 79–81 lines)**

- `apps/cms/e2e/vxe-grid.spec.ts` (vue), `apps/cms-solid/e2e/...`, `apps/cms-svelte/e2e/...` — mirror the react `pages.spec.ts` vxe tests: parity login flow (Username→ada→Sign in→Dashboard), menu navigation via `[data-iris-nav-item]` + "VxeGrid Example" (attribute verified emitted by all 4 frameworks), 4 sections render, proxy section waits for Test1 (8s timeout, 400ms delay), pagination shows 6 pages, form search filters to Test2 only. Improvements over react: proxy assertions **scoped to the 服务端数据源 section** (react's `.last()` resolves to the 5th table); svelte row-edit uses `dblclick()` (verified: svelte `IrisTable.svelte` has no `editConfig.trigger` support).
- **Not run** per instruction — compile-verified via `playwright test --list` (9/9 discovered). **React pattern confirmed live: 3/3 vxe e2e pass.**

**3. Visual parity (included cheaply — decision: no skip)**

- All four `visual-parity.spec.ts` got a `vxe example` describe (`vxe-{light,dark}`, 1280×2000 viewport to fit the ~1913px page — deliberately no `fullPage` due to the documented sticky-header trap; waits for the 400ms proxy data before screenshotting; same tolerances vue 0.05 / others 0.02) + **8 baseline PNGs** (4 apps × 2 themes, 1280×2000, react-generated). The existing per-app parity runner was extended; react's curated `visual.spec.ts` left untouched.

**4. Docs** — `docs/vxe-grid/batch-af-adapt.md` (report), `DECISIONS.md` + entry, `vxe-grid-comparison.md` (AF paragraph + table row + handoff-line/count updates).

### Verification

| Gate                                | Result                                                 |
| ----------------------------------- | ------------------------------------------------------ |
| core test                           | 81 files / **1255 tests** ✓                            |
| react typecheck                     | ✓                                                      |
| react test                          | 162 files / **1829 tests** ✓                           |
| react lint                          | **0 errors** (1 pre-existing complexity warning)       |
| react e2e (vxe, local)              | **3/3 pass**                                           |
| new specs compile                   | `--list`: vue 10 / solid 9 / svelte 9 tests discovered |
| prettier / `git diff --check`       | clean                                                  |
| `iris-ui-spec.py --mode all --json` | **0 violations / 1405 files**                          |

No dist/tgz/node_modules/manifest.json touched; core stays framework-free (pure XML string building, no new deps); test files all ≤500 lines.

### What is left

1. The three new specs run per-app via `pnpm e2e` (same pattern as the pre-existing visual-parity specs; CI's mainline playwright step only runs the cms-react suite — unchanged, consistent with prior batches).
2. Batch AE handoff: vue/solid/svelte virtual-tree combo guards (`TableBody.ts:52` / `TableBody.tsx:115` / `IrisTable.svelte useVirtual`) still old semantics.
3. `headerStyle`/`columnWidths` not yet exposed through the ProTable toolbar export button (additive opportunity for a later batch).
