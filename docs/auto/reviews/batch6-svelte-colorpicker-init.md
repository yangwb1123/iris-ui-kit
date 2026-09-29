已完成，仅修改：

- `packages/svelte/src/primitives/color-picker/IrisColorPicker.svelte`
- `packages/svelte/src/primitives/color-picker/IrisColorPicker.test.ts`

变更：

- `$effect` 仅同步外部 `value`，不触发回调。
- 用户交互统一显式 `commit`，每次仅回调一次。
- 保留无效输入、禁用态、颜色归一化及 alpha 行为。
- 删除测试中的 `mockClear()` 掩盖，并补充调用次数断言。

验证通过：

- ColorPicker tests：16/16
- `svelte-check`：0 errors
- lint：0 errors（仅已有项目 warning）
