Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bw-baseline.md`** written (11 lines, the only new file — zero source files touched, git status confirms).

## 核验摘要

**设计** — contextMenu 内置两项快捷操作（spec 原文）：**复制值**（`__iris-copy-value`）+ **清空**（`__iris-clear-cell`），**无条件内置**（无新 prop），插入点 = `handleContextMenu` 摘要项后（:3904）、批注块前（:3911）——菜单链：用户项 → 分布? → 摘要? → **复制值 → 清空** → 批注?（「排在批注项前」）。**复制值**走模块 helper `contextCellText`（`applyCellMask` 掩码 → formatter → `String`，与 `cellTooltip` :6107 同源 = 代码库既有「单元格文本」）+ 既有 `writeClipboardText`（:1355 三通道安全 no-op）；**清空** = `setCellValue(current, rowKey, k, col.key, '')` → `commitRowList(next)`（**Delete 快捷键 :5235 先例逐字**，同一撤销/审计/onDataChange 漏斗），locked/readonly no-op；两键 onSelect 接线拦截永不达用户回调 + 去重守卫（分布/摘要/批注同款）。**i18n**：+2 键 en+zh `table.copyValue`/`table.clearCell`。**无回调惰性**（spec 明文）：无 onDataChange → 清空内部 liveData 仍更新不崩；无剪贴板 → 复制安全 no-op。

**文件地图** — core i18n +2 · zh plugin +2（drift 测试自动覆盖）· Table.tsx 6 触点（2 常量 :948、helper :1347、追加点 :3904-3910、2 回调 :3870、接线 :8917-8923）· props.ts doc +1 · NEW `test/context-quick-actions.test.tsx` · comparison doc 3 处 · **manifest 无 diff**（propCount 162 / eventCount 30 不变）；零改动：types.ts / styles.ts / core 逻辑 / 三框架。

**测试计划** — 12 用例（react 2332 → **2344**），spec 核心打头：顺序含复制/清空且在批注前 → 复制写剪贴板（掩码+formatter 链端到端）→ 复制原始文本+null→'' → 保留键不达用户回调 → 清空端到端 onDataChange 置空 → locked/readonly no-op → **无 onDataChange 惰性安全** → **无剪贴板惰性安全** → 去重守卫 → 无 contextMenu 零节点 → i18n 标签。

**10 条 fiats** 覆盖 gate 仲裁面；全部锚点已逐一对当前代码核验（保留键常量 :933/:938/:942-948、`writeClipboardText` :1355、追加点 :3904/:3911、Delete 清空 :5235、`cellTooltip` :6107、onSelect 接线 :8917-8923、manifest 162/30、react 2332）。
