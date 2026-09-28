已完成：

- React / Solid / Svelte 列表统一传入 `hasContent`。
- Svelte 改用 core 的 `resolveDataState`，删除手算状态逻辑。
- loading 时保留已有内容，并设置 `aria-busy`。
- 三端各补充 SWR loading 测试。

验证通过：

- 三端 List 测试全部通过
- React / Solid / Svelte typecheck 全部通过
