已完成：

- React/Vue/Solid 的 `Resizable`/`Resizer` 手柄统一改为可聚焦按钮。
- 使用既有 `resizer.handle` i18n key，支持方向键（10/Shift+方向键 1）及 Home/End 边界调整。
- 保持 disabled 与 pointer 拖拽行为。
- 三端补充可访问性、键盘和拖拽回归测试。

验证通过：

- React/Vue/Solid 测试与 typecheck
- `plugin-locale-zh` 测试
- 相关 lint 与格式检查
