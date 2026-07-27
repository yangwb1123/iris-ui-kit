# ROADMAP

> 产品与工程方向的短快照。日期：2026-07-27。已完成过程见
> `CHANGELOG.md`，当前执行清单见 `SPRINT.md`。

## 当前产品面

Iris UI 是 token-driven、四框架、插件可扩展的 UI 基础设施：

- 154 个 manifest 组件在 React / Vue / Solid / Svelte 完全对齐；616 份框架契约
  全部为原生源码提取，`unavailable = 0`。
- core 承载共享控制器、状态机、表单、数据视图、i18n、virtual、异步与
  resilience；适配器保持薄桥。
- 12 个四框架插件覆盖 admin、数据/内容编辑、图表、表单、日历、看板、通知
  与查询等重型能力。
- typed registry + marketplace + CLI + manifest/MCP 组成 AI/源码分发面；远程
  registry item/file 与 marketplace resource/font 由 SHA-256 完整性契约守护。
- 四框架 CMS 的 dashboard/login/users/settings/workspace 都是真实页面，没有
  `GenericPage` 兜底；Next/Nuxt/SolidStart/SvelteKit 均有多路由、hydration 与
  production-route 证明。
- VitePress、playground 与 Electron/Tauri/Wails 三种桌面壳补齐参考面；CI
  另设不允许 native build 静默跳过的严格 Linux job。
- 共享行为契约、单元/SSR/axe 测试、真实浏览器 E2E/视觉回归、coverage、
  benchmark、包安装与架构 ratchet 组成质量面。

## P0 — 当前版本收口

1. 以 `SPRINT.md` 中仍未完成的实际门为准继续收口，修完而不是绕过失败。
2. 保持生成物、27 包外部安装、bundle 预算、registry 模板和所有 SSR/CMS
   参考应用与源码同步。
3. 将最终验证结果写入 STATE/SPRINT/CHANGELOG；未验证的数字不进入状态声明。

## P1 — 发布准备

代码侧发布流水线、provenance、安全策略、依赖自动更新和 27 包外部消费 smoke
已具备。`release.yml` 默认拒绝运行；维护者须显式设置仓库变量
`IRIS_NPM_RELEASE_ENABLED=true`，之后仍只接受 `main` 的成功 push CI，并
checkout 对应的不可变 `head_sha`。首次 npm 发布本身是不可逆外部动作，开关与
最终版本均需维护者明确确认。

## P2 — 维护者选择的 v3 方向

以下不是当前功能缺口，不自动开工：

- 新框架适配器或更深的框架级 SSR/reference 产品化。
- 可变高度虚拟化等高复杂度数据视图能力。
- 状态机、schema admin、registry/MCP/codegen 的下一阶段做厚。
- 新插件品类与生态治理。

## 明确不做

- QRCode：在选定正确编码器与真实扫描验证方案前保持跳过。
- 为追求表面一致而改变框架惯用 API、引入动态组件注册或破坏 tree-shaking。
- 未经授权发布任何 npm 包。
