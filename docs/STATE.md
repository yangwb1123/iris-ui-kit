# STATE

> 当前工作树快照。日期：2026-08-20。历史过程见 `CHANGELOG.md`，架构约束见
> `ARCHITECTURE.md` 与根目录 `AGENTS.md`。

## 当前事实

- 27 个可发布 package；版本已准备，但首次 npm 发布尚未获维护者授权。
- `packages/manifest/manifest.json` 当前记录 155 个组件，React / Vue / Solid /
  Svelte 均为 155，名称完全对齐；620 份 `frameworkContracts` 全部为
  `source: native`，没有 `unavailable`。
- 共享行为位于 `@iris-ui-kit/core`，四个框架包是渲染与反应式薄桥。
- 12 个 `plugin-*` 包覆盖 admin、calendar、charts、dashboard、editor、
  form-builder、kanban、locale-zh、markdown、notifications、pro-table 与
  query-builder。
- 行为契约共有 42 个 scenario；每个 scenario 均已接入四个适配器，并由
  manifest 的 contract-coverage 守卫检查。
- `@iris-ui-kit/registry`、`@iris-ui-kit/marketplace` 与 CLI registry
  工作流已在源码中；远程 registry item/file 与 marketplace resource/font
  支持 SHA-256 完整性校验，官方模板位于 `registry/`。
- 四套 CMS 由同一套共享 auth/resource/settings 逻辑驱动。Playwright 配置会
  将同一条登录、数据页、设置持久化与 RBAC 路径重放到四个真实浏览器 bundle；
  React 项目另有 3 张视觉基线。四端均直接实现 dashboard/login/users/settings/
  workspace 页面，不存在 `GenericPage` 兜底。
- SSR 参考面覆盖 Next App Router、Nuxt、SolidStart 与 SvelteKit；四套应用均有
  data/feedback 多路由、hydration 与生产 HTTP 路由测试。
- Electron、Tauri 与 Wails 壳共享 `window.irisNative` 文件保存/剪贴板契约；
  CI 的独立 `native-linux` job 以 `IRIS_REQUIRE_NATIVE_BUILD=1` 禁止静默跳过。
- `release.yml` 默认拒绝运行；只有维护者显式设置仓库变量
  `IRIS_NPM_RELEASE_ENABLED=true`，且 `main` 的 push CI 成功后，才 checkout
  对应 `workflow_run.head_sha`。开关与首次版本仍是维护者决策门。

## 本轮落盘的功能闭环

- 发布安全、依赖升级与供应链元数据。
- token/skin/icon 安全与语义补齐。
- 四框架 manifest/export/package 原生契约（620 native / 0 unavailable）。
- CMS 真实 auth/RBAC、资源 CRUD、持久化设置与韧性原语消费。
- 安全 Markdown、持久化通知、dashboard、ProTable、FormBuilder、Editor。
- Charts、QueryBuilder、Admin schema-driven CRUD/query/permission 插件。
- Table 文件导出、四框架浏览器 E2E/视觉回归、coverage/bench/arch 门。
- registry/marketplace/CLI SHA-256 工作流与四套 SSR 参考应用同等扩展。

## 验证状态

当前整仓主门 `test/typecheck/lint/build` 为 180/180 Turbo tasks。已通过：

- 冻结 lockfile 安装、依赖审计（0 known vulnerabilities）与
  brace-expansion CJS/ESM 兼容；
- 27 个可发布包的外部 npm pack/install、ESM/CJS、类型、Svelte consumer 与
  CLI smoke；
- 155 × 4 manifest 连续生成哈希一致、`admin-layout` 四框架 registry 模板和
  3 个声明式 runtime resource；
- size、tokens、RSC（58 entries）、desktop parity（20 apps / 23 features）、
  bench（25/25 Turbo tasks）和 architecture ratchet；
