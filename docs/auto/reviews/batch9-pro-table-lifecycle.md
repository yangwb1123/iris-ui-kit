已完成，变更仅限：

- `packages/plugin-pro-table/src/core/store-engine.ts`
  - 保存并清理四个订阅
  - 增加幂等 `destroy()`
  - 透传 `AbortSignal`
  - 取消 DataSource 请求并销毁 export Grid Core
- `packages/plugin-pro-table/src/core/types.ts`
  - `ProTableStore.destroy()`
  - `onLoad(query, signal?)`
- `packages/plugin-pro-table/src/core/index.test.ts`
  - 更新 signal 断言
- `packages/plugin-pro-table/src/core/lifecycle.test.ts`
  - 新增生命周期、取消、幂等、tree expansion、client 行为测试

按要求未启动 test/typecheck/lint/build runner，未 git add/commit。
