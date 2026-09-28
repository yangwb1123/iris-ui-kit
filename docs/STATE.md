# STATE

> 当前工作树快照。日期：2026-09-27。历史过程见 `CHANGELOG.md`，架构约束见
> `ARCHITECTURE.md` 与根目录 `AGENTS.md`。

## 当前事实

- 组件数/契约数的唯一真相源是 `packages/manifest/manifest.json`（`pnpm
gen:manifest` 生成）。文档里的手写计数由 `pnpm check:doc-facts` 对账，漂移
  即 CI 失败。
- 仓库根不再跟踪 `manifest.json`/`llms.txt`（`.gitignore` 已声明为生成物）；
  之前被 git 忽略却留在索引里的 151 组件副本已 `git rm --cached`，避免被误读为
  权威值。
- 156 → 157 的新增组件是 `IrisIconPicker`（`primitives` 117 / `plugin` 16 /
  `other` 7 / `behaviors` 7 / `layouts` 7 / `skeletons` 2 / `form` 1，合计 157）。
- 27 个可发布 package；版本已准备，但首次 npm 发布尚未获维护者授权。
- `packages/manifest/manifest.json` 当前记录 157 个组件，React / Vue / Solid /
  Svelte 均为 157，名称完全对齐；628 份 `frameworkContracts` 全部为
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
- 四框架 manifest/export/package 原生契约（628 native / 0 unavailable）。
- CMS 真实 auth/RBAC、资源 CRUD、持久化设置与韧性原语消费。
- 安全 Markdown、持久化通知、dashboard、ProTable、FormBuilder、Editor。
- Charts、QueryBuilder、Admin schema-driven CRUD/query/permission 插件。
- Table 文件导出、四框架浏览器 E2E/视觉回归、coverage/bench/arch 门。
- registry/marketplace/CLI SHA-256 工作流与四套 SSR 参考应用同等扩展。

## 验证状态

### 跨框架对齐度已可度量（2026-09-27 新增）

`unavailable = 0` / 628 native 只证明四个 barrel 都**抽到了**组件，不证明它们
**是同一个组件**。原门禁从未跨框架比对过 prop，于是对齐差距在 CI 全绿下完全不可见。

新增 `manifest.stats.parity` 与 `pnpm check:parity`（棘轮式，只允许变好）：

| 指标                   | 实测                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| 四端 prop 名完全一致   | **7** / 157                                                         |
| 近似一致（≥80%）       | **8**                                                               |
| 发散（<80%）           | **142**                                                             |
| 平均共有 prop 名       | **43%**                                                             |
| prop 声明总数          | react 1264 · vue 845 · solid 1160 · svelte 1202                     |
| 仅单框架拥有的 prop 名 | react **221** · vue 69 · solid 109 · svelte 124                     |
| 最大 surface 不对称    | `IrisPopoverContent` **5x**（react 4 / vue 1 / solid 4 / svelte 5） |

该指标是**可见性指标，不是及格线**：四框架契约有意保持框架惯用
（Vue `modelValue`/`update:modelValue`、Solid `onChange`、Svelte 回调 props），
因此低共有率可能只意味着“命名不同”。因此同时输出 `surfaceAsymmetry`（最大/最小
prop 数之比）—— 命名惯例无法解释 3 倍差距，不对称度高才是能力缺失的强信号。

`check:parity` 从 `frameworkContracts` **重算**而非信任 `stats.parity`，并在两者
不一致时报错，因此过期或手改的 roll-up 无法蒙混过关。已反向验证：能力退化→失败、
roll-up 过期→失败、对齐变好→通过。

阻塞与建议已拆分：**能力丢失**（`propTotals` 减少、平均/最低共有率下降、`divergent`
增加、逐组件 ratio 下降）阻断；**新增单框架 prop 名**只建议不阻断——它可能是新能力，
也可能是没有对应物的框架惯用 prop（Solid `ref`、Svelte `onclick`）。不拆分的话，
“把 `asChild` 移植到新适配器”这种正确工作反而会因其惯用 `ref` 而卡门。

