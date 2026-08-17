Baseline complete. Only `docs/vxe-grid/batch-dj-baseline.md` was created — no source files modified (the other dirty files in `git status` are pre-existing from parallel sessions).

## 批 DJ：表格快捷键监听增强（iris 独有）— 基线要点

**规格**：`hotkeyScope?: boolean`（快捷键仅在表格聚焦时生效，默认）+ 可选全局 `outerScope?: boolean`；测试聚焦/失焦。

**核心发现（逐行复核 Table.tsx / props.ts / types.ts / core keymap.ts）**：

- 现有快捷键监听器作用域**不一致**：undo/redo（:7200）与 clip copy/paste（:7233）已做 `rootRef.contains(target)` in-table 门控；但 **fnr Ctrl+F（:7748）与 batch-edit Escape（:9150）是 anywhere 触发**（无 root 包含检查）。
- root `onKeyDown`（:10599：grid 导航/CellRange/tableShortcuts/fill/query）天然 in-table（合成事件只在 root 内冒泡）。
- 作用域判定按 keydown `e.target`（= 焦点元素）实时读，沿用现有 `rootRef.contains` 模式——**不新增 focus/blur state**。

**精确设计**：

- 新 props `hotkeyScope`（默认 true）/ `outerScope`（默认 false），紧跟 `keymap`（props.ts:612 近旁）。
- 统一作用域门 `inShortcutScope(e.target)`：`outerScope` → 全局；`hotkeyScope=false` → permissive 兼容；默认 → 仅表格聚焦。
- 接入 4 个 window 监听器入口；undo/clip 把现有 contains 换成门（默认字节等价），fnr/batch-edit 收紧为 in-table（spec 要求的默认行为变化）；root onKeyDown 不改动。

**文件地图**：`props.ts`（+2 prop）· `Table.tsx`（+helper、4 处接线、解构、deps 补依赖）· 新增 `hotkey-scope.test.tsx`。不动 types.ts / core keymap.ts / 其它框架。

**测试计划**（~11 用例，新测试文件）：表内聚焦生效、失焦失效（fnr/undo/back-edit 收紧）、焦点往返、outerScope 全局生效、outerScope 优先、permissive 兼容、keyBindings 协同、prop 变更取最新（防 stale）、卸载清理。

**Fiats**：默认即收紧（fail-closed）；作用域按 `e.target` 判焦点不新增状态；undo/clip 默认行为不变（字节等价回归）；fnr/batch-edit 的 anywhere→in-table 是有意收紧。
