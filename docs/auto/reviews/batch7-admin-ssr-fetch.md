已完成：

- `createAdminDataController` 新增 `{ immediate?: boolean }`，默认仍为 `true`。
- 四框架 DataPage 改为 mount/commit 后 `resource.load()`，并保留销毁清理与 abort。
- 增加 core immediate 行为回归测试及四框架 SSR 测试。
- Solid 使用 node 环境下的真实 server renderer 生命周期测试，因现有 harness 使用客户端编译器而采用最小可行探针。

验证结果：

- `plugin-admin test` ✅
- `typecheck` ✅
- `lint` ✅（仅已有 2 条复杂度 warning）
- Prettier 检查 ✅

未执行 git add/commit。
