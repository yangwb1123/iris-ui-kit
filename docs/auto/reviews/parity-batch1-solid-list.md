已完成：

- `packages/solid/src/primitives/list/IrisList.tsx`
  - 新增 `onSelect?: (item: IrisListItem<T>) => void`
  - 点击和 Enter/Space 键盘选择共用 `select`，回调只触发一次
  - disabled item 直接跳过，不触发回调
  - 沿用现有 `createSelectionModel`，未改变 `onChange` 行为
- `packages/solid/src/primitives/list/IrisList.test.tsx`
  - 覆盖完整 item、键盘选择、不重复、disabled、受控模式及 `onChange` 次数

测试结果：

```text
Test Files  166 passed (166)
Tests       1211 passed (1211)
Test Files  8 passed (8)   # SSR
Tests       50 passed (50)
$ tsc --noEmit
```
