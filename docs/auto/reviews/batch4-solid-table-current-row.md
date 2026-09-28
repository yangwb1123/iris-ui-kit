已完成 Solid Table 当前行能力：

- 新增三个 props：`currentRowKey`、`onCurrentRowChange`、`beforeCurrentRowChange`
- 行输出 `data-iris-row-current="true"`，并补齐 token 样式
- 点击行按 React 契约执行 veto 与回调
- 增加 4 条覆盖测试

验证通过：

- Solid 全量测试：1231 + SSR 50 全绿
- typecheck、lint 通过
- `pnpm check:parity` 无回退
