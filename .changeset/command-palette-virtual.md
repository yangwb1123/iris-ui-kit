---
'@iris-ui-kit/react': minor
---

feat(react): IrisCommandPalette 新增 opt-in `virtual` prop

- `virtual`（默认 `false`）开启后，结果列表经 `IrisVirtualScroll` 桥由 core `createVirtualizer` 窗口化渲染——10k 命令只挂载 ≤ 20 行 DOM，spacer 高度 = Σ 行高（header 28px / item 36px，`height="100%"` 保留 70vh 流式表面），键盘导航（↑/↓/环绕/查询重置/hover）把活动行滚入视口（core 钳制偏移）
- 列表模型复用：新增 flat→enabledIdx 记忆化映射，替换原 O(n²) `findIndex`（两条路径都受益，纯性能、DOM 不变）；共享 `renderRow` 供普通 map 与虚拟窗口；`keyOf` 精确复刻现有 header 键公式（`g-${label}-${i}`）防按键逐字重挂载
- 默认关闭：`virtual=false` 与改动前逐字节一致，既有 15 个 palette 测试零改动全绿（新增 A1–A8 验收：窗口挂载/精确 spacer/钳制滚动/环绕/查询重置/混合高度/禁用行/空态）
- 零新增导出、零 core 改动、零新依赖 ⇒ manifest/llms.txt 不变；Playground React 新增 10k 条目 palette 演示 + virtual 开关
