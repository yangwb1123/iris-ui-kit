Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bv-baseline.md`** written (70 lines, the only new file — the `M DECISIONS.md` and `?? batch-bu-gate.md` entries are pre-existing pipeline state; **zero source files touched**).

## 核验摘要

**设计** — 新 handle 方法 `exportComparisonCsv(): string`（types.ts `IrisTableHandle` + Table.tsx handleRef，`exportVersionCsv` 之后）：差异行导出 = **当前视图**（`filteredDataRef`，与 `exportCurrentViewCsv` 同源）中 status ∈ {removed, changed} 的行**按视图序** + compareWith 快照独有 `added` 行**尾部按快照序**（批 AU 文档化无渲染槽位）；未变更行排除（spec「差异行」明文）。每行前置**标记列**（保留键 `__iris_diff` + i18n `table.compare.diff` en `Diff`/zh `差异`，值 = 英文字面量 added/removed/changed）。**规格扩展**（fiat #4）：变更格导出 `maskedOld → maskedNew` 合成串（`→` 同批 AU tooltip；**掩码先于合成**——批 AY 导出默认掩码不因合成泄漏裸值，`exportRaw` 双侧裸值；公式列自身不合成，批 AU 文档化）。**标记复用渲染 memo**（`compareDiffRef` 镜像，零重算、与渲染视图按构造一致；key 提取裸 `row[rowKeyField]` 同 core diffRows，无 rowId 回落）；序列化走模块级 `buildComparisonCsv`（csvRangeCell 本地序列化器先例：公式物化 + 掩码 + core `toCsv` 同款 RFC-4180/OWASP 中和）。**空语义**：无 compareWith/rowKey → `''`；有但零差异 → 仅表头（两态区分）。无 UI 入口（handle-only，`exportVersionCsv` 同款）。

**文件地图** — types.ts +1 · Table.tsx 4 触点（import toCsv、模块常量+纯函数 :1208、3 个 ref 镜像 :4493、handle 项 :4244）· core i18n +1 · zh plugin +1 · NEW `test/export-comparison-csv.test.tsx` · comparison doc 4 处 · **manifest 无 diff**（handle+i18n 均不可见，propCount 161 / eventCount 30 不变）；零改动：props.ts/core diff-rows.ts/styles.ts/三框架。

**测试计划** — 14 用例，spec 核心打头（changed 行标记+composite、removed 现值、added 快照值），另覆盖未变更排除/惰性 `''`/全等快照仅表头/标记列置首+i18n/隐藏列/掩码双侧+exportRaw/公式物化/行序/多变更列+null 空串/筛选视图排除。react 2306 → **2320**。

**10 条 fiats** 覆盖 gate 仲裁面；全部锚点已逐一对当前代码核验（compareDiff memo :2227、bodyDataRef :4493、exportVersionCsv :4234、`table.compare.tooltip` i18n :154/:90、`toCsv` 中和规则、manifest 161 props/30 events）。
