已完成：

- Core 新增共享纯函数 `getMenuSubDirection`，统一 RTL/LTR placement、键盘键与箭头方向。
- React/Vue/Solid/Svelte 子菜单均已接入。
- 补充四端 RTL/LTR 菜单测试。
- 未修改 floating-ui 定位算法。

验证通过：

- 四端 menu tests 全绿
- Core、四适配器 typecheck / svelte-check
- `pnpm check:parity`
