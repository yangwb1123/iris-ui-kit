All gates green. Final report:

## 批 BS 完成报告 — 多列分组 `groupBy?: string[]`（iris 独有）

Committed as **`<COMMIT>`** — `feat(table): vxe-grid 批 BS——多列分组 groupBy 数组嵌套（iris 独有）`

### 实现（baseline 零偏差，纯 additive、core 零改动、react-only、零 i18n/零事件）

**`props.ts`** (+1)：表级 `groupBy?: string[]`（`keymap` 后 / `groupCollapsed` 前，单行 prop，manifest scanner 卫生）——数组元素 = 叶子列 `key`，顺序 = 嵌套层级。

**`Table.tsx` 3 触点** (+81)：

- destructure `groupBy`
- **`groupPlan` memo 重写为递归构建器**：新增 `groupByKeys` memo（未知键丢弃、重复保留首现、空/全未知 → `null` 惰性）→ 有数组走递归 `build(rows, level, prefix)`（复用 `groupRows` + `getCellValue` 唯一取值漏斗）：每层 push `group-header`（`depth`/`value` 扩展），**level 0 键 = 裸值**（单列兼容）、**level ≥1 = `v0::v1::…`**（`::` = cellId 同一定界符）；父组 `count` = 子树数据行总数；`group-summary` **仅最内层**；折叠 skip 隐整棵子树；无数组回落批 M/BH 单列路径**字节不变**
- **`renderGroupHeader`**：新增 `data-iris-group-depth` + 按 depth 缩进（`paddingInlineStart: calc(var(--iris-space-sm, 12px) * depth)`，token 步长）；显示值 = 本层自有 `value`（非复合键），单列路径 `?? groupKey` 字节不变

**`types.ts`**：列级 `groupBy` 文档一句——表级数组设时赢列级旗标。

### 测试（13 用例，412 行 ≤500）

`test/group-multicol.test.tsx`（新）——规格「嵌套分组渲染」打头：①两层组头顺序 + depth/value/复合键/子树 count 断言、②三层嵌套同断言；+ 单元素数组兼容（裸键 + 折叠）、数组 vs 旗标优先级（数组赢 / 无数组旗标照常）、未知键丢弃 + 去重（首现）、全未知/空数组惰性、父折叠隐整棵子树（count 保留）、叶折叠只隐本子树（同值异父互不干扰）、受控无乐观翻转（复合键回调载荷）、叶组合计仅最内层（aggregate 求和断言）、seq 零漂移（原始 bodyData 索引）、virtual 路径（jsdom clientHeight=0 窗口语义 + 折叠重算）、树模式 fail-closed。

### 验证（全部 ✅）

| 门                            | 结果                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| core test                     | 1517/1517                                                                    |
| react typecheck               | ✅                                                                           |
| react test                    | **2281/2281**（+13）                                                         |
| react lint                    | 0 errors（1 既有 complexity warning，pre-existing）                          |
| spec `--mode all --json`      | **0 violations**（缩进/间距全 token）                                        |
| gen:manifest + check:manifest | ✅ 155 组件 · propCount **158→159** · eventCount **30 不变** · llms.txt 同步 |

### 文件变更

`props.ts` · `Table.tsx` · `types.ts` · `test/group-multicol.test.tsx`(新) · `manifest.json` + `llms.txt`（重新生成）· `docs/vxe-grid-comparison.md`（独有表行/构建状态/测试计数 3 处）· `batch-bs-adapt.md`(新) · `batch-bs-baseline.md`（runner 已写，随批提交）。未触碰 dist/tgz/node_modules、未手改 manifest.json；`zz-bq-probe.test.tsx` 为既有未提交探针，非本批内容。

### 剩余

- vue/solid/svelte 对齐留待后续批（react-only 批范围）
- 批 runner 后置 review/gate 阶段（`docs/vxe-grid/batch-bp-gate.md` 的 runner 预存改动保持未提交，非本批内容）