门禁从 `frameworkContracts` 重算并与 `stats.parity` 交叉校验，两者不一致即失败——
这一步确实生效过：加入 intrinsic-spread 剔除后，门禁的重算逻辑尚未同步，当场报出
`identical: contracts say 7, stats.parity says 5`，而不是默默放行。

### asChild 能力补齐（2026-09-27 新增）

对齐度指标上线后立即暴露一处**真实能力缺失**：`asChild`（AGENTS.md 列为头号组合
模式）在四端不一致——

|        | react      | vue | solid | svelte |
| ------ | ---------- | --- | ----- | ------ |
| 补齐前 | 7 个组件有 | 7   | **0** | 3      |
| 补齐后 | 7          | 7   | **7** | **7**  |

即 `<IrisButton asChild>` 一直可用，但 `<IrisPopoverTrigger asChild>` 在 solid/svelte
上**静默忽略该 prop**。已按各适配器既有模式补齐 solid 7 个（DialogTrigger/Close、
DrawerTrigger/Close、MenuTrigger、PopoverTrigger、TabsTrigger）与 svelte 3 个
（MenuTrigger、PopoverTrigger、TabsTrigger），并新增 13 + 9 个测试。唯一剩余差异
`IrisSlot` 是假阳性：它本身就是原语，永远无包裹，svelte 声明 `asChild` 仅为源码兼容。

期间发现并修复一个**真实响应式 bug**：Solid `IrisTabsTrigger` 默认分支曾把
`triggerProps` 的 getter 读成静态值（`aria-selected={triggerProps['aria-selected']}`），
会把 tab 的 ARIA 状态冻结在首次渲染；已改回内联响应式表达式，asChild 分支保留 getter。

期间还定位到一个**已存在的 Svelte 陷阱**：`asChild` 子元素若是 slot-aware 组件
（如 `IrisButton`），普通 spread `{...props.attrs}` 会把父 handler 绑定两次（组件
再 spread 到自己的元素），幂等行为（`setOpen(true)`）无感，但 toggle 行为
（`setOpen(!open)`）会开了又立即关掉，表现为 trigger “完全失灵”。这正是 AGENTS.md
要求此类子元素改用 `{...slotProps.merge({ … })}` 的原因；新增 harness 均按此写法。
（注：现有 Dialog/Drawer harness 用普通 spread，因为 `setOpen(true)` 幂等而未暴露。）

### 抽取完整性：intrinsic-spread（2026-09-27 新增）

对齐度上线后发现 3 个组件在 react/vue 上 `props = 0`，而 solid/svelte 有 `children`。
排查结论：不是能力缺失，而是**抽取缺口**——它们把 props 写成对框架内建属性集的裸引用：

```ts
export type IrisVisuallyHiddenProps = React.HTMLAttributes<HTMLSpanElement>
```

该别名既无对象字面量也不引用本地 `Iris*Props`，原抽取路径只能得到空数组。共 8 处
（react 5、solid 2、svelte 1）。空 `props` 数组有歧义：运行时组件**仍会转发整个属性集**。

修复：新增 `propsSource: 'intrinsic-spread'` + `intrinsicAttributes`（源码原样），
`llms.txt` 显式输出 “forwards the whole attribute set … do NOT treat as prop-less”。
同时把这 5 个组件从对齐度分桶中**剔除**并单列 `intrinsicSpread`——拿“转发全集”与
“显式声明 3 个”比共有名，量的是抽取缺口而非能力缺口。

剔除后反而暴露了 2 个**假阳性**：`IrisDropdownSeparator` / `IrisMenuSeparator` 先前
“identical” 只是因为四端都抽到 0 个 prop。真正的 identical 只有 5 个。

