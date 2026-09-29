已完成：

- Svelte 组件统一改用 `$props.id()`，保留显式 `id`/`labelFor` 优先。
- 移除 core 模块级自增计数器，改为运行时唯一 ID。
- 补充 SSR 跨请求稳定性与真实 hydration ARIA 关联测试。

验证通过：

- Svelte 全量测试：1201 passed
- SSR 测试：53 passed
- Core 测试：2279 passed
- Svelte-check：0 errors（仅有既存 `IrisList` 警告）
