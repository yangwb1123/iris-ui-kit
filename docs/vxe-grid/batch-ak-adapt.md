# iris-ui grid 批 AK（范围粘贴 + unique 唯一性规则）— adapt 报告

**Commit:** `feat(table): grid 批 AK——范围粘贴矩形填充 + editRules.unique 唯一性规则（iris 独有）`

## 交付内容

**1. `editRules.unique` 唯一性规则（core，additive）**

- `EditRule` 新增 `unique?: boolean`（单行布尔 prop，manifest 扫描器友好）。
- 新增**具名导出接口** `EditRuleContext<Row> { rows, columnKey }`（core barrel 同步导出）。
- `validateEditRules` / `validateEditRulesAsync` 新增**可选第 5 参** `context?: EditRuleContext<Row>`（`collectAll` 之后）——旧调用方（vue/solid/svelte/react 的 3 参调用）字节兼容，零改动。
- 校验语义（在既有 `!isEmpty(value)` 门内）：
  - 同列 **String 比较**（跨类型 `1` vs `'1'` 判重）；
  - **空值两侧豁免**（空草稿不检查；其他行的空值不参与碰撞）；
  - **编辑行按引用身份跳过**（改回原值不误报）；
  - 失败消息 = `rule.message` ?? 默认 `'Value must be unique'`（与既有默认消息英文风格一致）；
  - 无 context / rows 空 / columnKey 缺失 → 规则跳过（no-op 通过，文档化）。
- 默认消息是首个非中文默认消息（其余 5 条全英文）——按任务指示对齐既有英文风格。

**2. react 桥接**

- cell 编辑模式（`Table.tsx` cellEdit validate）与 row 编辑模式（createRowSession validate）的 `validateEditRulesAsync` 调用均传入
  `{ rows: externalDataRef.current ?? [], columnKey: ctx.col.key }`（第 4 参 `false` 显式占位）。
- `pasteIntoRange` 增加**矩形填充分支**：多格选区（`end.row > start.row || end.col > start.col`）→ 从选区左上角逐格写入剪贴板 TSV，只填选区矩形；剪贴板小于选区 → 左上角填充、其余不变；大于 → 裁到矩形 + 表格边界（`lastRow`/`lastCol` 钳制）；单格选区保持批 O 流式行为（既有测试原样通过）。两种路径同一 byKey patch map + **一次 `commitRowList`**，值保持字符串。

**3. 测试（12 新）**

- core `edit-rules.test.ts` +8：首用通过/重复失败（默认消息）、规则 message 覆盖、空值豁免（两侧）、与 required/pattern 组合、无 context 跳过（文档化 no-op）、引用身份跳过、跨类型 String 比较、async API + context。
- react `clip-fnr.test.tsx` +4：2×2 选区精确填充（一次 onDataChange）、小剪贴板左上角填充其余不变、大剪贴板裁到矩形与表格边界（3×3 → 2×2 锚 (1,0)）、单行多列选区不越过矩形流式（边界 pin）。

**4. 文档**

- `docs/vxe-grid-comparison.md`：iris 独有节 +2 行（范围粘贴 / `editRules.unique`）、构建状态表 +批 AK 行、测试计数行更新。
- manifest 已重新生成（`pnpm gen:manifest`）——155×4 / 86 tokens **无 diff**（core 类型与 react props 均未触及 manifest 提取面）。

## 验证（全部通过）

| 检查                              | 结果                                                |
| --------------------------------- | --------------------------------------------------- |
| core test                         | **1308 passed**（+8）                               |
| react typecheck                   | clean                                               |
| react test                        | **1896 passed**（+4，clip-fnr 18/18）               |
| react lint                        | **0 errors**（1 条既有 complexity warning，非新增） |
| vue/solid/svelte typecheck        | clean（3 参调用兼容）                               |
| iris-ui-spec.py --mode all --json | **0 violations**                                    |
| gen:manifest                      | 155×4 / 86 tokens，无 diff                          |

## 文件（4 源/文档 + 2 测试 + 本报告；`docs/vxe-grid/DECISIONS.md` 为 runner 追加，非本次改动）

| 文件                                                    | 变更                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/core/src/edit-rules.ts`                       | `unique` 规则 + `EditRuleContext` + 两 API 可选 context 参 |
| `packages/core/src/index.ts`                            | barrel 导出 `type EditRuleContext`                         |
| `packages/react/src/primitives/table/Table.tsx`         | pasteIntoRange 矩形分支 + 2 处校验桥接线                   |
| `packages/core/src/edit-rules.test.ts`                  | +8 唯一性测试                                              |
| `packages/react/src/primitives/table/clip-fnr.test.tsx` | +4 矩形粘贴测试                                            |
| `docs/vxe-grid-comparison.md`                           | iris 独有 +2 行 / 构建状态 +批 AK / 计数更新               |

## 约束核对

- **core 框架无关**：edit-rules.ts 零框架 import（`grep` 验证）；react-only 粘贴桥。
- **additive only**：无既有行为变更；单格流式、3 参调用、缺省消息字节均不变。
- **无 dist/tgz/node_modules/manifest.json 编辑**（manifest 仅重新生成且无 diff）。
- **测试文件 ≤500 行**：edit-rules.test.ts 157 / clip-fnr.test.tsx 391。
- **≤4 变更文件 + 测试**：4（2 core + 1 react + 1 文档）+ 2 测试 + 报告。
- **manifest 扫描器卫生**：`unique?: boolean` 单行 prop；`EditRuleContext` 具名导出接口。

## 遗留（文档化，非能力缺口）

- vue/solid/svelte 适配器的校验桥未接线 context → 三端 `unique` 规则暂为 no-op（core 已就绪，接线即生效，见比较文档「iris 独有」节）。
- 预存不一致（baseline 已标注，本批未动）：粘贴写回用 `cols[colIdx].key` 直写，而读取走 `dataIndex ?? key` 间接层（`getCellValue`）——`dataIndex` 列在粘贴路径下按 key 落库，与单格编辑提交一致，属既有行为。
- 表格边界钳制：多格选区超出末行/末列时 `lastRow`/`lastCol` 截断（键盘扩展已钳制，指针拖拽超界场景仅由代码路径兜底，无 UI 可构造测试）。
- `gen:manifest` 无 diff（未触及组件 props 面）。