分桶：identical 5 · near 8 · divergent 139 · intrinsic-spread 5 · mean 44%
（identical 由 7 降到 5 是修正，不是退化：逐组件 ratio 无一下降，已核对。）

发现并修复了一个使多个门禁**静默失效**的缺陷：pnpm 的全局启动器故意不带
shebang，而 macOS 的 libc 不会重试无 shebang 的文件，因此
`spawnSync('pnpm', …)` 直接返回 `ENOEXEC`（`status = null`）。旧代码把
`status !== 0` 一律当作“检查失败”，于是**环境坏掉与真实漂移不可区分**：

- 受影响：`check:manifest`、`check:docs-reference`、`check:pack-install`
  （27 包）、`check-bench-regression`。
- 修复：新增 `scripts/lib/run-pnpm.mjs`（优先用 `npm_execpath` + 当前 Node，
  否则经 shell 包装），并在**无法启动时以 exit 2 + 明确诊断退出**，不再伪装成
  门禁失败。
- 修复后首次真实运行即暴露真实漂移：生成物为 **157 组件**（而非之前记录的
  155/156），且 `apps/docs/components.md` 确实过期——两者已重新生成。

`format:check` 当前仍有 **16 个存量违规**（均在本次未改动的文件里：core 8、
svelte 4、vue 1、cms-svelte 4 中的重叠项），属先前遗留，非本次引入。

当前整仓主门 `test/typecheck/lint/build` 为 180/180 Turbo tasks。已通过：

- 冻结 lockfile 安装、依赖审计（0 known vulnerabilities）与
  brace-expansion CJS/ESM 兼容；
- 27 个可发布包的外部 npm pack/install、ESM/CJS、类型、Svelte consumer 与
  CLI smoke；
- 157 × 4 manifest 连续生成哈希一致、`admin-layout` 四框架 registry 模板和
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

### asChild 合并语义下沉 core（2026-09-27 新增）

AGENTS.md 把 `IrisSlot` + `mergeSlotProps` 列为头号组合模式，但 core 里**并没有**
`mergeSlotProps` —— 决策表（class 顺序、style 顺序、handler 组合、子值优先）被
4 个适配器各自重推一遍，四端可能漂移。

新增 `packages/core/src/slot.ts`（框架无关；core 保持 `lib: ["ES2022"]` 无 DOM，
live-element helper 改用结构化类型而非 `Element`/`HTMLElement`）：

| adapter | 前  | 后      |
| ------- | --- | ------- |
| react   | 78  | **55**  |
| vue     | 162 | **129** |
| solid   | 273 | **163** |
| svelte  | 221 | **148** |

适配器只保留真正框架相关的东西：子元素解析、ref 扇出，以及把合并结果交给自己的
渲染器（`cloneElement` / `h` / `spread` / attachment）。React 通过选项适配
`className` 与 style 对象；Solid 保留 SSR 字符串宿主（用 core 的 `patchOpeningTag`）；
Svelte 只剩 attachment。core 新增 50 个单测。

**代价如实记录**：同工具链 A/B 实测 svelte 发布体积 **301.5KB → 302.7KB
（+1.2KB gzip）**。收益是一致性而非体积 —— core slot 模块会被内联进 adapter 产物。
（把 110 个事件名改为紧凑字符串后体积无变化，说明增量来自模块本身。）

**代价二**：`isEventProp` 原先只认 `/^on[A-Z]/`；Svelte 的小写 `onclick` 若照搬
会误判，实测 `once`/`only`/`one` 这类以 "on" 开头的普通 prop 会被当成事件。故小写
形式改为对已知 DOM 事件名白名单校验（110 个名字），这会略微改变旧行为，但方向是
把误判改对。

### react Table.tsx 首次切分：url-state（2026-09-27 新增）

`Table.tsx` 9140 行是全仓最大源文件，且被 arch baseline 永久豁免（"Table 这类天然
内聚的大文件"），等于永不受 size 门约束。table 模块其实已高度分解（100+ 文件、
次大仅 1222 行），`Table.tsx` 是唯一离群点。

