已完成 Svelte Table current-row 能力：

- 新增 `currentRowKey`、`onCurrentRowChange`、`beforeCurrentRowChange` 契约与接线。
- 行输出 `data-iris-row-current="true"`，支持当前行高亮。
- 点击时先执行 veto 回调，允许后再触发变更回调。
- 补充受控更新、允许变更及 veto 测试。

验证通过：

- Svelte Table：295 tests 全绿
- `svelte-check`：0 errors / 0 warnings
- `pnpm check:parity`：无回退
