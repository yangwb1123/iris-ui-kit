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

## 2026-08-22 Grid Core Phase 2–3（当前工作树）

- 四框架新增 `@iris-ui-kit/{react,vue,solid,svelte}/grid` bridge；Vue/Solid/Svelte
  Table 的 selection/expansion 已委托同一实例级 Grid Core，React 已有 rows/columns/
  sorting/filtering/pagination/virtual bridge 保持不变，并新增 range/clipboard bridge；React Table 不再
  直接创建 cell-range controller，也不再维护普通 range copy/bounded paste 的重复序列化与写回循环。
  可见行投影按 row key 协调回原始 rows，系统 clipboard I/O 与 overflow row factory 仍属 adapter。
  Vue/Solid/Svelte 同步新增 range bridge，Table 不再直接创建/订阅 cell-range controller，keyboard/copy DOM wiring
  保持 adapter-owned。React 全量 3,038/3,038、Vue 全量 1,602/1,602、Solid 全量 1,031/1,031 + hydration
  38/38、Svelte 全量 1,005/1,005 + hydration 35/35 通过。
- `plugin-pro-table/src/core` 新增 export/persistence/history/audit/formula/views/query
  七个可选 B-layer GridFeature；`core/grid` 新增标准 editing/validation feature，复用
  cell-edit/edit-rules 并通过 rows 事务写回；新增 range/clipboard feature，复用 cell-range/
  table-clipboard 并以单次 rows 事务应用 TSV。methods/events/dependencies/cleanup 按能力维护，
  不含框架或 DOM 依赖。插件专项 15/15、插件全量 87/87；core 全量 1,642/1,642，
  typecheck/lint/build 通过。
- editing feature 续批已补齐四框架 `useGridEditing` bridge；React Table 的 cell mode 已委托
  Grid Core，row mode 保留 adapter-owned 多 session。`commitOptions` 继续携带 legacy transaction
  metadata，`GridEditingValidation.commit` 区分输入校验与 commit 校验；bridge smoke 5/5，core
  全量 1,642/1,642，React 全量 3,040/3,040，四适配器与 pro-table typecheck 通过。
- cell-mode 接入续批已完成：Vue、Solid、Svelte Table 现在也通过 `useGridEditing + useGridRows` 委托
  Grid Core；编辑器 DOM 与 row-mode 多 session 仍由适配器负责。Vue 1,603/1,603、Solid 1,032/1,032
  （hydration 38/38）、Svelte 1,006/1,006（hydration 35/35）全量通过，三端 typecheck/lint/build 通过。
  Core 对纯内置 editRules 保留同步失败反馈，自定义 validator 继续支持异步校验。
- 证据：`docs/grid-core-refactor.md`；四框架桥接 smoke + Table/Contract tests；
  `pnpm check:pack-install` 全 27 包通过；core 42/42 grid tests；size budgets
  已按实测增量说明调整。

## 2026-08-24 Grid Core sorting continuation（当前工作树）

- Vue、Solid、Svelte Table 的单列/多列排序状态已切到同一实例级 `useGridSorting`；Core
  统一负责三态循环、清空、受控静默同步和 change callback。列 comparator、树排序与
  remoteSort query wiring 仍由适配器保留。
- 排序/multiSort/named views/tree/remoteSort 定向回归分别为 Vue 110/110、Solid 101/101、
  Svelte 88/88；全量回归为 Vue 1,603/1,603、Solid 1,032/1,032 + hydration 38/38、
  Svelte 1,006/1,006 + hydration 35/35。
- 三端 typecheck/lint/build 均通过；Vue lint 仅报告既有的 Table 复杂度 warning（0 error）。
  Solid 旧的 adapter-owned `useTableSort` 已删除。`pnpm arch-check:ratchet` 仍命中 React/Vue/Svelte
  主文件相对既有 baseline 的超限，本批未调整 baseline；证据与边界记录见 `docs/grid-core-refactor.md`。

## 2026-08-24 Grid Core filtering continuation（当前工作树）

