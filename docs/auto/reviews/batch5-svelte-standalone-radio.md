已完成：

- `IrisRadio` 支持 `defaultChecked`、`onChange` 与内部未受控状态。
- 受控模式、group 模式、`data-state`、`aria-checked` 和视觉圆点均已同步。
- 补充 standalone、默认选中、受控及 group 回归测试。

验证通过：

- Svelte 全量测试：1199 + 52 通过
- `svelte-check`：0 errors / 0 warnings
- `pnpm check:parity`：无回退
