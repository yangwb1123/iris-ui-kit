Done. All gates green, committed as `59e701c0`.

## 批 BO 完成报告 — 列宽重置 `columnWidthsReset`（iris 独有）

**Commit**: `59e701c0` — `feat(table): grid 批 BO——列宽重置 columnWidthsReset（iris 独有）`（工作树仅剩 runner 预存条目 + baseline 未跟踪文件，未触碰）

### 实现（按 baseline 验证方案，零偏差）

- **Prop** — `props.ts` 在 `onColumnWidthsChange` 之后：`columnWidthsReset?: boolean`（单行 prop，manifest 扫描器卫生达标；无新类型 → 无 types.ts 改动）
- **单咽喉 `resetColumnWidths`**（`setColumnWidth` 之后）— 点击 → `onColumnWidthsChange?.({})`：空 map = 规格「默认映射」，零 override → 既有 `??` 链回落**列声明宽度**（number / `'auto'` → `minmax(max-content, max-content)` / `'1fr'` / 缺省 `minmax(0, 1fr)`），**零新渲染逻辑**；非受控同 `setWidthsInternal({})`（双通道同 `setColumnWidth` 先例）
- **按钮** — batch-edit 块后、zoom 按钮前：`data-iris-table-toolbar-reset-widths`，glyph `⇔`，`aria-label`/`title` = `t('table.resetColumnWidths')`，`color: var(--iris-muted)` font-size-md，全 token；不在工具栏渲染门（zoom 先例）
- **i18n** — +1 键：en `Reset column widths`（core i18n.ts）+ zh `重置列宽`（plugin-locale-zh）

### 测试（10 新，`reset-column-widths.test.tsx` ~220 行 ≤500）

按钮三态（toolbar 渲染/aria-label+⇔ / 无 prop 缺省 / 无 toolbar 无按钮）· **重置回调**（受控 `{}` 恰一次 / 父应用 `{}` → number-auto-1fr 混合回落）· 非受控（116px resize → 回落**声明宽** 120 而非 100 挂载种子 / 回调双通道 / 无 resizableColumns 可重置）· 不触发排序回调 · persistState 快照存 `{}` 重挂载恢复即默认宽

### 验证（全部 ✅）

| 门                            | 结果                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| core test                     | 1517/1517（零 core 逻辑改动）                                                                      |
| react typecheck               | ✅                                                                                                 |
| react test                    | **2242/2242**（+10）                                                                               |
| react lint                    | **0 errors**（1 个既有 complexity warn）                                                           |
| spec `--mode all --json`      | **0 violations**                                                                                   |
| gen:manifest + check:manifest | ✅ 155 组件、react Table **156 props**（155→156）、`columnWidthsReset` 类型单行提取、llms.txt 同步 |

### 剩余

- vue/solid/svelte 对齐留待后续批（react-only，批范围如此）
- 批 runner 后置：adapt 报告 + review/gate 阶段
