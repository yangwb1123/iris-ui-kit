Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bx-baseline.md`** written (228 lines, the only new file — the two pre-existing modifications to `DECISIONS.md`/`batch-bw-gate.md` predate this task; zero source files touched).

## 核验摘要

**设计** — 列头右键菜单内置项：**固定左**（`__iris-pin-left`，i18n `table.pinLeft` `Pin left`/`固定左`）+ **取消固定**（`__iris-unpin`，`table.unpin` `Unpin`/`取消固定`），**按当前固定态单例互斥出项**（未固定 → 固定左；已固定（左**或**右）→ 取消固定——spec 无「固定右」）。变更经 **`onColumnPinnedChange?: (key, side|null)`** 双通道回调（`onColumnWidthsChange` 先例逐字：受控/非受控都无条件触发）+ **内部 fallback**（`pinnedColumns` 缺省时表内 `pinnedInternal` 落盘，静态 `col.pinned` 为种子回落）。**spec 开放问题裁决**：与 `contextMenu` 完全解耦，用**独立 prop `columnPinMenu?: boolean`** 门控（contextMenu 未配置也启用；两者是两个独立浮动实例，开前互关）。**单一咽喉 `pinOf(col)`** 替换全部 4 处 `col.pinned` 读取点（pinnedOffsets :5042/:5050、虚拟列 union :6075、body attr :6592、flat 头 attr :8758），`pinnedStyle` 按 key 天然继承。菜单复用 `TableContextMenu` + 虚拟光标锚点。受控无乐观翻转（BH 先例）、非受控立即翻转、右击零副作用（原生事件分离 + `button!==0` 守卫 :3323）。**manifest**：propCount 162→**165**、eventCount 30→**31**。

**文件地图** — core i18n +2 · zh 插件 +2 · types.ts +1 类型（`IrisTableColumnPinnedMap`）+ index.ts · props.ts +3 JSDoc prop（columnWidths 块后）· Table.tsx 触点（2 常量、destructure、pin 状态块、头菜单 state/handlers、4 处 funnel、flat/grouped 叶子头 onContextMenu、头菜单渲染）+ **grouped 叶子头固定视觉补齐**（先前 flat/grouped 不对称，additive 标为 review 仲裁点）· NEW `test/pin-column-menu.test.tsx` · comparison doc 3 处。零改动：styles.ts / core 逻辑 / 三框架 / 孤儿 TableHeader·TableRow·TableBody。

**测试计划** — 14 用例（react 2344 → **2358**）：固定左端到端 → 取消固定 → 菜单项随状态翻转 → **受控无乐观翻转** → 受控父应用 → 非受控内部落盘 → 静态种子 → **null 覆盖静态** → columnPinMenu 缺省零节点 → **与 contextMenu 解耦**（三组合）→ 右击不排序 → grouped 叶子/组头 → i18n en/zh → 虚拟列固定列仍渲染。

**12 条 fiats** 覆盖 gate 仲裁面；全部锚点已逐一对当前代码核验（常量 :929-958、widths 双通道 :2644-2662、context-menu 区 :3725-3990、pinnedOffsets :5032-5056、visibleColSet :6075、body/头 attr :6592/:8758、格菜单渲染 :8962-8990、props 162/事件 30 实测、comparison :78/:292/:350）。2 个开放问题（受控值通道选型、grouped 头视觉范围）供 gate/review 仲裁。
