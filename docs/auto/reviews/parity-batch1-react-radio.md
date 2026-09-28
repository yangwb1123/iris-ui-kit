已完成：

- **`packages/react/src/primitives/radio/Radio.tsx`**
  - 移除无 `IrisRadioGroup` 时的异常。
  - 增加独立模式的 `checked`、`defaultChecked`、`onChange(checked)`。
  - 保留 group 模式由 context 管理。
  - 补齐 `role="radio"`、`aria-checked` 和 `name` 分组语义。
- **`packages/react/src/primitives/radio/Radio.test.tsx`**
  - 覆盖独立受控、非受控、group 回归及 disabled 场景。

测试结果：

```text
Test Files  277 passed (277)
Tests       3132 passed (3132)
```

```text
$ tsc --noEmit
```

类型检查通过。
