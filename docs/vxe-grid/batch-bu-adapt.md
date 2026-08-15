Done. Batch BU complete — implementation + full verification, all gates green.

## Report

### Files changed (4 source/doc + tests)

| File                                                                | Change                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                      | +1: `watermark?: string` (after `showFooterOverflow`, before `style` — single-line JSDoc, manifest scanner clean)                                                                                                                                                                                                                         |
| `packages/react/src/primitives/table/Table.tsx`                     | 4 touches: destructure + module helper `renderTableWatermark`/`WATERMARK_TILE_COUNT` (IrisWatermark TILE_COUNT/attr precedent) + root style `position: relative` after `...style` (caller style can't unanchor; zoom fixed still wins) + overlay JSX after `{renderFooterStack()}` (below sticky header z2 / pinned z1 / floating panels) |
| `packages/react/src/primitives/table/styles.ts`                     | +2 constants: `WATERMARK_OVERLAY_STYLE` (absolute inset-0, pointer-events/user-select none, space-xl gap, opacity 0.15) + `WATERMARK_TILE_STYLE` (rotate(-22deg), font-size-lg, `--iris-muted`)                                                                                                                                           |
| `packages/react/src/primitives/table/test/watermark.test.tsx` (new) | 10 tests, 156 lines (≤500)                                                                                                                                                                                                                                                                                                                |
| `packages/manifest/manifest.json` + `llms.txt`                      | regenerated — propCount **160→161**, eventCount 30 unchanged                                                                                                                                                                                                                                                                              |
| `docs/vxe-grid-comparison.md`                                       | 3 places: 独有表行 (`watermark` row after `selectionDrag`) / 构建状态 (批 BU appended) / 测试计数 (2296→2306)                                                                                                                                                                                                                             |
| `docs/vxe-grid/batch-bu-adapt.md` (new)                             | this report                                                                                                                                                                                                                                                                                                                               |

### Implementation (baseline zero-drift)

- `watermark?: string` — **绝对定位旋转层** `data-iris-watermark` 嵌入根内（**非包裹根**——wrap 会破坏 fixed-height 滚动容器/sticky 表头，文档化分歧），72 平铺 tile `data-iris-watermark-tile`、`rotate(-22deg)`、`color: var(--iris-muted)`（token 色）、opacity 0.15、`var(--iris-space-xl, 24px)` gap / `var(--iris-font-size-lg, 16px)` fontSize（uispacing 干净）、`aria-hidden` + `pointer-events`/`user-select` none
- 根锚定：`...style` 后强制 `position: relative`（zoom 健壮性先例——caller style 不能拆锚；zoom `position: fixed` 仍赢，水印随覆盖层）
- 层插在 `{renderFooterStack()}` 后、浮动面板块前：盖静态行/表尾/分页器，低于 sticky 表头 z2、固定列 z1、浮动面板 popover 1000；fixed-height 下锚视口、随行滚动不动
- 空串/无 prop = presence 门控零节点（零成本）；rerender 逐 tile 更新文本

### Tests added (10)

① 无 prop 零节点 · ② 渲染含文本（72 tile） · ③ aria-hidden + 不可交互（pointer-events/user-select none） · ④ rotate(-22deg) + token 色 + token 字号 · ⑤ 锚定相对（含 caller `style={{ position: 'static' }}` 覆盖） · ⑥ 空串 presence 门控 · ⑦ rerender 更新 + 去 prop 零节点 · ⑧ zoom 共存（fixed 覆盖层 + tile 存活） · ⑨ fixed-height 共存（layer 锚滚动容器根 inset-0） · ⑩ 纯展示（tiles 无 role/tabindex，层嵌入根内）

### Verification — all ✅

- core test **1517/1517** · react typecheck **clean** · react test **2306/2306** (+10) · react lint **0 errors** (1 pre-existing complexity warning, same as batch BT) · spec `--mode all` **0 violations** · `gen:manifest` regenerated + `check:manifest` up-to-date · prettier clean on all touched files

### Left

Runner's pending review/gate stage; vue/solid/svelte alignment deferred (react-only scope per spec — standalone IrisWatermark primitive already exists in all four frameworks); pre-existing `DECISIONS.md`/`batch-bt-gate.md` modifications left untouched (not this batch's content).
