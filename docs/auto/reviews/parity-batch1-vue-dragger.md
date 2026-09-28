已完成：

- `IrisDragger` 支持非受控模式：无 `modelValue` 时由内部 `ref` 更新 transform。
- 有 `modelValue` 时保持受控，transform 仅随父组件更新。
- 保留现有 `useDrag` 的 pointer 捕获、按钮阈值及 disabled 行为。
- 新增非受控、受控、disabled 拖动测试。

测试结果：

```text
Test Files  199 passed (199)
Tests       1820 passed (1820)

$ tsc --noEmit
```

修改仅涉及：

- `packages/vue/src/primitives/dragger/Dragger.ts`
- `packages/vue/src/primitives/dragger/Dragger.test.ts`
