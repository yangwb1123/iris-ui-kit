All green. Batch CQ complete.

## Report — 批 CQ：编辑实时预览（iris 独有）

### Files changed (1 commit)

| File                                                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                   | `editPreview?: boolean` 单行 prop（`charCount` 之后；propCount 176→177，scanner 单行解析成功，具名 `IrisTableProps` 接口不变）                                                                                                                                                                                                                                                                                                                                                           |
| `packages/react/src/primitives/table/styles.ts`                  | `EDIT_PREVIEW_STYLE` 新常量（`data-iris-edit-preview` 宿主：`--iris-font-size-xs`/`--iris-muted`/`--iris-space-xxs` gap、`pointer-events: none` 纯展示、ellipsis 截断——token-only 零硬编码）                                                                                                                                                                                                                                                                                             |
| `packages/react/src/primitives/table/Table.tsx`                  | `EditorSurfaceProps` +`editPreview?`/`row` 两 prop（row = formatter 第二参）· 模块级 `editPreviewDraft` 纯 helper（commit 同款强转：select 解析 typed option / number `Number()`+非法回落 `getCellValue` / text/textarea 直通）· `EditorSurface` destructure + 预览节点（编辑器之后、校验错误之前——既有错误槽位，`editPreview && col.formatter` 双门控，`applyCellMask` 掩码 → `col.formatter` 镜像提交格显示链）· Table destructure + 两调用点传 `editPreview`/`row`（cell+row 双模式） |
| `packages/react/src/primitives/table/test/edit-preview.test.tsx` | NEW — **13 tests, 257 lines**（≤500 ✓）                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/manifest/{manifest.json,llms.txt}`                     | regenerated：propCount **176→177**、eventCount 31 不变、155×4 组件不变                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/vxe-grid-comparison.md`                                    | 「iris 独有」节 批 CQ 行 + 构建状态尾部追加                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Tests added (13)

预览渲染（首值）· 实时增长更新 · 实时缩减（删字到空）· 无 formatter 不显示（规格第二门）· fail-closed 默认（有 formatter 无 prop 不显示）· 掩码先行（formatter 收 MASKED 值）· row-aware formatter（收到被编辑行）· number 编辑器强转（`25.55` → `25.6`，formatter `.toFixed` 永不崩在字符串草稿）· select 编辑器 typed 值（`num:1` 非 `str:1`）· textarea 换行保留 · row 模式每开编辑器一预览（3 个、city 无 formatter 不显示）· Enter 提交拆除 · Escape 取消拆除零提交 · muted-token 样式断言 + 与校验错误共存（DOM 顺序：预览在错误之前）

### Verification (all ✅)

- core test **1559/1559**（core 零改动，框架无关 intact）· react typecheck **clean**
- react test **2569/2569**（2556→+13）· react lint **0 errors**（1 条既有 IrisTable complexity 警告，与 HEAD 相同）
- spec script **0 violations** · `pnpm gen:manifest` 重新生成（propCount 176→**177**，events 31 不变）

### Deviation from baseline

1. **测试数 +13 而非 +12**：基线「+12 (2556→2568)」的算术与它自己的枚举（预览渲染/实时更新/无 formatter 门/fail-closed/掩码/row-aware/row 模式/select+textarea/commit+Escape 拆除/样式+错误共存 = 13 项）不一致——实现按枚举逐项覆盖，13 测试 2569。
2. **草稿强转（`editPreviewDraft`）**：基线公式为裸 `col.formatter(applyCellMask(draft, col), row)`（draft = `String(state.draft)`）。核查发现 number/select 编辑器的提交值经 `coerceValue`（number → `Number()`、select → typed option），裸字符串草稿喂给 formatter 会（a）与提交格显示**不 byte-faithful**（number 格 formatter 收到字符串）且（b）对 `v => v.toFixed(1)` 这类 formatter **直接崩溃**（fail-closed 违反）。故加模块级强转 helper（镜像 `coerceValueFor` 三分支语义）再走 mask→formatter——更贴合基线「byte-faithful to the committed cell」的既定目标，text/textarea 路径字节不变。

### What is left

- runner 的 review/gate 阶段；工作树 `DECISIONS.md`（本批 baseline 阶段记录）与 `batch-cq-baseline.md` 随本提交
- vue/solid/svelte 对齐延后（react-only scope，本批为 iris 独有）
