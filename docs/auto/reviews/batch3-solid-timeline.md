已完成：

- `IrisTimeline` 新增 `renderItem(item, index)`，自定义内容替代默认 time/title/description。
- 未传 `renderItem` 时保持原默认渲染。
- 补充自定义渲染与默认渲染测试。

验证通过：

- Timeline 测试：5 passed
- Solid typecheck：通过
- `pnpm check:parity`：无回退
