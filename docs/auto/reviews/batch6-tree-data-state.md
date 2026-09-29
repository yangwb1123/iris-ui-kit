已完成，仅修改三端 Tree 实现与测试：

- React 传入 `hasContent`，并统一 `aria-busy`。
- Solid/Svelte 改用 core `resolveDataState`，支持 SWR 保留已有节点。
- 补齐五项状态矩阵测试，保留 lazy-child per-node 状态。

验证通过：

- React Tree：39 tests
- Solid Tree：30 tests
- Svelte Tree：19 tests
- Vue Tree 基线：27 tests
- 三端 typecheck、改动文件 lint、格式检查通过。未 git add/commit。
