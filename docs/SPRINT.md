# SPRINT

> 2026-08-20 收口清单。产品方向见 `ROADMAP.md`。

## Sprint goal

把本轮已落盘的功能从“局部实现/局部验证”推进到整仓可交付状态；任何失败都回到
源码修复，不以放宽门、跳过测试或虚报数字收尾。

## 功能面

- [x] 安全、tokens/skins/icons、manifest/package 契约（620 native /
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
- [x] `pnpm test:coverage`（529 files / 80,931 lines；high-complexity 缺口 0）
- [x] `pnpm turbo run test:coverage:v8 --filter=@iris-ui-kit/core`
- [x] `pnpm check:desktop-parity`
- [x] `pnpm check:rsc`
- [x] `pnpm test`
- [x] 四框架 CMS Playwright E2E + React visual baselines（19/19）
- [x] `pnpm bench`（25/25 Turbo tasks）
- [x] `pnpm arch-check:ratchet`
- [x] 四套 SSR 应用的 build/test/typecheck/lint 与 production-route 验证

本次整仓主门为 180/180 Turbo tasks；core V8 coverage 为 statements/lines
95.58%、branches 92.83%、functions 96.18%（103 test files、1594 tests）。
适配器全量回归：React 2815/2815、Vue 1545/1545、Solid 986/986 + hydration
38/38、Svelte 942/942 + hydration 35/35。

本轮追加批 DL–DT：`patternFill`、`autoSaveState`、`headerStats`、右键格式化
动作、滚动条拇指、外部行拖放、`editKeys`、列宽提示和按 key 导出均已落盘；
专项回归 10/10，React 全量 2815/2815。右键格式化动作由
`contextMenu.formatActions` 显式启用，默认菜单保持兼容。

## 2026-08-20 Grid follow-up（当前工作树）

- Vue 批 Y 复核已补齐：远程非空 filters 的 SSR 不请求回归、summary 的
  `__expand` 轨道与 body 对齐；Vue package 1545/1545。
- Solid/Svelte summary 同步加入 `__expand` 轨道与 grid-template 对齐断言，并
  各自补充远程过滤 SSR 不请求回归；Solid 986/986 + hydration 38/38，Svelte
  942/942 + hydration 35/35。
- 表格渲染职责已拆出到 `table-summary*` 与 Vue 状态行渲染器；`pnpm
arch-check:ratchet` 当前无阻断项。

## 完成定义

- 所有当前功能点有实现与对应层级的验证。
- 四框架导出和行为契约仍保持对齐，manifest 保持 620 native /
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

## 2026-08-08 迭代记录（react 适配器，未提交）

- `IrisTree` 新增 opt-in `virtual?: IrisTreeVirtualOptions`（窗口化扁平节点
  列表）：零 core 改动，复用 `createVirtualizer` + `IrisVirtualScroll` 桥；
  键盘导航滚动到活动行 + 焦点跟随（rAF 重查、过期链丢弃）；不传 `virtual`
  与之前逐字节一致。react 包 1478/1478 测试 + typecheck/lint/build 全绿。
- 门禁状态以实际跑通为准：本条目记录迭代内容，不预宣称整仓门。
