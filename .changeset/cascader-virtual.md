---
'@iris-ui-kit/react': patch
'@iris-ui-kit/vue': patch
'@iris-ui-kit/solid': patch
'@iris-ui-kit/svelte': patch
---

feat(cascader): 四框架 IrisCascader 新增 opt-in `virtual` prop

- `virtual`（默认 `false`）开启后，每个打开的列经框架 `IrisVirtualScroll` 桥由 core `createVirtualizer` 窗口化渲染——10k 选项列只挂载 ≤ 20 行 DOM，spacer 高度 = count × 行高
- 固定确定性尺寸（零旋钮）：视口 240px（即现有 maxHeight）、行高按 size（sm 28 / md 34 / lg 40，solid 无 size 恒 34）、buffer 4
- react/solid 桥新增可透传 `role`（solid 补 `[key: string]: unknown` + rest 转发到滚动容器）；vue/svelte 桥经 attrs/rest 原样透传，零桥改动
- 默认关闭：`virtual=false` 与改动前逐字节一致，四框架既有 cascader 测试零改动全绿
- 零新增导出、零 core 改动、零新依赖 ⇒ manifest/llms.txt 不变
