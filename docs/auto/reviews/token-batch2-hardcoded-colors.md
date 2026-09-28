已完成：

- 四端 CopyButton / SplitButton 前景色改用语义 token，分隔线统一使用 `--iris-border`。
- CommandPalette、Image、Tour、Drawer 遮罩统一为 `var(--iris-backdrop, …)`。
- 补充样式字面量与深色主题 token 测试。
- 未新增 token；现有 Divider 已使用 `--iris-border`，因此复用该 token。

验证：四端相关测试、typecheck、Prettier 均通过。
