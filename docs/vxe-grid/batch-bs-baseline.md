Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bs-baseline.md`** written (18 lines, the only new file; `git status` confirms zero source changes — the `M` entries and `zz-bq-probe.test.tsx` are pre-existing state from earlier batches).

## 核验摘要

**设计** — 新表级 prop `groupBy?: string[]`（props.ts ~:410，`keymap` 后 / `groupCollapsed` 前）：数组元素 = 叶子列 `key`，顺序 = 嵌套层级（`['dept','status']` → dept level 0 → status level 1）。单一咽喉 `groupPlan` memo（Table.tsx:4436-4454）重写为递归构建器（复用 `groupRows` + `getCellValue` :1012 唯一取值漏斗）；`BodyPlanEntry`（:4404）扩展 `depth`/`value`，父组 `count` = 子树数据行总数，`group-summary` 仅最内层。**复合组键**：level 0 = 裸值（单列兼容），level ≥1 = `v0::v1::…`（`::` = cellId 同一定界符）；父折叠隐整棵子树。`renderGroupHeader`（:6384-6440）按 depth 缩进（token 步长）+ 新增 `data-iris-group-depth`。**优先级**：表级数组赢，列级 `groupBy: true` 旗标惰性；数组缺省回落批 M/BH 路径字节不变。树模式 fail-closed、proxy 每页分组、零新 i18n 键（复用 core i18n.ts:107-108）、零事件、零 core 改动、react-only。

**文件地图**：props.ts +1 · Table.tsx 3 触点 · types.ts 文档一句 · 新 `test/group-multicol.test.tsx` · comparison doc 3 处 · manifest 重新生成（propCount 158→159、eventCount 30 不变）。

**测试计划**：规格强制"嵌套分组渲染"打头（两层/三层组头顺序 + depth/value/复合键断言），另含单元素数组兼容、数组 vs 旗标优先级、未知键/去重、父/叶折叠语义、受控无乐观翻转、叶组合计仅最内层、seq 零漂移、virtual 路径、树模式 fail-closed、无数组字节不变（11 项）。

10 条 fiats 覆盖 gate 仲裁面。全部锚点已逐一对当前代码核验。
