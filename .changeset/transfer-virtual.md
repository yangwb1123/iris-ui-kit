---
'@iris-ui-kit/react': patch
'@iris-ui-kit/vue': patch
'@iris-ui-kit/solid': patch
'@iris-ui-kit/svelte': patch
---

feat(transfer): 四框架 IrisTransfer 新增 opt-in `virtual` prop（双面板窗口化）

- `virtual?: IrisTransferVirtualOptions { itemHeight; height?; buffer? }`（镜像 `IrisTableVirtualOptions`），开启后两个面板列表经各框架 `IrisVirtualScroll` 桥由 core `createVirtualizer` 窗口化渲染——10k 选项只挂载 ≤ 11 行 DOM，spacer 高度 = count × 行高
- `height` 默认 200（svelte 240，即其面板现有 max-height）；滚动容器保持 `flex:1` + `maxHeight` + content-box，与现有 ul/div 面板布局一致
- 行渲染共享：react/vue 虚拟路径行标签为 `div`（`li` 入 div 会破坏 HTML 合法性），solid 保留 `role="option"` + `aria-selected`（`li`/`div` 双拼），svelte 保留 `<label>` 行（`row` snippet 双路径复用）
- 空态、搜索过滤、全面板计数头、禁用项、value-keyed 选择（窗口化不丢勾选）在虚拟路径下行为不变；`data-iris-transfer-list` 经 rest/attrs 落到虚拟滚动根（react/vue）
- 默认关闭：不传 `virtual` 与改动前逐字节一致，四框架既有 transfer 测试零改动全绿（新增 V1–V7 验收 × 4 框架：窗口挂载/jsdom 缓冲窗/滚动驱动窗口至第 9993 项/移动/空态/搜索计数/禁用）
- 新增导出 `IrisTransferVirtualOptions`（四 barrel）⇒ manifest/llms.txt 与 docs components.md 已重新生成；零 core 改动、零新依赖
