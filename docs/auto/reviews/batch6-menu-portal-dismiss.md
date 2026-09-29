已完成：

- React / Solid / Svelte 增加稳定 menu tree id、继承 context 与 `data-iris-menu-tree` 标记。
- `useDismiss` 支持 `excludePredicate`，使用 `Element.closest` 覆盖 SVG 子节点。
- Solid submenu 补充 portal 与嵌套 context。
- 三端新增回归测试：submenu pointerdown 不关闭 root，树外 pointerdown 会关闭。

验证通过：

- React：19 tests
- Solid：6 tests
- Svelte：13 tests
- 三端 typecheck、lint 均无错误。