- 四框架 CMS Playwright + React visual baselines（19/19）；
- Next、Nuxt、SolidStart、SvelteKit 的 build、hydration 与 production routes；
- core V8 coverage：103 test files / 1594 tests，statements/lines 95.58%、
  branches 92.83%、functions 96.18%。
- 适配器覆盖启发式：529 files / 80,931 lines，high-complexity `<100` 为 0；
  React 2815/2815、Vue 1545/1545、Solid 986/986 + hydration 38/38，
  Svelte 942/942 + hydration 35/35。

本轮批 DL–DT 已完成：React Table 增加 patternFill/autoSaveState/headerStats、
显式 opt-in 的 contextMenu.formatActions、scrollbarThumb、rowDragBetween、
editKeys、widthHint 与按 key 的 exportRowsCsv；专项 10/10，React 全量
2815/2815。默认关闭路径保持兼容，格式化动作未启用时不会改变既有菜单。

补测同时修复了 Solid DateRangePicker 的 owner 外惰性 computation 泄漏，以及
Svelte TagInput 忽略空白逗号段、尾逗号后同步清空 DOM 输入值的边界缺陷。
Manifest 与文档参考生成物均已通过生成前后内容一致性检查。权威逐项状态见
`SPRINT.md`。

本轮 Grid follow-up 已完成：Vue 远程非空 filters 的 SSR 初始态与 summary
`__expand` 轨道、Solid/Svelte 同语义 summary 轨道及两端 SSR 过滤护栏均有回归；
Solid/Svelte/Vue 表格的渲染职责已安全拆分，`arch-check:ratchet` 无阻断项。

## 仍需维护者决定

1. 首次 npm 发布：不可逆外部动作；版本与流水线就绪不等于已授权发布。
2. QRCode：需要真实编码器与可扫描性验证，当前按明确决定跳过。
3. ROADMAP v3 架构级方向：例如新框架适配器、可变高度虚拟化、进一步做厚
   状态机或代码生成，须维护者选择后再投入。

## 2026-08-07 设计系统统一迭代（ai-batch-runner 驱动）

- tokens 补全产品级刻度：font.size 9 档（xs~~4xl）+ weight/line-height/
  letter-spacing；space.xxs~~5xl 4pt 刻度 + control.height；shadow.xl；
  on.color / warning.foreground（对比度纪律）；font.size.md 15→14、
  lg 18→16（消费面仅 drawer/charts）。
- 全仓 589 处设计违规归零（裸字号/魔法间距/fallback 漂移/硬编码阴影/
  未知 token/裸 hex），组件样式 100% token 驱动。
- 四框架视觉验证：Solid/Svelte 与 React 像素一致（<2%）；Vue 2.8%
  为框架渲染本质差异（border 1px 抗锯齿），记录已知基线。9 处组件库
  跨框架漂移修复（root font-size/表头字号/selection 列 padding/striped
  位置/AdminTabs trigger/NavMenu active 特异性/Shell trigger/svelte
  render 支持/NavMenu padding）。
- Vue/Svelte CMS UsersPage 迁移 IrisTable（对齐 react/solid）。
- 新增长期资产：iris-ui-spec.py 机械门禁、visual-parity.spec.ts 像素
  门禁（4 框架分发）、docs/requirements/REQUIREMENTS-BASELINE.md。

## 2026-08-07 设计智能评审修复批

- 评审产出 docs/ui-audit/design-intelligence.md（6 维度 + component-spec）。
- 落实 12 项 [MECHANICAL]：info tone 统一、focus ring color-mix、
  backdrop token、Card hover、Select 界高、Button :active、Statistic
  trendTone、Gauge 诚实值、Badge solid 对比度、数字列右对齐、Table
  错误态重试按钮（onRetry）、Button danger variant。
- 剩余 [JUDGMENT] 项（Table 选中计数/Select 选中项软化/空态文案/
  Gauge 阈值映射）记录在评审报告，待维护者决策。
