Baseline 完成：`/home/u1/iris-ui/docs/vxe-grid/batch-db-baseline.md`（零源码改动，仅既有 docs dirt 与本输出文件）。

## 核心发现（逐行复核，非引用旧文）

批 DB（`editSidebar?: boolean`）是**纯视图层集成**——底层全部就位：批 AT 的 `createAuditLog`（ring 200，seq 永不重置）、批 BA 的 `createVersionHistory`（ring 20，PRE-change 快照）、`commitRowList` 记录漏斗（**先 `recordHistory` 再 `recordAudit`**，:5552-5570）、`restoreVersion` 回放（:5579）。两个 controller 无条件创建、prop 只挡 UI（:3263/:3314），因此 editSidebar 不需要任何 core / 记录层改动。

## Baseline 内容

- **Exact design**：prop 契约（props.ts :951 后）+ 工具栏触发器（⏳，接 history 之后）+ 右侧边面板（portal、fixed 360px、无 backdrop 非模态，fiat）+ **合并时间线**（`b.at - a.at` 降序，同毫秒并列 audit 在前——依赖记录顺序的确定性裁决）+ 双 `useSyncExternalStore` 就地刷新 + 关闭三路（Esc/外部 pointer-down/scroll，触发器豁免 toggle）+ 空态 + 行为矩阵（5 格 fail-closed，记录层不被隐式开启）+ i18n 2 键（core defaultMessages）
- **File map**：新增 `EditHistoryPanel.tsx` + `edit-sidebar.test.tsx`；改 `props.ts`(+1)、`Table.tsx`(+45/−0)、core `i18n.ts`(+2)；types/index/core-controllers/三框架零改动（react-only，AT/BA 先例）
- **Test plan**：面板 7 用例（触发/打开/三路关闭/toggle 豁免/空态/就地刷新/scroll）+ 列表 6 用例（合并顺序/version 条目/audit 条目/单源/点击恢复不重推/8 类 type 冒烟），与 spec"面板/列表"逐条对应
- **Do NOT touch**：AT/BA 面板契约、`commitRowList` 顺序、controller ring 不变量、工具栏门只追加一行

`git status` 确认：仅 `DECISIONS.md`、`batch-da-gate.md`（既有 dirt）+ 新 baseline 文件，无任何源码改动。