- Vue、Solid、Svelte Table 的 text `filters` 与 checkbox `filterValues` 已切到同一实例级
  `useGridFiltering`；Core 负责状态、受控静默同步、set/clear methods 和 change callback。
  formConfig draft/applied、列 `filterMethod`、panel open/draft 与 remoteFilter query wiring 仍由适配器负责。
- 过滤/表单/proxy/公式/树定向回归为 Vue 104/104、Solid 50/50、Svelte 46/46；全量回归为
  Vue 1,603/1,603、Solid 1,032/1,032 + hydration 38/38、Svelte 1,006/1,006 + hydration 35/35。
- 三端 typecheck/lint/build 均通过；Vue lint 仅有既有 Table 复杂度 warning（0 error）。
  `arch-check:ratchet` 仍命中 React/Vue/Svelte 主文件相对既有 baseline 的超限，本批未调整 baseline。

## 2026-08-25 Grid Core rows continuation（当前工作树）

- `createGridRowsFeature` 新增 `getData/loadData/insert/remove/removeMany/update` model API，以及
  `insertRow/removeRow/removeRows/updateRow` capability aliases；字段键与 `getRowKey` 计算键共用同一
  rows transaction，批量删除只发一次 `rows:change`。提交输入和事务快照隔离，避免调用方在提交后修改数组污染
  Core 状态；`getRows/setRows/transactRows/syncRows` 继续兼容。
- React/Vue/Solid/Svelte `IrisTable` 已将暴露的 load/remove（以及 React 的 insert/update）row-handle 操作委托
  rows feature；adapter 仍保留 selection pruning、audit/history/undo、proxy 与 `onDataChange` 等副作用。
- Vue/Solid/Svelte 的 row-drag 本地写回也经由同一 rows transaction；拖拽命中/排序/取消仍是 adapter-owned，
  React 继续保持父组件拥有数据的 legacy row-drag 语义。
- 三端 row-mode 的多编辑器会话仍由适配器控制，但 proxy 页提交已统一经 rows `update` 写回；本地受控表保持
  不主动改写 `data`。
- React row-mode 的单列写回也已切换为 rows `update`，保留 adapter-owned session、dirty/audit/undo、
  `onCellEdit` 与 autosave 语义；React 全量 266/266 files、3,042/3,042 tests 通过。
- 四端 row-mode/proxy 的单列 patch 均按同一 `dataIndex ?? key` 字段解析：React、Solid、Svelte 的 rows
  `update` 写回已补齐该映射，避免展示 key 与源字段不同时污染错误字段；React row-mode 16/16、Solid 7/7、
  Svelte 4/4、Vue 10/10 定向回归通过，Solid typecheck 与 Svelte svelte-check 也通过。
- `plugin-pro-table` history feature 在未传旧式 `getRows/setRows` 时直接消费 rows capability，undo/redo 经
  `setRows({ reason: 'history' })` 回放；legacy 注入仍兼容。audit 读取和四端 `useGridRows` 的
  `cloneDefaultRows` 选项也统一收口。
- `@iris-ui-kit/core/grid` 的 rows feature 现在原生支持 `getChildren/setChildren`，递归不可变 path update/remove
  在 Core 完成；`plugin-pro-table` client 模式（flat/tree）的 inline edit、create、delete/bulk-delete 已接入 rows
  `update/transact/removeMany`，bridge 只负责传递 tree accessor 与稳定投影镜像。`getChildren` 可自动推断可枚举
  children 属性，复杂访问器可提供 `setChildren`；旧 `allRows` 只保留稳定引用镜像，server 路径仍按原契约运行。插件主（含
  React/Vue）70/70、Solid 13/13、Svelte 13/13，plugin-pro-table typecheck 通过。
- 回归：core 111/111 files、1,653/1,653 tests；React 266/266 files、3,042/3,042 tests；plugin-pro-table
  main/solid/svelte 分别 70/70、13/13、13/13。四框架 typecheck/build 通过；`arch-check:ratchet` 仍命中
  React/Vue/Svelte 主文件及既有 Vue Table 测试基线超限，未调整 baseline。

## 2026-08-25 Grid Core tree rows bridge continuation（当前工作树）

