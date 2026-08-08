---
'@iris-ui-kit/react': patch
---

feat(react): IrisTree 新增 opt-in `virtual` prop（窗口化渲染扁平节点列表）

- `virtual?: IrisTreeVirtualOptions { itemHeight; height; buffer? }`（镜像 `IrisTableVirtualOptions`），开启后经 `IrisVirtualScroll` 桥由 core `createVirtualizer` 只挂载可见窗口 + buffer 的 treeitem 行——5k 节点仅挂载 ≤ 23 行 DOM，spacer 高度 = count × 行高；`keyOf` 用节点 id，展开/折叠不丢滚动位置（R4）
- 滚动根即树根：`role="tree"` / `tabIndex={-1}` / `onKeyDown` / `data-iris-tree` / rest / style 全部落到虚拟滚动根，aria 树完整（role="tree" → 无角色包装 → role="treeitem"）
- 键盘导航滚动到活动行（scrollToIndex + refresh，不依赖原生 scroll 事件）；焦点跟随活动行跨窗口（仅键盘移动触发，rAF 重查 + 5 帧上限 + 过期链丢弃——避免旧链在目标行重新挂载时抢焦）
- `renderFlatNode` 抽取为共享行渲染器：虚拟/非虚拟两路径逐字节一致；不传 `virtual` 与改动前完全一致（28 个既有测试零改动全绿）
- 新增导出 `IrisTreeVirtualOptions`（tree barrel）+ `IrisVirtualScrollProps` 增加 `tabIndex`/`onKeyDown` 两个转发 prop（type-only，运行时不变量不变）；manifest/llms.txt 与 docs components.md 已重新生成；零 core 改动、零新依赖