本步切出最后一块**模块级**接缝：URL 状态深链（`url-state.ts`，158 行）—— 纯
视图状态序列化，无 React、无 table 实例，仅 `typeof window` 做 SSR 守卫。
9140 → 9006 行（−134）。

公共 API 未变：`Table.tsx` 与 table barrel 继续导出
`IRIS_URL_STATE_KEY` / `decodeUrlTableState` / `readUrlTableState` /
`writeUrlTableState` / `serializeUrlTableState` / `IrisTableUrlState`。

**可量化结果**：`arch-check:ratchet` 违规 **16 → 15** —— `Table.tsx` 从 9141 行降到
baseline(9137) 以下，该项豁免自然消失。

**剩余部分的判断**：剩下 9006 行是**单个组件函数体**（约 500 个交错的 const
声明），模块级接缝已用尽。继续切只能按"关注点"切 hook 簇（如列淡入淡出
624–698、adaptive-height 699–770），每个簇都要穿引十几个闭包变量 —— 这是多批次工程，
需要逐簇设计，不宜即兴拆分。

### react 测试存在存量偶发失败（非本次引入）

拆分过程中发现 `packages/react` 全量套件**偶发**失败：同一提交连跑，1–3 个测试
间歇失败。已用 stash 对照确认**先于本次改动存在**（原代码 5 次跑中 3 次失败，
带我的改动 3 次跑中 1 次失败），且这两个文件**两两同跑 6 次全绿** —— 只在全套
并行负载下出现。

机理：测试对异步 effect 用**精确调用次数**断言
（`await waitFor(() => expect(query).toHaveBeenCalledTimes(2))`），并行负载下多一次
渲染/请求即失配（失败用例耗时 1044ms vs 单独跑 114ms）。涉及
`src/primitives/table/test/multi-sort.test.tsx` 与 `src/grid/useGridCore.test.tsx`。
建议改为断言 `lastCall` 的形状而非次数 —— 属于独立工作项，本次未动。

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

## 2026-09-28 收口批（ai-batch-runner / pbatch 驱动）

本轮把 `~/workspace/demo/ai-batch-runner` 接进 iris-ui：仓库根新增
`pi-batch.yaml`（validators 直接指向本仓门禁：`node cli.mjs check`、
`pnpm typecheck|lint|test`、`check:parity`、`check:manifest`、
`check:doc-facts`、`audit:tokens`、`arch-check:ratchet` …），
批次定义放 `ai-dev/pbatch/tasks/`。**pbatch 的交付物是 agent 的 stdout**，
所以任务 prompt 必须要求“把完整报告打印在最终回复里”，且禁止 agent 自行
写 output 文件——否则 pbatch 落盘时会用一句“报告已写入 …”覆盖掉报告正文。

### 环境级阻塞（先修，否则任何 agent 都起不来）

- pi 的 `anthropic` OAuth refresh token 已过期（`invalid_grant`），pi 在启动
  阶段解析凭据时直接 exit 1，**所有** `pi -p` 不可用，与 provider 无关。
  隔离该条凭据后恢复（备份 `~/.pi/agent/auth.json.bak-20260928-051718`，
  重新登录即可复原）。剩余可用 provider：`openai-codex`；
  `opencode-go` 配额耗尽（breaker 24h 冷却）、`opencode` 余额不足。
- pbatch 无全局 provider 默认值（只有 per-task `provider:`），且
  `pi-batch.yaml` 里的未知键（如 `agent.default_provider`）会被静默忽略而
  `config check` 仍报 OK——provider 必须逐任务写。

### 门禁并非全绿：实跑发现并修复 4 个真实缺陷

1. **`plugin-locale-zh` 漏 16 条 `iconPicker.*` 译文**：`IrisIconPicker`
   进入 157 组件后没同步中文包，`localeZhPlugin` 的“每个内置 key 都必须有
   中文”回归直接变红。
