# SPRINT

> 2026-07-27 收口清单。产品方向见 `ROADMAP.md`。

## Sprint goal

把本轮已落盘的功能从“局部实现/局部验证”推进到整仓可交付状态；任何失败都回到
源码修复，不以放宽门、跳过测试或虚报数字收尾。

## 功能面

- [x] 安全、tokens/skins/icons、manifest/package 契约（616 native /
      0 unavailable）。
- [x] CMS auth/RBAC、真实 dashboard/login/users/settings/workspace、设置持久化
      与 resilience 消费（无 `GenericPage`）。
- [x] 四框架 plugin admin/charts/query-builder/notifications/markdown 等补齐。
- [x] Table export、四框架浏览器旅程、视觉回归与 hard bench。
- [x] registry/marketplace/CLI SHA-256/回滚路径与四套 SSR reference 的
      data/feedback、hydration、production-route 对齐。
- [x] 27 包外部 consumer 门、strict native Linux job，以及默认拒绝运行、需
      维护者授权开关并仅跟随成功 push CI 的 release workflow。

## 最终验证

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm check:brace-expansion-compat` 与依赖审计（0 known vulnerabilities）
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm check:pack-install`（27 个可发布包 + 外部 TS/Svelte consumer）
- [x] `pnpm check:manifest` 与 `pnpm check:docs-reference`（生成前后内容一致）
- [x] `pnpm check:registry`（`admin-layout` 四框架 + 3 个 runtime resources）
- [x] `pnpm size`
- [x] `pnpm audit:tokens`
- [x] `pnpm test:coverage`（388 files / 41,086 lines；high-complexity 缺口 0）
- [x] `pnpm turbo run test:coverage:v8 --filter=@iris-ui-kit/core`
- [x] `pnpm check:desktop-parity`
- [x] `pnpm check:rsc`
- [x] `pnpm test`
- [x] 四框架 CMS Playwright E2E + React visual baselines（19/19）
- [x] `pnpm bench`（14/14）
- [x] `pnpm arch-check:ratchet`
- [x] 四套 SSR 应用的 build/test/typecheck/lint 与 production-route 验证

本次整仓主门为 180/180 Turbo tasks；core V8 coverage 为 statements/lines
91.75%、branches 90.65%、functions 94.5%（70 files、1093 tests）。
适配器复杂组件补测中，Solid 目标 80/80、全包 873/873 + SSR 34/34；
Svelte 目标 83/83、全包 855/855 + SSR 31/31。

## 完成定义

- 所有当前功能点有实现与对应层级的验证。
- 四框架导出和行为契约仍保持对齐，manifest 保持 616 native /
  0 unavailable。
- 生成 manifest/llms、包 tarball、registry 模板与源码一致。
- 四套 CMS 保持真实页面实现，四套 SSR reference 保持多路由生产证明。
- 文档记录实际通过结果，不记录估算或旧会话数字。
- 不执行首次 npm 发布；该动作留给维护者授权。

## 2026-08-07 设计系统统一与设计智能收口

- token 刻度补全 + 589 设计违规归零 + 四框架视觉一致（solid/svelte
  像素级；vue 2.8% 已知基线，0.05 回归门）。
- 设计智能评审 18 项全部落地（Button danger/Select 空态+界高+软化/
  Table 计数+重试+数字右对齐/Card hover/对比度/backdrop/info tone/
  focus ring/Gauge 诚实值/Statistic trendTone/空态文案）。
- 门禁：180/180 turbo、审计 0 违规、visual-parity 四框架 PASS、
  format/arch/token 全绿。
- 记录项：Gauge 阈值映射（显式 status，注释已给建议）。
