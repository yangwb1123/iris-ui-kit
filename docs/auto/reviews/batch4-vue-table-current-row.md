已完成 Vue `IrisTable` 当前行能力：

- 新增三个同名 props 及类型。
- 行渲染增加 `data-iris-row-current="true"`。
- 接入点击、before veto 与变更回调。
- 补齐 current 行样式。
- 增加受控切换、回调及 veto 测试。

验证通过：

- Vue 测试：199 files / 1832 tests 全绿
- Vue typecheck
- `pnpm check:parity` 无回退
- Prettier 与 diff 检查通过
