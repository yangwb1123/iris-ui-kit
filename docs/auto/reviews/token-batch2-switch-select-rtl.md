已完成：

- 四端 Switch 拇指改用 `inset-inline-start`，过渡同步改为逻辑属性。
- 四端 Select 箭头改用 `inset-inline-end`，触发器间距改用逻辑 padding，默认尺寸和值保持不变。
- 四端各新增 RTL/LTR 测试，覆盖 Switch 两态、Select 箭头与间距。

验证：相关测试、四端 typecheck 均通过；lint 仅有既存复杂度警告。
