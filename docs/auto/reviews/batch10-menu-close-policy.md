已完成四框架 `MenuItem` 语义统一：

- 新增 `closeOnSelect`，默认关闭菜单。
- React 保留 `keepOpen`，并支持优先级。
- 统一处理 callback `preventDefault()` 与键盘默认行为。
- 补充四端 click/Enter/Space 测试及 React 兼容测试。
- 保留现有 dismissal 改动，未执行 add/commit。

按要求未启动 runner；仅完成 `git diff --check`，通过。