2. **`scripts/lib/run-pnpm.mjs` 把 pnpm 原生二进制当 JS 入口**：
   `npm_execpath` 指向 `@pnpm/exe.<platform>/pnpm`（无扩展名的 Mach-O）时，
   旧正则仍走 `node <binary>`，得到 `SyntaxError: Invalid or unexpected
token` + 非零退出码——**与真实门禁失败不可区分**。后果：`pnpm
check:manifest`、`check:docs-reference` 和 4 个 SSR 应用的
   production-route 测试在本机全部假失败，而 Linux CI（corepack 装 pnpm）
   完全看不见。修复：只有 `.cjs/.mjs/.js` 才复用 execpath，其余一律走 shell；
   新增 `scripts/lib/run-pnpm.test.mjs`（`pnpm test:scripts`，已进 CI 与
   `release:verify`），并把 4 个 SSR 测试改为共用该 helper。
3. **`createDataSource` 每次 load 重复发布 rows**：`applyResult` 发布服务端
   快照后，`reapplyPendingOptimistic()` 无条件再 `setState` 一次同样的 rows。
   非 outbox 路径下该 record 根本不在 `mutationRecords` 里，所以这次发布
   永远是纯重复：四适配器多一次渲染，React 的引用相等 bail-out 失效。
   修复：无 pending 乐观层时直接返回；新增 emission hygiene 回归。
4. **`plugin-admin` 客户端删除静默失效**：`confirmDelete` 用
   `clientRows.indexOf(current)` 定位待删行，但 resource 发布的是
   `clientRows` 的**深拷贝**，`indexOf` 恒为 -1，`if (index >= 0)` 永远跳过
   splice。update 路径早已按 row key 匹配，所以只有 delete 坏。修复：改为
   按 key 定位。core + react + vue 三处测试同时由红转绿。

### 测试与文档卫生

- `desktop-os` 的 planner 端到端用例期望**过期**：它假设模型填的 args 会
  原样透传，而 MCP 参数校验（未声明参数一律拒绝并回退到 fuzzy planner）是
  有意行为。改为给命令声明 `q: number` 再断言透传，并补一条“未声明参数 →
  回退且不带 args”的回归。顺带确认 `fuzzyPlanner` 的严格子序列匹配**不是**
  缺陷：Assistant 的引导文案与示例本就是短短语（“open settings”），
  不需要为整句自然语言放宽匹配。
- cascader 的 10k 节点“默认关闭虚拟化”压力用例在满载并行下会撞 30s
  vitest 超时（单独跑 2.9s）：三端该用例超时提到 120s，断言不变。
- `docs/ui-audit/design-intelligence.md` 的 12 项 [MECHANICAL] 已全部落地
  （见上一节），复审时不要再把它们当缺口报。

### size 预算待维护者裁决（2026-09-28 实测）

`pnpm size` 当前是**红**的，且在本次提交之前就已红（HEAD~1 实测同样超标）。
grid/table 那一轮把发布面推过预算，本轮实测量化如下（gzip，预算 → 实测）：

| 包                                 | 预算 | 实测                         | 超出         |
| ---------------------------------- | ---- | ---------------------------- | ------------ |
| `@iris-ui-kit/core`                | 55   | 75.6                         | +26.4        |
| `@iris-ui-kit/icons`               | 7    | 10.2                         | +4.1         |
| `@iris-ui-kit/react`               | 160  | 167.6（脚本报 161 的旧预算） | +7.6 ~ +15.7 |
| `@iris-ui-kit/vue`                 | 110  | 125.1                        | +15.1        |
| `@iris-ui-kit/solid`               | 120  | 128.2                        | +8.2         |
| `svelte-published`（387 文件合计） | 274  | 302.8                        | +28.8        |

