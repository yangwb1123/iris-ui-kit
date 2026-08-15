All verification green and committed as `19919b36`. Final report:

## Batch BX complete — committed `19919b36`

**`feat(table): grid 批 BX——列固定快捷切换（iris 独有）`** — 列头右键菜单内置项：固定左 / 取消固定。

### Files changed (4 source + test + docs, 10 files)

| File                                                                      | Change                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/i18n.ts`                                               | +2 en keys: `table.pinLeft` "Pin left" · `table.unpin` "Unpin"                                                                                                                                                 |
| `packages/plugin-locale-zh/src/core/index.ts`                             | +2 zh keys: `固定左` · `取消固定` (drift test auto-covers)                                                                                                                                                     |
| `packages/react/src/primitives/table/props.ts`                            | +3 JSDoc props after `columnWidthsReset` (inline types — no new named type, 4-file budget held)                                                                                                                |
| `packages/react/src/primitives/table/Table.tsx`                           | 2 reserved-key consts · 3 props · pin state block · pin menu state + `handleHeaderContextMenu` · menu swap in body handler · 4 `col.pinned` funnels → `pinOf` · flat + grouped header wiring · pin menu render |
| `packages/react/src/primitives/table/test/pin-column-menu.test.tsx` (new) | **17 tests, 333 lines** (≤500)                                                                                                                                                                                 |
| `docs/vxe-grid-comparison.md`                                             | 3 places: 独有表 row · 构建状态 line · 测试计数                                                                                                                                                                |
| `docs/vxe-grid/batch-bx-adapt.md` + `batch-bx-baseline.md` (new)          | report + baseline                                                                                                                                                                                              |
| `packages/manifest/manifest.json` + `llms.txt`                            | regenerated — propCount **162→165** / eventCount **30→31**                                                                                                                                                     |

### Implementation highlights

- **`pinOf(col)` single throat** — controlled `pinnedColumns` map (null overrides static) → internal `pinsInternal` (uncontrolled) → static `col.pinned` seed; replaces all `col.pinned` read sites.
- **Dual channel** (`onColumnWidthsChange` precedent): `onColumnPinnedChange` fires unconditionally; uncontrolled flips immediately, controlled never optimistically flips.
- **Decoupled from `contextMenu`**: independent `columnPinMenu` prop (works with no contextMenu), separate floating instances — opening one closes the other (exactly one `data-iris-table-context-menu` in DOM).
- Menu items single + mutually exclusive by current state (pinned left OR right → 取消固定; spec has no pin-right item). Right-click zero side effects (no sort / no `onHeaderClick`).
- Grouped leaf headers now get pinned visual (closes prior flat/grouped asymmetry); group cells never pin.

### Verification (all ✅)

- core test **1517/1517** · react typecheck **clean** · react test **2361/2361** (+17) · react lint **0 errors** (1 pre-existing complexity warning) · zh plugin **6/6** · manifest **69/69**
- `iris-ui-spec.py --mode all` → **0 violations** (1415 files) · prettier clean · `gen:manifest` regenerated + committed

### What is left

- Runner's pending **review/gate** stage (per the established pattern).
- vue/solid/svelte alignment deferred — react-only scope by design (pure react-side header menu extension, zero core logic beyond i18n keys).
