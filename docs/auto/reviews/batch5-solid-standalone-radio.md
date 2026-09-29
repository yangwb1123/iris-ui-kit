已完成：

- Solid `IrisRadio` 支持 `defaultChecked`、布尔 `onChange`，并实现未受控内部状态与受控模式。
- `data-state`、`aria-checked`、视觉圆点及原生 checked 状态同步。
- 补充 standalone、默认选中、受控及 group 回归测试；未修改 `RadioGroup`。

验证通过：

- Solid 全量测试：166 个测试文件、1287 个测试通过
- Solid typecheck
- `pnpm check:parity`：无回退
