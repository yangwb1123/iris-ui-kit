Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-do-baseline.md`（6.9KB, verification-style）— only file I touched; the two other `M` docs pre-existed.

## Baseline summary — 批 DO：单元格右键格式（iris 独有）

**Exact design** — spec（contextMenu 内置格式项：`__iris-format-number` 选中区域数字 `toFixed(2)` + `__iris-format-upper` 文本大写，经 `commitRowList` 批量写回，测试两种格式应用）**已在 HEAD `9d045663` 完整提交**，逐行锚定：

- **Opt-in**: `props/query.ts:232` — `contextMenu.formatActions?: boolean`，默认 false → 菜单零新增项
- **保留 key**: `table-constants.ts:18-19` — `__iris-format-number` / `__iris-format-upper`
- **菜单挂载**: `Table.tsx:3039-3048` — copy/clear（BW）之后、annotate（BB）之前，同一 dedupe 守卫；label 走 `t('table.formatNumber'/'table.formatUpper')`
- **执行核心**: `Table.tsx:2944-2979` `formatContextSelection` — 活跃选区（`cellRangeCtrl.getRange()`）否则回退右键单元格；当前 body 行/列；formula/locked/readonly 跳过；仅 number && finite → `toFixed(2)`（写回字符串）、仅 string → `toUpperCase()`；不匹配值字节一致；`next !== current` 才提交
- **写回**: `Table.tsx:3282` `commitRowList(next,'edit')` — 与 Delete 快捷同一 funnel：version/undo/audit/setLiveData/`onDataChange` 恰一次/批
- **拦截**: `Table.tsx:8917-8918` — 用户 `onSelect` 永不见格式 key
- **i18n**: zh（数字格式（2 位）/文本大写）`plugin-locale-zh:72-73` + en（Format number (2 decimals)/Uppercase text）`core/i18n-messages.ts:87-88`

**File map**: 常量 2 行 + prop 字段 1 处 + `Table.tsx` 5 touch points + 双语言文案各 2 行 + 3 个测试文件（+4 测试）；零 core 实体/vue/solid/svelte/类型/样式变更；manifest 计数不变（嵌套字段，CU 先例）。

**Test plan**: spec 指定测试已交付——`batch-dl-dt.test.tsx`（区域数字格式单写回 `'1.20'/'2.50'` + onDataChange 恰一次；点击格大写回退 `ALICE`）×2、`context-quick-actions`（opt-in funnel `25→'25.00'`）×1、`context-menu-select`（6 项排序 [4]/[5]）×1。**实跑 3 套件 41/41 绿**（11+13+17）。

3 条 non-blocking 观察（如实记录）：用户回调不见格式 key 无显式断言测试；无匹配值零提交分支无显式测试；数字格式写回字符串属 spec 固有语义。
