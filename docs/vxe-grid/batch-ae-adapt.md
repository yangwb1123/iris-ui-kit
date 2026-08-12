All done. Working tree clean, 3 commits, all gates green.

## Report — batch AE complete

### Commits

1. **`70912a6d`** `feat(table): vxe-grid 批 AE——虚拟树/详情行修复（react）+ 滚动收缩重钳制`
2. **`69911b77`** `feat(cms): vxe-grid 批 AE——vue/solid/svelte 四框架示例页`
3. **`fe56af31`** `chore: 批 AE 收尾（adapt 报告）` (`docs/vxe-grid/batch-ae-adapt.md`)

### 1. Virtual tree fix (react, 5 files)

- **Table.tsx**: guard `virtualScroll && (!treeMode || !hasDetail)` → `virtualScroll` (all 4 flat/tree×detail combos). `BodyPlanEntry` gains `kind: 'detail'`; `virtualItems` plan inserts one detail slot per expandable+expanded row at `itemHeight` (content taller than the slot scrolls **inside** the detail cell — documented); keys `::detail`-suffixed; new `renderDetailSlot`.
- **VirtualScroll.tsx** (itemCount-change decision, documented in source): no scroll reset needed — the virtualizer rebuilds on `items.length` change, core re-clamps, and the re-clamp effect now **syncs the `scrollTop` state in a layout effect** (pre-paint, no blank frame) plus the fixed-mode window clamps stale scrollTop against the current total.
- **Tests**: new `virtual-tree.test.tsx` (5 tests, 207 lines ≤500): flat unchanged · tree windowed with decoration · expand grows itemCount + preserves scroll; external collapse while scrolled deep re-clamps DOM **and** keeps window non-blank · detail slots (one per expanded row, expand/collapse ±1 slot) · tree+detail combo (previously blocked). Updated 2 stale pins in Table.test.tsx / advanced.test.tsx.

### 2. Four-framework examples (14 files)

- **New pages** in `apps/cms` (vue), `apps/cms-solid`, `apps/cms-svelte`: `VxeGridExamplePage` — 5 sections mirroring the react page (basic / row editing / server proxy / search form / row ops), self-contained inline data + `remoteQuery`.
- Menu entry `vxe-example` (order 8) + Shell/PageHost registration in each app; menu-leaf contract tests allowlist the key.
- Adaptation: `checkMethod`/`tableRef.insertRow` are **react-only** (verified by grep) → row ops use local reactive state, noted in comments.

### Verification

- react: typecheck ✓ · lint **0 errors** (pre-existing complexity warning unchanged) · **1828 tests pass**
- apps: vue/solid/svelte typecheck ✓ + build ✓ + tests ✓ (e2e intentionally skipped for the new pages)
- `iris-ui-spec.py --mode all --json` → **0 violations**
- `pnpm gen:manifest` → regenerated, **no diff** (no public-contract change; nothing to commit)
- core untouched; only `--iris-*` tokens in added CSS; ≤4 react source files + tests

### What is left (handoff in adapt doc)

1. **Four-framework guard alignment**: vue `TableBody.ts` L52 / solid `TableBody.tsx` L115 / svelte `IrisTable.svelte` `useVirtual` still carry the old guard — flat+detail+virtual drops panels and tree+detail stays blocked there; react now defines reference semantics for a follow-up batch.
2. E2E `#vxe-example` navigation for vue/solid/svelte (react already has 3).
3. Cross-framework `checkMethod`/handle parity (react-only today).