- 四套 `useGridRows` bridge 统一暴露可选 `getChildren/setChildren`，并将静态 `getSubRows` 接入各框架
  `IrisTable` 的 Core rows feature。未传 accessor 时保持 flat 快路径；lazyLoad 的异步缓存仍由适配器拥有，
  不把不稳定 cache map 写入 Core。
- 四端 `removeRows` 现在可通过同一 rows transaction 删除静态树子节点；React 同步移除了 root-only 的存在预检，
  避免嵌套 key 被误判为 missing。自动 children 属性替换保持不可变，源数据引用不被改写；自定义 children 访问器
  继续使用 `setChildren`。
- 定向回归：React grid/tree 23/23、Vue grid/remove 7/7、Solid grid/remove 7/7、Svelte grid/remove 7/7；四端
  typecheck、lint、build 通过（React/Vue 仅既有复杂度 warning）。完整包回归为 React 266/266 files、3,045/3,045
  tests，Vue 170/170、1,606/1,606，Solid 146/146、1,034/1,034 + hydration 38/38，Svelte 150/150、1,008/1,008，
  hydration 35/35。`arch-check:ratchet` 仍命中既有 React/Vue/Svelte 主文件 baseline 超限，未调整。

## 2026-08-25 Grid Core rows lookup continuation（当前工作树）

- Core rows 新增 `find(key)` model API 与 `findRow` capability alias：flat rows 按 resolved key 查找，tree rows
  复用 `getChildren` 做 cycle-safe 前序遍历，并保持重复节点/循环引用防护。
- `plugin-pro-table` 的 client inline edit、delete、bulk-delete 优先消费 rows model 的查找结果；`allRowsForEdit`
  继续作为 legacy 稳定镜像与 server fallback，不再作为 client tree 存在性判断的唯一来源。
- Core rows 定向回归 9/9，plugin-pro-table core grid/index 回归 40/40，Core 与 plugin-pro-table typecheck 通过。

## 2026-08-25 Grid Core tree collection continuation（当前工作树）

- `@iris-ui-kit/core/grid` 新增 `collectTreeRows`，与 `findTreeRow`、tree mutation 共用 cycle/duplicate guard，
  以 pre-order 返回所有可达节点。
- `plugin-pro-table` 的 `allRowsForEdit` 重建与 `expandAll` 已改用该 Core 纯函数，保留稳定 key 顺序；lazy children
  cache 仍由适配器拥有。
- Core 全量 111/111 files、1659 tests；plugin-pro-table 主/solid/svelte 72/13/13；typecheck、lint、build 与
  manifest check 通过。

## 2026-08-25 Grid Core tree selection continuation（当前工作树）

- Core 新增 `flattenTreeSelectionNodes`，将嵌套 rows 以全局 pre-order index 转为级联选择所需的 parentage；纯函数内置
  cycle/duplicate guard，并保留可选 disabled 映射。
- Vue `IrisTable` 的 `treeSelectionCascade` 以及 React/Vue/Solid/Svelte `IrisTree` 的 checkable projection 现在消费该
  Core helper；适配器仍拥有受控 selection rebasing、compact seed、lazy cache 与 action-local model，旧 key 语义不变。
- 回归：Core 111/111 files、1660/1660 tests；Vue 全量 170/170 files、1606/1606 tests；React/Solid/Svelte typecheck
  通过。Tree 定向回归 React/Vue/Solid/Svelte 为 28/25/22/12；Core/Vue 定向 tree-selection 回归 10/10、22/22；
  manifest 与格式检查保持通过；`arch-check:ratchet` 仍命中既有 Core/plugin/Table baseline 超限，未调整 baseline。

## 2026-08-25 Grid Core row lookup continuation（当前工作树）

- React/Vue/Solid 的 row-mode 当前行解析现在优先使用 Core rows model 的 `find`，React 的
  `setCurrentRow` 与 `toggleRowExpand` 也可寻址静态树中的折叠/嵌套行；Svelte row-mode controller
  同样接入 `findRow`，懒加载/代理子节点仍保留 adapter-owned 可见行回退。