顺带修好了 size 门里同类的第二个 launcher 缺陷：`check-size.mjs` 把
`node_modules/.bin/esbuild`（pnpm 的 `/bin/sh` shim，Node spawn 不了）当作唯一
候选，于是 per-export 探针全部返回 `unmeasurable`，被 enforce 的
`icons: import { chevronDown }` 探针以“体积超标”的形式报错。现在改为按
“平台包 → pnpm store → shim”顺序逐个**验证可执行**（`scripts/lib/esbuild-binary.mjs`

- `pnpm test:scripts` 覆盖）。探针恢复测量后暴露了一个此前不可见的事实：

| 探针                                      | 实测                   | 预算 |
| ----------------------------------------- | ---------------------- | ---- |
| `icons: import { chevronDown }`（单图标） | **0.1KB**（全集的 4%） | 1KB  |
| `react: import { IrisButton }`            | 28.2KB（17%）          | 30KB |
| `vue: import { IrisButton }`              | **116.0KB（93%）**     | 80KB |

即 Vue barrel 实际上不可 tree-shake：只 import 一个按钮就会拖进整个包的 93%。
这条探针目前是 advisory（不阻断），但它是**已量化的真实成本**，应作为后续
“Vue 子路径导出/按需入口”工作的输入。

没有单方面抬高预算：六项同时超标属于**一个**决策（发布面要不要瘦身），
逐包抬预算只会把决策藏起来。可选路径：(a) 把 grid/table 新能力从主 barrel
解耦成子路径导出，core 只导出控制器；(b) 明确接受当前体积并一次性重设预算，
在 `iris.yaml` 写清测量值与理由；(c) 先做 tree-shake 探针（当前
`icons: import { chevronDown }` 探针在本机报 _unmeasurable_，需要先确认
esbuild 可用）。

### pbatch 实施批 1：跨框架能力补齐（2026-09-28）

批次定义 `ai-dev/pbatch/tasks/fix-parity-batch1.yaml`，4 个任务串行执行，每个
任务自带 artifact 级门禁（`node cli.mjs check`），批末再跑一次 repo 级门禁。
4/4 完成：

| 任务                                  | 改动                                          | 复核                        |
| ------------------------------------- | --------------------------------------------- | --------------------------- |
| React `IrisRadio` 可独立使用          | 去掉了“无 group 就抛错”，补受控/非受控 + ARIA | react 3132/3132             |
| Vue `IrisDragger` 非受控可拖动        | `modelValue` 默认改为 `undefined` 以区分受控  | vue 1820/1820               |
| Solid `IrisList` 触发 item 级回调     | 新增 `onSelect(item)`，点击与键盘共用一条路径 | solid 1211/1211 + SSR 50/50 |
| Solid/Svelte `IrisTour` 指示器走 i18n | 改用 `tour.step`，不再硬编码 `1 / n`          | solid/svelte 全绿           |

复核时改掉一处 agent 的偏差：React `IrisRadio` 给原生 `<input type="radio">`
加了显式 `role="radio"`，而另外三端都依赖原生隐式 role——那是新引入的分叉，
已删除并把测试改成断言“不出现冗余 role”。

批末 repo 门禁第一次失败也是真信号：`node cli.mjs check` 的 filesize 门因为
上一轮的 `packages/*/src/grid/*`（4 份 index.ts + 4 份 index.test.ts，最大
2298 行）而红。这些文件已按 iris.yaml 的既有机制逐个列入豁免（附理由），
并在本文记为待拆分项——没有抬高 500 行上限，也没有让它们悄悄进 baseline。

**新发现的脆弱测试**：整仓并行满载时，`react` 的 `proxy-config` /
`multi-sort` 两个 remoteSort 用例会偶发失败（loader spy 期望 3 次、实测 5 次），
单独跑与整仓轻载时都通过。属于时序敏感测试，不是本轮改动引入的回归；后续应
改成 fake timers 或显式 await settle。
