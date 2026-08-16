Baseline complete. **Output: `/home/u1/iris-ui/docs/vxe-grid/batch-cc-baseline.md`** (231 lines, the only new file — the 3 `M` entries are prior-stage docs, untouched; zero source files modified).

## 核验摘要 (batch CC：编辑自动换行，iris 独有)

**设计** — 表级 prop `IrisTableProps.editAutoHeight?: boolean`（默认 off，additive fail-closed，命名族同 `editAutosave`/`editDirtyConfig`，manifest propCount 167→168）：

1. **作用面唯一** = `EditorSurface` textarea 分支（Table.tsx:825-864，批 I 模具）。开时 `rows` 3→1（单行起步随内容增长）；关时字节不变（`test/filter-panel.test.tsx` 的 `rows === '3'` 断言保持绿，回归护栏）。
2. **机制按 spec 字面**：`onInput` 读 `e.currentTarget.scrollHeight` → 纯函数 `autoHeightSize(scrollHeight, lineHeight)` → 直写 inline `height/maxHeight/overflowY`（无 setState 无重渲染循环；模块级 helper 保 render 复杂度预算）。行高 `getComputedStyle` 每会话测一次缓存（fallback 16px）。
3. **上限**：`EDITOR_AUTO_MAX_ROWS = 6` 常量；`maxHeight = 6×lineHeight`，严格超出才 `overflowY: auto`（恰好 6 行无滚动条）；双向（删除收缩）；挂载测量让预置多行值打开即定型。
4. **双模式共享**：row mode（:7052）与 cell mode（:7068）同一 surface，双生效；Enter/Shift+Enter/Escape/blur/aria/错误消息/datalist 全部不动。
5. **F6 语义记档**：固定行高（rowHeight/virtual）时编辑器在自身 maxHeight 内滚动——预期而非缺陷。

**文件地图** — react 改动 2（props.ts:381 插入、Table.tsx 四处）+ 新测试文件 `edit-autowrap.test.tsx`；实现阶段 manifest 重生成（167→168）。**零改动**：types.ts / styles.ts / core / i18n / TableAnnotatePanel 批注 textarea（独立 surface，spec 范围外）。

**测试计划** — 10 用例：纯函数 5（增长 40→40px / 上限 300→120px+auto / 边界 120→hidden / 收缩 / 单行下限）+ 集成 5（默认关闭回归锁批 I / 增长接线 / 上限接线 / 交互不变量 / row-mode 共享）；jsdom 无布局故 scrollHeight mock（F9），数学全在纯函数。spec 三块 mandatory（增长/上限）显式映射 T1+T7 / T2+T8。

**8 fiats + 3 开放问题**（O1 初始 rows=1 vs 3、O2 per-column、O3 cap 可配置），全部锚点已对 HEAD `11311edf` 逐行核验（含一处修正：props.ts editAutosave 锚点为 :381）。
