# TODO

> 仅保留当前可行动项。完成历史见 `CHANGELOG.md`；不要把已关闭的历史 gap
> 重新复制成新待办。日期：2026-07-27。

## 当前收口

- 当前没有未关闭的可行动实现项。`pnpm test:coverage` 已在补强 12 个
  React/Vue/Solid/Svelte 复杂组件后通过：388 个测试文件、41,086 行测试，
  high-complexity 缺口为 0。

## 已实现、不要再报为缺口

- 154 个 manifest 组件在 React/Vue/Solid/Svelte 四端对齐；616 份框架契约
  全部 native，`unavailable = 0`。
- 42 个共享行为 scenario 均接入四端；包含 Table resize/edit、异步
  DataSource、overlay open/dismiss、portal destroy 与 focus restore。
- resilience 原语已进入真实 CMS 数据/事件消费路径。
- 四框架 CMS 的 auth/RBAC、资源页、设置持久化与浏览器 E2E 已接线；四端均
  直接实现 dashboard/login/users/settings/workspace，没有 `GenericPage`。
- Next/Nuxt/SolidStart/SvelteKit 均有 data/feedback 多路由、hydration 与生产
  路由测试。
- 发布安全元数据已存在：`SECURITY.md`、Dependabot、npm provenance、依赖审计。
- registry、marketplace 与 CLI add/diff/update 工作流已落盘；远程
  item/file、runtime resource/font 的 SHA-256 以及更新冲突/回滚路径已覆盖。
- 27 个可发布包均纳入外部 npm pack/install consumer 门；CI 另设
  `IRIS_REQUIRE_NATIVE_BUILD=1` 的 Electron/Tauri/Wails strict job。
- release workflow 默认拒绝运行；只有仓库变量
  `IRIS_NPM_RELEASE_ENABLED=true` 且 `main` push CI 成功时，才跟随精确
  `head_sha`，不会跟随 PR 或失败的 CI。
- Svelte `asChild` 的 `slotProps.merge(...)` 已覆盖 SSR/客户端 class、style、
  parent-first handler 合并；无冲突的直接 spread 保持兼容。
- 复杂组件补测发现并修复 Solid DateRangePicker owner 泄漏，以及 Svelte
  TagInput 空白逗号段与尾逗号 DOM 不清空。
- admin、charts、query-builder、notifications、markdown、form-builder、
  pro-table 等插件已具备四框架实现。

## 决策门

- **首次 npm 发布**：必须由维护者明确授权；不要自行执行 `npm publish` 或触发
  等价发布动作；不要代替维护者设置 `IRIS_NPM_RELEASE_ENABLED` 或选择版本。
- **QRCode**：当前明确跳过；只有确定编码器与真实扫描验证方案后再立项。
- **ROADMAP v3 架构投入**：新框架、可变高度虚拟化、状态机/代码生成扩展等，
  需要维护者选择范围和优先级。

## Deferred by design

- Tree + `renderDetail` 使用可变行高时不启用现有定高虚拟化。
- 真浏览器/真实设备难以稳定自动化的极端平台行为继续由宿主集成测试承担。
- 纯重构、命名统一或无具体缺陷信号的“为了对齐而改”不进入功能 backlog。
