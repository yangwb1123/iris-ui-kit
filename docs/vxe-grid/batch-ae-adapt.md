Done. Committed as `69911b77` (+ react fix commit `70912a6d`).

## Report

Batch AE per `docs/vxe-grid/batch-ae-baseline.md`: virtual tree + detail mode for the react table, plus the four-framework vxe-grid example pages.

**Key baseline findings confirmed**: tree×virtual already worked (guard permitted it, `flatTree` feeds `virtualItems`); the real bugs were (a) flat+detail+virtual silently DROPPED expanded detail panels, (b) tree+detail+virtual blocked entirely, (c) the virtualizer's re-clamp fixed the DOM scrollTop but not the `scrollTop` state — a deep-scroll collapse could show a blank window until the browser's scroll event synced.

**Design decisions (documented in source)**: detail rows occupy ONE virtual slot each at `itemHeight` — content taller than the slot scrolls inside the detail cell (`overflow: auto`), keeping the virtual body uniform-height; `BodyPlanEntry` gains `kind: 'detail'` entries keyed `${rowKey}::detail`; expansion toggles flow through `expandedKeys → plan → items.length`, and the virtualizer rebuilds on count change + re-clamps (no scroll reset needed).

### Files changed — react fix + tests (commit 70912a6d, 5 files)

| File                                                             | Change                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/Table.tsx`                  | guard `virtualScroll && (!treeMode \|\| !hasDetail)` → `virtualScroll`; detail-aware `virtualItems` plan (`kind: 'detail'` slots); `::detail`-suffixed keys; `renderDetailSlot` (uniform slot, in-slot scroll) |
| `packages/react/src/primitives/virtual-scroll/VirtualScroll.tsx` | re-clamp effect → `useLayoutEffect` + syncs `scrollTop` state (pre-paint, no blank frame); fixed-mode window clamps stale scrollTop against the current total                                                  |
| `packages/react/src/primitives/table/virtual-tree.test.tsx`      | **new — 207 lines / 5 tests** (≤500 ✓)                                                                                                                                                                         |
| `packages/react/src/primitives/table/Table.test.tsx`             | old "tree+detail NOT virtualized" pin → asserts virtualization                                                                                                                                                 |
| `packages/react/src/primitives/table/test/advanced.test.tsx`     | second stale pin (same) → asserts virtualization                                                                                                                                                               |

### Files changed — four-framework example pages (commit 69911b77, 14 files)

| File                                                                                              | Change                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/cms/src/pages/VxeGridExamplePage.vue`                                                       | **new** — 5-section mirror (basic / row editing / server proxy / search form / row ops), inline server data + `remoteQuery` |
| `apps/cms-solid/src/pages/VxeGridExamplePage.tsx`                                                 | **new** — same mirror in solid JSX (`createSignal` row ops)                                                                 |
| `apps/cms-svelte/src/pages/VxeGridExamplePage.svelte`                                             | **new** — same mirror in svelte (`$state` row ops)                                                                          |
| `apps/{cms,cms-solid,cms-svelte}/src/menus.ts`                                                    | + `{ key: 'vxe-example', title: 'VxeGrid Example', icon: 'table', order: 8 }`                                               |
| `apps/cms/src/Shell.vue` · `apps/cms-solid/src/Shell.tsx` · `apps/cms-svelte/src/PageHost.svelte` | page map / route branch registration                                                                                        |
| `apps/{cms,cms-solid,cms-svelte}/src/pages/WorkspacePage.test.ts(x)`                              | menu-leaf contract test allowlists `vxe-example` (mirrors react's `dedicatedPluginRoutes`)                                  |
| `docs/vxe-grid/DECISIONS.md` · `batch-ae-baseline.md`                                             | batch-runner baseline log                                                                                                   |

Adaptation notes: the react page's `checkMethod` is a **React-only prop** (absent in vue/solid/svelte — verified by grep across the three packages) → the Row ops section uses local reactive rows for insert/remove and documents the difference in a comment; `tableRef.insertRow` also react/solid-only, so vue/svelte keep row ops purely local.

### Tests added (5)

virtual + tree windowed (spacer = itemCount × itemHeight, tree decoration intact) · expand increases itemCount + scroll preserved; external collapse (table handle) while scrolled deep re-clamps DOM scrollTop AND keeps the window non-blank · virtual + renderDetail renders detail slots (one slot per expanded row, slot right after its row; expand/collapse adds/removes exactly one slot) · tree + detail combo (previously blocked) · flat virtual unchanged.

### Counts

- `@iris-ui-kit/react`: typecheck **0 errors** · lint **0 errors** (1 pre-existing complexity warning, unchanged) · tests **162 files / 1828 pass** (514 in table+virtual-scroll suites)
- Apps: `cms` (vue) typecheck + build ✓ · `cms-solid` typecheck + build ✓ · `cms-svelte` typecheck (svelte-check 0/0) + build ✓ · app tests all pass
- `pnpm gen:manifest` regenerated → **no diff** (no public contract changes; commit's 155 components unchanged)
- `iris-ui-spec.py --mode all --json` → **0 violations**
- CSS: only `var(--iris-*)` tokens (no hex/Tailwind/CSS-in-JS added)
- core untouched (framework-free ✓); no dist/tgz/node_modules/manifest.json hand-edits

### Handoff list

1. **Four-framework guard alignment**: vue (`TableBody.ts` L52) / solid (`TableBody.tsx` L115) / svelte (`IrisTable.svelte` L1004 `useVirtual`) still carry the byte-identical `!treeMode || !hasDetail` guard — flat+detail+virtual there still drops panels and tree+detail is blocked. React now defines the reference semantics (detail slots + in-slot scroll + re-clamp state sync); the other three adapters should mirror the react plan/keyOf/renderItem changes in a follow-up batch.
2. **E2E for the new pages**: react has 3 vxe-example tests in `apps/cms-react/e2e/pages.spec.ts`; vue/solid/svelte pages are intentionally e2e-less this batch (CI runs the app e2e suites) — a follow-up can add `#vxe-example` navigations to each app's e2e.
3. **Example parity nuance**: the react page's row-ops section demonstrates `checkMethod` + `tableRef.insertRow/removeRow` (react handle extras); vue/solid/svelte mirrors use local-state row ops — a cross-framework `checkMethod`/handle-parity batch would close the gap.