- 可见行索引仍用于 `rowExpandable`、事件与旧回调参数，只有 Core 无法解析的 lazy/server 行才回退到
  adapter snapshot，因此没有改变既有 index 或异步缓存语义。
- React handle/tree/row-edit 定向回归 25/13/11，Vue inline/tree/remove 31，Solid row-edit/tree/remove
  20，Svelte row-edit/tree/remove 19；React/Vue/Solid typecheck 与 Svelte svelte-check 均通过，定向文件
  Prettier 检查通过。

## 2026-08-26 Grid Core tree patch reconciliation continuation（当前工作树）

- Core 新增 `reconcileTreeRows` 纯函数：将 clipboard/range 等可见投影产生的 keyed row replacement
  不可变地写回根树，沿变更节点重建 ancestor path，未触及的 row 保持引用；与 `findTreeRow`/
  `collectTreeRows`/tree mutation 共用 cycle/duplicate guard，并支持非属性 children 的 `setChildren`。
- React Table 的 clipboard bounded paste、single-cell overflow、context clear/format、快捷键清空、
  range fill/move/copy/clear、FNR replace 与 batch edit 统一通过该 reconciliation path；静态树子行不再
  被 root-only `map` 写回丢失，lazy/proxy 行仍保留 adapter-owned fallback。compare merge 继续保持其
  root snapshot 契约。
- 回归：Core `grid-rows`/range-clipboard 定向 20/20，React clipboard/range/drag/FNR/permission 定向
  95/95；Core 全量 111/111 files、1,664/1,664 tests，React 全量 266/266 files、3,047/3,047 tests；
  React typecheck/build、ESLint（仅既有复杂度 warning）、Prettier、manifest 与 `git diff --check` 通过。

## 2026-08-26 Grid Core nested editing/data-index continuation（当前工作树）

- `createGridEditingFeature` 现在可通过 rows feature 的 `find`/`update` 寻址静态树子行：根行继续沿用
  legacy `setRows`，嵌套行走 key-addressed path transaction，避免编辑器把 `rows[-1]` 写回；提交仍透传
  `reason: 'cell-edit'` 与 adapter metadata，未改变异步校验和 no-op 语义。嵌套提交显式保留 path 来源标记，
  `getRowIndex` 仅解析适配器当前可见索引用于事件回调，不会把树行误写回根数组。
- `plugin-pro-table` client tree bridge 在每次 Core rows transaction 后同时镜像 `treeRoots`、`allRows` 和
  `allRowsForEdit`；折叠/展开或同步 reload 不会因旧树源而复活已编辑/删除的子行。
- React Table 的 cell editing、clipboard/range、FNR、batch 与 drag-copy 等字段写回统一使用
  `dataIndex ?? key`，展示 key 与源字段不同时不再污染错误属性；静态树路径继续使用
  `reconcileTreeRows`，lazy/proxy 仍保留适配器回退。
- 回归：Core 全量 112/112 files、1,669/1,669 tests；React 全量 266/266 files、3,049/3,049 tests；
  React targeted grid/clipboard/editing 通过，plugin-pro-table 主入口 74/74、Solid 13/13、Svelte 13/13；
  Core、四框架适配器与 plugin-pro-table 完整 `typecheck`/build 通过（build 仅保留既有未使用外部导入
  warning），plugin lint、manifest 与 `git diff --check` 通过。

## 2026-08-26 Grid Core tree row-drag continuation（当前工作树）

- Core 新增 `reorderTreeRows` 纯函数：从扁平可见拖拽投影解析两个 key，在同一父级 sibling list 内执行与 flat
  适配器一致的 remove→insert，并只重建变更节点的 ancestor path；源树、子数组与未触及 row 保持引用。跨父级拖放、
  缺失 key、重复/循环节点或无法写回 computed children 时 fail-closed，不把子行写入根数组。
- React/Vue/Solid/Svelte Table 的静态 `getSubRows` row-drag 均改为提交 Core 生成的 canonical root tree；lazy children
  仍保持 adapter-owned，不能表达稳定 `setChildren` 路径时拒绝写回。flat 表格保留原有可见列表排序与 callback
  语义，React 仍由父组件拥有最终数据，只是不会再把静态树的扁平投影冒充根数组。
