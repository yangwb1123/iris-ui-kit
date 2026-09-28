已完成：

- Solid/Svelte Tour 指示器统一使用 `tour.step`，传入 `{ current, total }`。
- 保留 `data-iris-tour-indicator` 钩子。
- 两端补充英文默认文案及切换 `zh-CN` 的翻译测试，未修改 React/Vue 或 core。

测试结果：

- Solid：`166 passed`，SSR `8 passed`；`tsc --noEmit` 通过。
- Svelte：`170 passed`，SSR `5 passed`；`svelte-check found 0 errors and 0 warnings`。
