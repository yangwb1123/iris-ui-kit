All verification commands complete. Here is the verdict.

---

# iris-ui 批 AK（范围粘贴 + unique）— 审查裁决

## 裁决：**PASS**（无阻塞问题；4 条低严重度发现）

## 验证命令（全部绿）

| 命令                                              | 结果                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @iris-ui-kit/core test`            | **1308 passed** (83 files)                                                                               |
| `pnpm --filter @iris-ui-kit/react test`           | **1896 passed** (169 files)                                                                              |
| react `tsc --noEmit`                              | clean                                                                                                    |
| react `eslint src`                                | **0 errors**（1 条 pre-existing 复杂度 warning，`Table.tsx:701` `IrisTable` complexity 200，本批未触达） |
| vue / solid `tsc --noEmit`、svelte `svelte-check` | 0 errors（svelte 5 条 warning 在未改动文件，pre-existing）                                               |
| `pnpm check:manifest`                             | up to date，**155×4 / 86 tokens 无 diff**                                                                |
| `pnpm audit:security`                             | No known vulnerabilities                                                                                 |
| `iris-ui-spec.py --mode all`                      | **0 violations**（1409 files）                                                                           |
| core 框架无关                                     | `grep -rE "from '(vue\|react\|solid\|svelte)'" packages/core/src/edit-rules.ts` 空 ✓                     |

## 检查点核对

**1. unique 核心语义 — 全部符合基线**

- 空值豁免：两侧都豁免（`edit-rules.ts:118` `!isEmpty(value)` 门外层 + `:121` `isEmpty(otherValue)` 跳过），测试覆盖两侧。✓
- String 比较：`String(value)` vs `String(otherValue)`（`:117`、`:122`），跨类型 `1` vs `'1'` 判重，测试覆盖。✓
- 向后兼容：可选第 5 参，无 context / 空 rows / 无 columnKey → no-op 通过；vue/solid/svelte 的 3 参调用类型检查通过（`vue Table.ts:1115/1260`、`solid IrisTable.tsx:1039/1171`、`svelte IrisTable.svelte:759` 均未改动）。✓
- 默认消息：`rule.message ?? 'Value must be unique'`（`:123`），英文风格与既有 5 条默认一致（首个"该不该用中文默认"的决策已按任务对齐既有风格）。✓
- 组合规则：与 required/pattern 组合测试（`edit-rules.test.ts`），规则顺序语义正确。✓
- react 桥接线：cell 模式 `Table.tsx:1647` 与 row 模式 `Table.tsx:1719` 均传 `{ rows: externalDataRef.current ?? [], columnKey: col.key }`（第 4 参 `false` 显式占位）；row 模式 validate 时经 `currentRowFor` 按 key 重新解析当前行，引用跳过健壮。✓

**2. paste 语义 — 全部符合基线**

- 矩形精确填充：`multiCell` 分支（`Table.tsx:3077`）从 `range.start`（归一化左上角）迭代到 `min(range.end, 表边界)`；小剪贴板 → 左上角填充、其余不变；大剪贴板 → 裁到矩形 + 表界。4 个新测试（精确填充/小剪贴板/大剪贴板裁剪/单行多列不越界）断言全部成立。✓
- 单格选区保持批 O 流式：`multiCell` 为 false 走原分支，既有 3 个粘贴测试原样通过。✓
- **一次 commit**：两条路径共享一个 `byKey` map + 一次 `commitRowList(next)`（`Table.tsx:3114-3120`），`onDataChange` 断言 `toHaveBeenCalledTimes(1)`。✓
- 值保持字符串：所有 patch 值均来自 `split('\t')`。✓

**3. additive / manifest / 框架无关 / i18n — 全部符合**

- additive：`unique?: boolean` 单行 prop + 可选第 5 参 + 新分支以 `multiCell` 门控，单格路径字节不变；git 确认仅 core×2 + react×1 + 文档变更，无 dist/tgz/manifest 提交。✓
- manifest：check:manifest 通过且无 diff（core 类型与 react props 均未触及扫描面）。✓
- i18n：默认消息可用 `rule.message` 覆盖；与既有 5 条 core 默认（英文硬编码）模式一致，未引入新违规。✓

## 发现（按严重度）

**1. [低] `edit-rules.ts:116` — `context.rows` 无守卫，与文档化 "no rows → no-op" 不一致**

```ts
if (rule.unique && context && context.columnKey !== undefined && context.rows.length > 0) {
```

若 JS 调用方传 `{ columnKey }`（无 `rows`）会抛 `TypeError`，而文档与测试只覆盖 `rows: []`。修复：`Array.isArray(context.rows) && context.rows.length > 0`（或 `context.rows?.length`）。

**2. [低] `Table.tsx:3081` — 矩形分支把"空剪贴板行"当数据结束，流式分支则写 `''`，两分支语义不一致**
`if (!cells) continue` 使空行对应的整个矩形行保持不变；而 `'\t'`（仅 tab）行会把该行全部格子写空。同一剪贴板（如 `"a\n\nb"`）在单格（流式，中间行写 `''`）与多格（中间行跳过）选区下行为不同。按文档 "top-left fill, rest unchanged" 可辩护，但未文档化该行级差异。修复：在注释中明确，或与流式一致地写空串。

**3. [低] `Table.tsx:1647`（cell 模式）— 引用身份跳过在父级中途重喂数据时失效**
`ctx.row` 在 `beginEdit` 时捕获（`:2222`）；若编辑会话中途父组件重喂新对象引用（`externalDataRef.current` 经 effect 更新），校验列表中的行与 `ctx.row` 引用不等 → 跳过失效，用户改回自己当前值会误报 "Value must be unique"。row 模式（`:1715` `currentRowFor` 按 key 重新解析）不受影响。基线明确选择了引用跳过，属固有边界；可加注释或在 context 中提供行 key 做 key-based 跳过。

**4. [信息] 唯一性作用域 = `externalDataRef.current`（当前页/当前数据），代理/分页模式下仅页内判重**
core docstring 已注明 "typically the table's current rows"，比较文档未提分页作用域。非缺陷，建议比较文档补一句。

## 备注（非发现）

- `docs/vxe-grid/DECISIONS.md` 与 `batch-ak-adapt.md` 的工作区改动为 runner 阶段记录，非本批代码变更。
- 预存 `dataIndex ?? key` vs `col.key` 粘贴写回不一致已在基线标注、本批未动（additive-only 正确）。
- 遗留：vue/solid/svelte 三端 `unique` 为 no-op（core 就绪、一行接线，文档化缺口），符合 "react for the paste bridge" 的批范围。

**结论：符合基线全部 4 项检查点；验证命令全绿；批准进入 gate 阶段。**