- 回归：Core 全量 112/112 files、1,680/1,680 tests；React 268/268、3,051/3,051，Vue 170/170、1,609/1,609，
  Solid 146/146、1,035/1,035、hydration 38/38，Svelte 150/150、1,009/1,009 + hydration 35/35；四端新增
  静态树 drag 回归通过，plugin-pro-table client tree mutation 75/75；四端 typecheck/build 与
  `git diff --check` 通过（既有 warning 保持，不新增 error）。删除树父节点时 Core 现在同时报告整棵可达
  子树的 key，四端与插件可据此一次性清理已消失的 descendant selection/session 状态；replacement 缺少
  children 字段时也不会在 path reconciliation 中丢弃折叠子树。

## 2026-08-26 Grid Core clipboard overflow continuation（当前工作树）

- Core clipboard 新增可选 `overflowRows` factory：单格 paste 仅在有效 body 行耗尽后收集溢出行的 split cells，
  由宿主 factory 决定新行字段与锁定/只读策略，Core 统一负责 `rowKeyField` 自动 id、一次 rows transaction
  及 `changedRows/changedCells` 统计；未注入 factory 时仍保持 batch-O 丢弃语义，多格矩形不触发。
- React `useGridClipboard`/`IrisTable` 已删除本地溢出建行分支，改为注入同一 factory；audit/history/
  `onDataChange` metadata 继续沿用 clipboard commitOptions。Core overflow/no-factory/multi-cell 定向 10/10，
  React clipboard/clip-FNR/grid bridge 定向 33/33，Core `typecheck`/build 与 React typecheck 通过。
- Vue scrollToTop 适配器批次新增 9 项 focused 回归（阈值、虚拟视口、异步 re-arm、清理、printable、SSR），
  Vue 全量 172/172 files、1,618/1,618 tests 通过；Core 全量 112/112 files、1,682/1,682 tests，
  Core typecheck/build、React typecheck 与 Grid clipboard 定向回归均通过，新增 overflow context 已从
  `@iris-ui-kit/core/grid` 公共 barrel 导出。
- React 全量当前重跑为 268 files、3,015/3,051 passed；剩余 36 项均为既有 `IrisTree`/Tree contract 的
  `Maximum update depth exceeded`，本批未触碰该路径，Grid/Table 定向项保持通过。

## 2026-08-26 Grid Core clipboard bridge continuation（当前工作树）

- Vue、Solid、Svelte 新增 `useGridClipboard` 薄桥，三端 Table 的范围复制统一委托同一
  `createGridClipboardFeature`；Core 负责投影序列化，适配器继续负责 keyboard/button wiring 与系统
  clipboard I/O。公式列的 computed shadow rows、TSV/CSV/HTML、formatter/mask 与无 range fail-closed
  语义保持不变；bridge 同时暴露 `paste`，为后续三端粘贴接入保留一致 API。
- bridge + copy 定向回归为 Vue 4/4、Solid 5/5、Svelte 4/4；Vue/Solid/Svelte 公式与主表回归为
  94/94、73/73、71/71；Core 与四框架 typecheck、格式检查通过。

## 2026-08-26 Grid Core clipboard paste continuation（当前工作树）

- Vue、Solid、Svelte Table 的 `clipConfig.paste` 已接入各自 `useGridClipboard` bridge。异步系统 clipboard
  read 与快捷键仍归适配器，Core 统一负责 raw TSV 解析、formula/dataIndex policy、排序/过滤/静态树投影
  reconciliation 与一次 rows transaction；成功提交通过 `onDataChange` 回传。
- 三端 paste 定向回归各 2/2；Vue/Solid/Svelte paste + copy/formula/主表回归为 99/99、75/75、73/73，
  四端 typecheck、lint、Prettier、build 与 `git diff --check` 通过。Vue lint 仅保留既有 Table complexity
  warning；未调整 arch ratchet baseline。

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
