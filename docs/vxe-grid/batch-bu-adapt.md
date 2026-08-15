Batch BU complete and committed (`d892160d`). Remaining uncommitted files (`DECISIONS.md`, `batch-bt-gate.md`) are pre-existing pipeline state from the prior gate stage — untouched.

## Report

**Batch BU: 表格水印 `watermark`（iris 独有）** — implemented per baseline, zero drift.

### Files changed (4 + tests)

| File                                            | Change                                                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`  | +1 `watermark?: string` (after `showFooterOverflow`, before `style`; single-line JSDoc)                                                                                                |
| `packages/react/src/primitives/table/Table.tsx` | 4 touches: destructure · module helper `renderTableWatermark` + `WATERMARK_TILE_COUNT` · root `position: relative` forced after `...style` · overlay JSX after `{renderFooterStack()}` |
| `packages/react/src/primitives/table/styles.ts` | +2 token-only constants: `WATERMARK_OVERLAY_STYLE` / `WATERMARK_TILE_STYLE`                                                                                                            |
| `test/watermark.test.tsx` (new)                 | **10 tests, 156 lines** (≤500)                                                                                                                                                         |
| `manifest.json` + `llms.txt`                    | regenerated — propCount **160→161**, eventCount 30 unchanged                                                                                                                           |
| `docs/vxe-grid-comparison.md`                   | 3 places: 独有表行 / 构建状态 / 测试计数 (2296→2306)                                                                                                                                   |
| `docs/vxe-grid/batch-bu-adapt.md` (new)         | this report                                                                                                                                                                            |

### Implementation

- Absolute-positioned rotated layer `data-iris-watermark` **embedded in the root** (not wrapping — wrapper would break fixed-height scroll container/sticky header); 72 tiled `data-iris-watermark-tile`, `rotate(-22deg)`, `var(--iris-muted)` token color, opacity 0.15, `--iris-space-xl`/`--iris-font-size-lg` token values, `aria-hidden` + pointer-events/user-select none.
- Root anchored `position: relative` after `...style` (caller style can't unanchor; zoom `position: fixed` still wins). Layer sits above static rows/footer/pager, below sticky header z2 / pinned z1 / floating panels; fixed-height anchors to scroll viewport.
- Empty string / no prop = presence-gated zero nodes; rerender updates every tile.

### Tests added (10)

① no-prop zero nodes · ② renders text (72 tiles) · ③ aria-hidden + non-interactive · ④ rotate(-22deg) + token color/size · ⑤ relative anchor survives caller style override · ⑥ empty-string gate · ⑦ rerender updates + prop-drop zero nodes · ⑧ zoom coexistence · ⑨ fixed-height coexistence · ⑩ pure display (tiles inert, layer inside root)

### Verification — all ✅

- core test **1517/1517**
- react typecheck **clean** · react test **2306/2306** (+10) · react lint **0 errors** (1 pre-existing complexity warning)
- spec `--mode all` **0 violations**
- `gen:manifest` regenerated + `check:manifest` up-to-date · prettier clean

### Left

Runner's pending review/gate stage; vue/solid/svelte alignment deferred (react-only scope — standalone `IrisWatermark` primitive already exists in all four frameworks).
