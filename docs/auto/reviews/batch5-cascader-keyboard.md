已完成：

- React / Vue / Solid Cascader 支持 roving `tabIndex`、Tab 进入、上下方向键、Enter/Space 选择。
- disabled 选项不可聚焦或激活。
- 各级列增加本地化 `aria-label`，复用现有 `cascader.level`。
- 三端各补充键盘与 ARIA 测试。

已验证：三端 Cascader 测试、typecheck、`pnpm audit:tokens`、locale-zh 测试均通过。
