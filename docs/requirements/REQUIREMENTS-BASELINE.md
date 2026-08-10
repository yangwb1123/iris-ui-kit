# Iris UI 功能需求基线

> 生成日期：2026-08-07 · 来源：manifest.json（151 组件 × 4 框架）+ 仓库文档。
> 本文件是组件库功能需求的机器可核验基线；组件契约以 `manifest.json`/`llms.txt`
> 为准（源码生成），本文件只记录需求语义。

## 1. 核心需求

| ID  | 需求                                                                                   | 验证                                            |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| R1  | 一套框架无关 core 定义全部组件行为，四个适配器（react/vue/solid/svelte）同名同语义薄桥 | manifest 616 份 native contract / 0 unavailable |
| R2  | 组件样式 100% 由 `--iris-*` token 驱动，禁止硬编码 hex/裸像素值                        | `iris-ui-spec.py --mode all` = 0 违规           |
| R3  | 重型能力按需插件化（12 插件），core 保持精简                                           | `IrisProvider(plugins=[…])` + 12 plugin-\* 包   |
| R4  | AI 原生消费：manifest.json / llms.txt / MCP（11 工具）                                 | `pnpm gen:manifest` + `check:manifest`          |
| R5  | 主题系统：light/dark + 皮肤（继承/持久化/防闪）+ RTL + reduced-motion                  | theme/skins 包测试                              |

## 2. 组件面需求（151 × 4）

| 分组       | 数量 | 关键需求                                                                                                             |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| primitives | 115  | 展示/表单/浮层/反馈/导航/数据 全谱系原语；受控+非受控双模                                                            |
| behaviors  | 6    | ClickOutside/Hotkey/LongPress/Movable/Resizable/Sortable 正交包裹器                                                  |
| layouts    | 7    | Container/Grid/Stack/Sidebar/Header/DashboardGrid                                                                    |
| skeletons  | 2    | Login/Dashboard 模板（真实页面骨架）                                                                                 |
| other      | 7    | AdminLayout/NavMenu/Provider/ErrorBoundary/I18nProvider                                                              |
| form       | 1    | IrisForm（core 表单引擎驱动，+FormField）                                                                            |
| plugin     | 13   | ProTable/FormBuilder/Charts×3/Calendar/Kanban/Markdown/CodeEditor/QueryBuilder/NotificationCenter/Dashboard/AdminApp |

## 3. Core 逻辑需求

- 引擎：store/machine/form/i18n/virtual/async/pagination/tabsNav
- 控制器：selection/expansion/data-view/roving/admin-shell/resource/cell-edit/
  cell-range/sortable/window/profile/commands/notifications/fs/clipboard-history
- 数据韧性 9 原语：disposable/query-cache/realtime/outbox/event-bus/
  circuit-breaker/rate-limiter/resilient-fetcher/data-source

## 4. 非功能需求

| 维度       | 需求                                                               | 门禁                   |
| ---------- | ------------------------------------------------------------------ | ---------------------- |
| 跨框架一致 | 同组件 4 框架像素一致（solid/svelte <2%；vue 2.8% 已知渲染基线）   | visual-parity.spec.ts  |
| 可访问性   | WCAG A/AA + axe 零违规                                             | 各包 a11y 测试         |
| SSR 安全   | React 'use client'、无 DOM 测试、hydrate 一致                      | check:rsc + ssr 测试   |
| 设计系统   | token 刻度完整（font 9 档/space 4pt/radius/shadow/control.height） | audit:tokens 0 unknown |
| 质量       | 180/180 turbo tasks、覆盖率门、bench、包外部安装                   | CI                     |
| 分发       | 27 包可发布、registry SHA-256、默认拒绝发布                        | release.yml            |

## 5. 设计统一需求（2026-08 迭代新增）

| ID  | 需求                                                       | 状态                                            |
| --- | ---------------------------------------------------------- | ----------------------------------------------- |
| D1  | 字号/间距/阴影/圆角全部 token 化（589 违规归零）           | ✅ 完成（b69c9a27）                             |
| D2  | 四框架 CMS 同一页面用同一组件（UsersPage 迁移 IrisTable）  | ✅ 完成（39b9a2d6）                             |
| D3  | 组件局部 CSS 变量值必须与其他框架对齐（值≠命名豁免）       | ✅ 完成（9 处修复）                             |
| D4  | 插件注册 token 必须被渲染层消费（嵌套 var）                | ✅ 完成                                         |
| D5  | 彩色表面前景对比度纪律（on.color/warning.foreground）      | ✅ 完成                                         |
| D6  | 设计智能评审（18 项全部落地）                              | ✅ 完成（docs/ui-audit/design-intelligence.md） |
| D7  | 四框架视觉门禁（solid/svelte 0.02 硬门 + vue 0.05 回归门） | ✅ 完成                                         |

## 6. 明确不做

- QRCode（需真实编码器与扫描验证）
- 首次 npm 发布（维护者授权门）
- ROADMAP v3 架构投入（新框架/可变高度虚拟化/状态机做厚）
