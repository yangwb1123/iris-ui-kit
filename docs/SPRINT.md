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

## 2026-08-26 Grid cross-table formula alignment continuation（当前工作树）

- `formulaTables` 的 `table!field` 语义已对齐 Vue、Solid、Svelte：读取命名表首行，未知表/空表/未知字段 fail-closed；
  公式计算贯通渲染、排序、过滤、摘要、范围复制与 CSV，替换外部表对象才触发重算，多个表实例各自隔离。
  新增 `IrisTableFormulaTables` 类型、Vue/Svelte SSR 回归，并重新生成 manifest/llms。
- 交叉公式定向回归 Vue 7/7、Solid 8/8、Svelte 7/7（均含 SSR），React 既有契约 12/12；完整回归 Vue
  175 files/1,628 tests、Solid 151/1,054 + SSR 41、Svelte 155/1,029 + SSR 38。三端 typecheck/lint/build、
  React typecheck 与 `git diff --check` 通过；Vue 仅保留既有 Table complexity warning，未调整 arch ratchet baseline。

## 2026-08-26 Grid Vue undo/redo bridge continuation（当前工作树）

- Vue `IrisTable` 接入 Core `createUndoStack`：编辑、粘贴、拖拽、`loadData`/`removeRows` 共用 Grid Rows 事务记录，
  工具栏 controls 与 Ctrl/Cmd+Z/Y（含 Shift+Z）按表根范围生效；replay 经过正常 `onDataChange`/audit 通道，
  selection 会清理已从快照消失的 key，外部未修改历史时自动重建 baseline。
- 新增 pending clipboard read 的卸载/关闭保护，新增 Vue undo 单测 10/10、SSR 1/1、hydration 1/1；Vue typecheck/lint 通过（仅既有
  Table complexity warning），manifest/llms 与现有 Vue 全量 178 files/1,640 tests 保持同步。

## 2026-08-26 Grid Solid undo/redo bridge continuation（当前工作树）

- Solid `IrisTable` 接入同一 Core `createUndoStack`：Grid Rows 事务统一记录 cell/row edit、粘贴、拖拽、`loadData`/
  `removeRows`，工具栏与 Ctrl/Cmd+Z/Y（含 Shift+Z）按表根作用；回放通过受保护的 rows commit，不会把 undo/redo
  再次入栈，并在快照缺少行时清理 selection。外部数据只在历史未触碰时重建 baseline，proxy 与本地 rows 均保持当前
  live snapshot。
- 新增 Solid shortcut/undo/toolbar 薄桥；row mode 的本地写回在编辑会话结束后刷新，避免 Solid keyed DOM 替换破坏剩余
  editor；编辑器/文本控件和表外快捷键 fail-closed。新增 undo 定向回归 11/11、row-edit 回归 7/7、undo SSR 1/1，
  现有 SSR/hydration 安全套件合计 44/44；Solid 默认全量 152 files/1,065 tests 通过，typecheck/lint/build、
  manifest 与格式检查通过。

## 2026-08-26 Grid Svelte undo/redo bridge continuation（当前工作树）

- Svelte `IrisTable` 接入同一 Core `createUndoStack`：Grid Rows 事务统一记录 cell/row edit、粘贴、拖拽、`loadData`/
  `removeRows`，工具栏与 Ctrl/Cmd+Z/Y（含 Shift+Z）按表根作用；回放使用 guarded rows commit 并通过
  `onDataChange` 写回，selection 会清理快照中已消失的 key。外部 source 只在历史 pristine 时重建 baseline，
  proxy 与本地 rows 保持 live snapshot；row mode 的本地写回在编辑会话结束后刷新，并保持已提交值可见。
- 新增 Svelte undo 薄桥与工具栏/SSR 回归；undo 定向 10/10、现有 row-edit/paste/remove 回归 11/11，SSR/hydration
  套件 41/41；Svelte 默认全量 156 files/1,039 tests、typecheck/lint/build、manifest 与格式检查通过。

## 2026-08-26 Grid lazy tree rows boundary continuation（当前工作树）

- Core `grid-tree-rows` 新增 `setTreeChildren`，rows model/capability 同时提供可观察的 `setChildren` 与静默的
  `syncChildren`；两条路径都复制 children 输入、按稳定 key 做 cycle-safe 查找，并只重建变更的 ancestor path。
  普通 `children` 属性可自动推断，计算型 accessor 无 setter 时 fail-closed；无变化不产生事务。
- React、Vue、Solid 的既有 `lazyLoad` 回填统一写入 Core rows 的不可变 `children` 槽，adapter 只保留 loading
  set 与 epoch；懒加载成功不记 `onDataChange`、undo 或 audit，但随后 Core `find/update/remove` 可直接访问已加载子行。
  `getSubRows` fallback、空结果、重试和刷新后的陈旧回调丢弃语义保持不变。Svelte 当前没有 `lazyLoad` 公共 prop，
  Svelte 后续补齐 `lazyLoad` 公共 prop，仍保留 adapter-owned loading/epoch。
- 定向回归：Core rows 20/20；React lazy/row-edit 25/25；Vue lazy tree 11/11；Solid lazy tree 10/10；React/Vue/
  Solid typecheck 通过。`arch-check:ratchet` 继续保留既有 Table baseline 超限，未调整基线。

## 2026-08-26 Grid lazy tree projection continuation（当前工作树）

- 已加载的 lazy children 现在同时进入 React clipboard/range/FNR 等 keyed reconciliation、React/Vue/Solid
  row-drag 和 React `expandAll`；这些路径统一复用 `readRowChildren`，并通过 Core rows 的 `setChildren` 保持
  canonical root tree 与 immutable ancestor path。跨父级、隐藏/缺失 key、循环/重复节点和 computed children
  无 setter 继续 fail-closed；flat 表格与各端默认路径不变。
- 定向回归：Core rows 20/20；React lazy/row-edit/static-drag 41/41，lazy clipboard 6/6；Vue lazy/static-tree
  23/23；Solid lazy/static-tree 10/10。React/Vue/Solid typecheck、build、lint 通过。

## 2026-08-26 Grid Core rows reorder continuation（当前工作树）

- Core `GridRowsModel` 新增 `reorder`，并以 `reorderRows` capability alias 暴露 flat/tree 同级移动、
  `before/after/auto` 位置语义与 rows transaction metadata；flat 路径按 resolved key 不可变重排，tree 路径复用
  `reorderTreeRows`，跨父级、缺失/重复/循环节点及 computed children 无 setter 继续 fail-closed。
- Vue、Solid、Svelte 的 row-drag 优先通过 rows model 提交，排序或 index-keyed 可见投影无法与 source row 身份对齐时
  回退既有 projection resolver；React 仍维持父组件拥有最终数据的 legacy `onReorder` 语义。
- 定向回归：Core rows 22/22、Vue row-drag 11/11、Solid row-drag 22/22、Svelte row-drag 5/5；Core/Vue/Solid/Svelte
  typecheck、lint、manifest 与 `git diff --check` 通过。

## 2026-08-26 Grid Core reorder guard continuation（当前工作树）

- `reorderTreeRows` 不再在找到拖拽目标后提前结束遍历；目标之后若出现重复 row/key 或循环引用，整个操作保持原树并
  返回 `blocked`，避免 malformed tree 被部分写回。新增 Core 回归覆盖 duplicate/cycle 位于有效目标之后的路径。
- Core `grid-rows` 定向回归 20/20、Prettier 与 `git diff --check` 通过；适配器行为未改变。

## 2026-08-27 Grid Core reorder primitive continuation（当前工作树）

- 平面 rows 的 remove→insert 位置算法下沉为 `table-rows` 纯函数 `reorderRowsInList`；`GridRowsModel` 与
  `reorderTreeRows` 共用同一份 `auto/before/after` 语义，避免 Core 内部出现两套拖拽插入规则。
- 新增纯函数回归覆盖方向、位置、computed key 原始索引与 identity no-op；Core 全量 114/114 files、1,696/1,696
  tests，typecheck/lint/build、Prettier 与 `git diff --check` 通过（lint 仅保留既有复杂度 warning）。

## 2026-08-27 Grid Core columnFade continuation（当前工作树）

- Vue、Solid、Svelte 的 `IrisTable` 均新增 adapter-local `columnFade`，复用既有 Grid Core `columnVisibility` snapshot；默认关闭不注入 fade stylesheet 或 `matchMedia` 监听，隐藏/显示使用 token-backed 两阶段轨道与 opacity 过渡，并覆盖 reduced-motion、焦点恢复、分组列、虚拟列、SSR/hydration 与卸载清理。
- Vue focused 24/24、全量 183 files/1,676 tests；Solid focused 15/15、client 154 files/1,086 tests、SSR 46 + dedicated hydration 1；Svelte focused 19/19、client 159 files/1,067 tests、SSR 45 + dedicated hydration 1。三端 typecheck/lint/build、manifest 与 `git diff --check` 通过；未调整 `scripts/arch-baseline.json`，既有 oversized Table ratchet 限制仍保留。

## 2026-08-28 Grid Core column-order projection continuation（当前工作树）

- 列顺序投影纯函数下沉至 Core `applyColumnOrder`，React/Vue/Solid/Svelte 移除重复的 adapter-local 实现；未知/重复 key、遗漏列的稳定顺序及空 order 的 identity 快路径保持不变。
- Core columns **10/10**、grid-columns **5/5**，四端列状态/列顺序定向回归 **39/39**；四端 typecheck、Core build 与 `git diff --check` 通过。

## 2026-08-28 Grid Core column-visibility projection continuation（当前工作树）

- 列可见性投影下沉至 Core `applyColumnVisibility`，React/Vue/Solid/Svelte 的顶层 visibility 过滤统一复用该纯函数；空/未提供 map 保持 identity，分组列仍只在顶层过滤，fade overlay 与 `visibleMethod` 语义不变。
- Core columns **12/12**、grid-columns **5/5**；列状态/顺序及三端 fade 定向回归 **105/105**，四端 typecheck/build/lint 与 `git diff --check` 通过。

## 2026-08-28 Grid Core pinned-map continuation（当前工作树）

- `pinnedColumns` map 通道继续对齐 Vue/Solid/Svelte，显式 `null` 覆盖静态 pin，缺失 key 保留静态声明；受控拖拽提案经 Grid Columns model 回调但不乐观改写，响应式/虚拟列与 SSR 保持 pin 语义。
- Vue pin 回归 **8/8**、Solid/Svelte pin + SSR 回归各 **5/5**；三端 typecheck/lint/build 与 `git diff --check` 通过。

## 2026-08-28 Grid Core auto-detect projection（当前工作树）

- 新增并导出 Core `applyDetectedColumnDefaults`，四端统一递归填充缺失 alignment；React 通过选项继续填充缺失 `sortType`，Vue/Solid/Svelte 保持原有仅 alignment 语义。
- Core column-type **13/13**，四端 auto-detect 回归 **21/21**；四端 typecheck 与格式检查通过。

## 2026-08-28 Grid Core responsive layout（当前工作树）

- 新增并导出 Core `computeResponsiveColumnLayout`，统一 leading tracks 预算、分组 pinned descendant 保护和 fitted natural width overflow 判断；四端删除重复 responsive wrapper 与自然宽度投影，保持 480px、floor、identity 和 fail-closed 语义。
- Core responsive **15/15**、四端 responsive 回归 **26/26**；四端 typecheck/build/lint 与 `git diff --check` 通过。

## 2026-08-28 Grid Core pinned offset projection（当前工作树）

- 新增并导出 Core `computePinnedColumnOffsets`，统一左右 sticky offset 累积与 leading track 偏移；四端只保留 framework-specific style 输出。
- Core offset 回归 **2/2**，React/Vue/Solid/Svelte pinned 回归 **44/44**；typecheck/build/lint 与 `git diff --check` 通过。

## 2026-08-28 Grid Core pinned-boundary prefix（当前工作树）

- `leftPinnedCount` 下沉至 Core 并支持 effective `pinOf` resolver；React/Vue/Solid/Svelte 删除重复 prefix loop，保留静态声明 fallback 与受控 map 语义。
- Core pinned-drag **4/4**、四端 boundary 回归 **27/27**；typecheck/build/lint、manifest 与 `git diff --check` 通过。

## 2026-08-28 Grid Core column-width projection（当前工作树）

- `resolveInitialWidth` / `resolveColumnWidth` / `resolveColumnWidths` / `resolveColumnTrack(s)` / `isValidColumnWidth` 下沉至 Core；React/Solid/Svelte 复用统一的 px 解析、数值校验和 CSS track 投影，Vue 保留既有 numeric grid-track 合同。
- Core column-width **4/4**，列宽/track 定向回归 React **42/42**、Vue **29/29**、Solid **20/20**、Svelte **22/22**；typecheck/build/lint 与 `git diff --check` 通过。

## 2026-08-28 Grid Core column virtualization（当前工作树）

- `computeVisibleColumnIndices` 下沉至 Core，统一横向 virtual window、overscan、pinned/transition 列 union 与非法宽度 fail-closed；四端仅保留尺寸测量和 DOM predicate。
- Core column-virtual **4/4**，四端 virtual/responsive 定向回归 React **130/130**、Vue **90/90**、Solid **83/83**、Svelte **78/78**；typecheck/build/lint 与 `git diff --check` 通过。

## 2026-08-28 Grid Core column track placement（当前工作树）

- `countLeadingGridTracks` / `columnGridTrack` 下沉至 Core，四端删除重复 leading utility count 与 1-based leaf track 公式，虚拟列/summary/footer/group header 对齐保持不变。
- Core grid-layout **2/2**，定向回归 React **110/110**、Vue **88/88**、Solid **81/81**、Svelte **76/76**；typecheck 与 `git diff --check` 通过。

## 2026-08-28 Grid Core pinned-boundary lookup（当前工作树）

- `firstRightPinnedIndex` / `pinnedBoundaryIndex` 下沉至 Core，四端删除 right-block 与 boundary leaf 的重复扫描；gapped pin、无右 pin、空 prefix 语义保持不变。
- Core pinned-drag **4/4**、四端 boundary 回归 **27/27**；typecheck/build/lint 与 `git diff --check` 通过。

## 2026-08-28 Grid Core grid-template projection（当前工作树）

- `resolveGridTemplateColumns` 下沉至 Core，统一 leading utility tracks、叶列 authored width、fade collapsed track 与 adapter-specific numeric track 覆盖；四端删除重复的 CSS grid track 拼接循环，Vue 保留既有 numeric grid-template 合同。
- Core grid-layout **5/5**、定向回归 React **70/70**、Vue **19/19**、Solid **21/21**、Svelte **23/23**；Core 全量 **118 files / 1,725 tests**，四端 typecheck/build/lint、manifest、Prettier 与 `git diff --check` 通过。

## 2026-08-28 Grid Core grouped-header utility tracks（当前工作树）

- `leadingGridTrack` 下沉至 Core，统一 rowDrag/sequence/detail/selection 的 1-based utility track 定位；disabled utility 保持 `null` fail-closed，四端删除 grouped-header 内联偏移公式。
- Core grid-layout **7/7**、grouped-header 定向回归 React **27/27**、Vue **26/26**、Solid **12/12**、Svelte **13/13**；四端 typecheck/build/lint、Prettier 与 `git diff --check` 通过。

## 2026-08-28 Grid Core body span projection（当前工作树）

- `resolveGridSpan` / `computeGridSpanPlan` 下沉至 Core，统一 row-major occupancy、covered-cell skip 与 null/undefined 单格默认语义；React/Vue/Solid 保留 render-pass/virtual-column 生命周期，Svelte 删除 adapter-local span plan。
- Core grid-span **4/4**、相关回归 React **38/38**、Vue **28/28**、Solid **3/3**、Svelte **40/40**；四端 typecheck 与 `git diff --check` 通过。

## 2026-08-28 Grid Core column resize projection（当前工作树）

- `clampColumnWidth`、`DEFAULT_COLUMN_MIN_WIDTH`、`COLUMN_RESIZE_STEP` 下沉至 Core，四端统一 resize round/clamp 与键盘步长；Vue 保留既有 fractional pointer-width 语义，非法声明宽度 fail-closed。
- Core column-width **5/5**；列宽回归 React **35/35**、Vue **88/88**、Solid **81/81**、Svelte **76/76**；四端 typecheck/build/lint、manifest、Prettier 与 `git diff --check` 通过。

## 2026-08-28 Grid Core table filtering projection（当前工作树）

- `filterTableRows` / `mergeFilterValues` 下沉至 Core，统一大小写不敏感 substring、`filterMethod`、checked-value 集合内 OR / 多 map AND、typed `filterRules` 与未知 key fail-open；空集合保持既有 text filter，no-op 保持 rows identity。
- React/Vue/Solid/Svelte 删除重复过滤循环与远程 filter map merge，公式列继续通过各适配器的 value bridge；Core 全量 **120 files / 1,736 tests**，过滤相关回归 React **134/134**、Vue **112/112**、Solid **98/98**、Svelte **77/77**；四端 typecheck/build/lint、manifest、定向 Prettier 与 `git diff --check` 通过。

## 2026-08-28 Grid Core table sorting projection（当前工作树）

- `createTableSortComparator`、`createTableMultiSortComparator`、`sortTableRows` 下沉排序投影，统一自定义 sorter、`sortType` coercion、方向链、未知 key 跳过与 no-op identity；公式/dataIndex 读取仍由适配器 value bridge 注入。
- Core table-sort **5/5**；排序/公式回归 React **49/49**、Vue **43/43**、Solid **62/62**、Svelte **59/59**；四端 typecheck 与定向测试通过。

## 2026-08-28 Grid Core table value projection（当前工作树）

- `resolveTableColumnValue` / `materializeTableFormulaValues` 下沉 formula 优先级、`dataIndex`/`key` 读取、cross-table snapshot 与不可变 shadow-row materialization；四端仅保留 value scope/type bridge。
- Core table-values **6/6**；formula/serializer 回归 React **46/46**、Vue **113/113**、Solid **91/91**、Svelte **89/89**；四端 typecheck 与定向测试通过。

## 2026-08-28 Grid Core editable-column predicate（当前工作树）

- `isTableColumnEditable` 下沉 `editable && !formula` 判定，公式列即使声明 `editable` 仍保持 display-only；四端以兼容别名保留既有 `isEditableColumn` 导入，所有编辑入口、row mode 与 DOM capability attr 共享 Core predicate。
- Core 全量 **122 files / 1,747 tests**；公式/序列化回归 React **40/40**、Vue **33/33**、Solid **79/79 + SSR 2/2**、Svelte **78/78 + SSR 3/3**；四端 typecheck/build/lint、manifest、定向 Prettier 与 `git diff --check` 通过。

## 2026-08-28 Grid Core column fade projection（当前工作树）

- `startColumnFade`、`advanceColumnFade`、`commitColumnFade`、`expandColumnFadeToLeaves`、`isColumnFadeCollapsed` 下沉可见性 fade 纯投影；四端保留 rAF/timer、reduced-motion、focus recovery 与 DOM 属性桥接。
- Core column-fade **7/7**；fade 回归 React **34/34**、Vue **24/24**、Solid **15/15**、Svelte **19/19**；四端 typecheck 与定向测试通过。

## 2026-08-28 Grid Core range and keyboard projection（当前工作树）

- 表格 range bridge 与 Shift+Arrow 边界移动统一复用 Core `CellRangeController` / `nextGridCell`；四端仅保留响应式订阅、modifier/DOM focus 与 clipboard wiring，反向 range、无 anchor fallback、边界 no-op 与 Escape 清除语义不变。
- Core `cell-range` **10/10**、`roving` **17/17**；定向回归 React **87/87**、Vue **81/81**、Solid **57/57**、Svelte **54/54**；四端 typecheck/lint、Prettier 与 `git diff --check` 通过。

## 2026-08-28 Grid Core flat row-drag reorder projection（当前工作树）

- 平面 row-drag 统一使用 Core `reorderRowsInList` / `reorderRowsInListAt`，删除四端 adapter-local `findIndex`/`splice`；React insertion-line 的 pre-removal index 合同由 `reorderRowsInListAt` 精确承接，tree 路径继续使用 `reorderTreeRows`。
- Core `resolveRowDragProjection`、`reorderRowsInList` / `reorderRowsInListAt` 统一可见索引、源行 identity 与 flat reorder；删除四端重复的可见 `findIndex`/`splice`，并保留树形投影的 source-tree 约束。
- Core `table-rows` **30/30**；adapter drag 回归 React **10/10**、Vue **11/11**、Solid **22/22**、Svelte **5/5**；四端 typecheck/lint/build、Prettier 与 `git diff --check` 通过。

## 2026-08-28 Grid Core flat column-drag reorder projection（当前工作树）

- 平面 column-drag 统一使用 Core `reorderColumnsInList` / `reorderColumnsInListAt`；React 仅保留 frozen-zone clamp 与 drag-out pin 约束，删除四端重复的列 `findIndex`/`splice`，controlled order proposal、grouped leaf 与 no-op 语义不变。
- Core `columns` **17/17**；adapter column-drag 回归 React **51/51**、Vue **16/16**、Solid **27/27**、Svelte **10/10**；四端 typecheck/lint/build、Prettier 与 `git diff --check` 通过。

## 2026-08-28 Grid Core projected-row reconciliation（当前工作树）

- `reconcileProjectedRows` 统一 clipboard/range 对 sorted、filtered、flattened 投影的 identity-key 映射、source-index fallback 与 tree ancestor reconciliation；Vue/Solid/Svelte 删除重复 visible-key/patch 逻辑，React 保留特殊的 `rowPatchKey` index-key fail-closed 路径。
- Core `table-projection` **3/3**；Vue paste/undo **12/12**、Solid **13/13**、Svelte **12/12**；四端 typecheck 与定向测试通过。

## 2026-08-28 Grid Core pinned-boundary count projection（当前工作树）

- `pinnedCountFromDelta` / `computePinnedCountPlan` 统一 separator delta 到 left-pinned prefix 的预算、gapped pin 语义、count clamp 与 changed-column 更新；适配器仅保留响应式拖拽和 controlled/uncontrolled 回调通道。
- Core `pinned-drag` **6/6**；adapter 回归 React **17/17**、Vue **3/3**、Solid **3/3**、Svelte **4/4**；四端 typecheck 与定向测试通过。

## 2026-08-28 Grid Core selection flags projection（当前工作树）

- `computeSelectionFlags` 统一表头 checkbox 的 all/some/empty 投影；Vue 树级联通过 selected/indeterminate predicate 注入特殊语义，受控同步和 toggle callback 仍由适配器负责。
- Core selection **25/25**；表格回归 React **102/102**、Vue **81/81**、Solid **76/76**、Svelte **76/76**；四端 typecheck 与定向测试通过。

## 2026-08-28 Grid Core sort-header projection（当前工作树）

- `resolveTableSortInfo` 下沉单列/多列表头的 active、direction 与 zero-based multi-sort sequence 投影；React/Vue/Solid/Svelte 删除重复 `findIndex`/state 解析，适配器仍负责 aria、图标 DOM 与 callback。
- Core table-sort **7/7**；排序/表头回归 React **114/114**、Vue **111/111**、Solid **88/88**、Svelte **93/93**；四端 typecheck 与 Core build、定向 Prettier、`git diff --check` 通过。

## 2026-08-29 Grid Core data-source mutation boundary（当前工作树）

- `createOutbox` 保留 `flush(): Promise<number>`，新增 `flushDetailed`/`subscribeFlush`；live item identity 合并执行期间的 enqueue/remove/clear，防止旧快照覆盖或复活队列。
- `OutboxCodec`/JSON-safe snapshot guard 明确 durable descriptor 边界；DataSource 新增 `mutateResult`/`mutateRowResult`，deferred/failed 不再触发成功 reload/invalidate，closure payload 在 durable storage 下 fail-closed。
- Core 全量 **125 files / 1,789 tests**，outbox/data-source focused **60/60**；typecheck/build、lint（0 errors；仅既有 complexity warnings）、Prettier 与 `git diff --check` 通过；未改 manifest 或 arch baseline。

## 2026-08-29 Grid Core reconnecting-source generation safety（当前工作树）

- `createReconnectingSource` 增加 transport generation、幂等 teardown 与 reconnect token 护栏；过期 transport 的 message/open/error/close 回调、重复 close 与过期 timer 均 fail-closed，连接/断开同步异常经既有 `onError` 通道处理。
- Core `realtime` focused **19/19**；隔离 worktree Core 全量 **114 files / 1,705 tests**，typecheck/build/lint、定向 Prettier、`git diff --check` 与 runner acceptance gate 通过；保留 close terminal、open active-idempotent 兼容语义，未改 manifest 或 arch baseline。

## 2026-08-29 Grid Core remote-table cancellation/resilience bridge（当前工作树）

- `createRemoteTableSource` 的 query callback 新增可选 `AbortSignal`，并将已有 Core `resilient` 配置透传至 remote proxy；React/Vue/Solid/Svelte 的 proxy 类型与薄桥保持一参数 callback 兼容，params、latest-wins、destroy/SSR 与默认关闭 resilience 语义不变。
- Core/React/Vue/Solid/Svelte focused **22/22、14/14、18/18、24/24、20/20**，五包 typecheck/build/lint、Core framework-import guard、定向 Prettier 与 `git diff --check` 通过；未改 manifest、llms 或 arch baseline。

## 2026-08-29 Grid Core row-key projection（当前工作树）

- 新增 Core `resolveTableRowKey`，Vue/Solid/Svelte 删除重复的字段值/索引 fallback；React 继续保留 legacy `rowId` 与 tree-key 特殊语义。字符串、数字（含空串、零、NaN、Infinity）、null/缺失回退和源行不变均有回归覆盖。
- Core build、三端 focused/typecheck/build/lint、manifest check、定向 Prettier 与 `git diff --check` 通过；未改 manifest、llms 或 arch baseline。

## 2026-08-29 Grid Core grouping projection（当前工作树）

- 新增 Core `buildTableGroupPlan`，React 单列/多列 grouping 的首见分组、复合 key、collapse subtree、原始 row index/identity 与 group summary plan 均由纯函数负责；React 保留 state、props resolution、DOM/render/event。
- Core grouping **71/71**、React grouping **40/40**；Core/React build/typecheck/lint、定向 Prettier、manifest check 与 `git diff --check` 通过，未改 manifest、llms 或 arch baseline。

## 2026-08-29 Grid Core pagination lifecycle（当前工作树）

- `createPaginatedResource` 使 `mode: paged/infinite` 真正区分 replace/append，省略 mode 保留历史 append 语义；页码与 pageSize 统一正整数归一化，reported/unknown total 的 final short/empty page 不再多发请求。
- Core fetcher 新增可选 `AbortSignal`，请求 supersede、`cancel()` 与幂等 `destroy()/disposed` 共享 generation/token 护栏；React/Vue/Solid/Svelte `usePaginatedResource` 转发 signal、暴露 cancel 并在卸载时取消，单参数 fetcher 与 immediate/SSR 兼容。
- Core pagination **20/20**；React/Vue/Solid/Svelte **6/6、7/7、4/4、4/4**，四端 typecheck/build/lint 与定向 Prettier、`git diff --check` 通过；未改 manifest 或 arch baseline。

## 2026-08-29 Grid Core row-edit session and hardening（当前工作树）

- 新增 framework-free `createTableRowEditModel`，四端 row-mode 改为薄桥；Core 统一 session/draft/commit、sync/async editRules epoch、source-row identity、rowIndex、coercion boundary 与 disposal，保留既有 DOM/props/event/undo/audit/autosave 语义。
- 后续 hardening 收口 removed/replaced row fail-closed、commit-time editability、pending validation 幂等、Vue/Solid/Svelte stale blur identity、Vue tree path update、validationSummary source attribution 与 Vue Tab；numeric-select unmatched-option 维持既有兼容行为。
- Core 全量 **128 files / 1,855 tests**；row-edit focused React/Vue/Solid/Svelte **28/28、9/9、13/13、9/9**；typecheck/build/lint、targeted Prettier、manifest、`git diff --check` 与 adversarial review PASS，未改 arch baseline。React 全量仍保留既有 Tree `Maximum update depth` 失败，不纳入本切片。

## 2026-08-29 Grid Core Svelte named-view snapshot projection（当前工作树）

- `TableViewSnapshot` 仅增加可选的 `multiSort`、filters、filterValues、columnWidths、pageSize、expandedRowKeys portable channels；旧 sort-only snapshot 与 `sort: null` 语义保持兼容，Core 仍无框架/DOM 依赖。
- Svelte named-view save/select 通过 `capture`/`applySnapshot` 复用既有 Core feature setter 与 callback funnel；controlled props 保持权威，缺失字段不回放，columnVisibility/columnOrder 维持既有 inert 合同。
- Core table-views **6/6**、Svelte views **8/8**、定向 table **76/76**、SSR **52/52**、hydration **1/1**；Core/Svelte build/typecheck/lint、manifest、Prettier 与 `git diff --check` 通过，未改 arch baseline。

## 2026-08-30 Grid Core Vue/Solid named-view snapshot projection（当前工作树）

- Vue/Solid named-view controllers now accept the shared `capture`/`applySnapshot` projection hooks. Save/select reuses each adapter's existing sorting, filtering, column-width, expansion, and proxy page-size owners; sort-only legacy snapshots, absent-field no-op, controlled authority, and storage fail-closed behavior remain intact.
- `columnVisibility`/`columnOrder` remain deliberately uncollected and unreplayed where these named-view bridges have no owner. Vue/Solid DOM and SSR paths remain unchanged outside the additive view-channel wiring.
- Focused Vue named-view tests **8/8**、Solid named-view tests **8/8**；Core build、Vue/Solid typecheck 与 focused tests 通过，未改 manifest 或 arch baseline。

## 2026-08-30 Grid Core MCP command boundary hardening（当前工作树）

- `runMcpTool` 现在在执行前 fail-closed 校验 required/unknown 参数、primitive 类型、finite number 与 string enum；disabled/unknown/throwing command 返回稳定失败结果，不泄漏异常文本且失败时不调用 command。
- `toMcpTools` 与 `createLlmPlanner` 共用确定性的 sanitized-name collision 分配，保留既有非冲突名称和 `toToolName` API；commands focused **20/20**，Core 全量 **131 files / 1,881 tests**，build/typecheck 通过，lint 仅保留既有 complexity warnings。

## 2026-08-30 Grid Core summary/footer projection（当前工作树）

- 新增纯 Core `projectTableSummary` / `projectTableSummaryCell`，统一 summary operation、null/zero/numeric-string、aggregateAccuracy 与空数据门控；formula/dataIndex value bridge、custom renderer、remote/group/pinned placement 和 DOM/SSR 仍由适配器负责。
- Core table-summary **5/5**；四框架 summary/table focused 回归、typecheck/build/lint、targeted Prettier 与 `git diff --check` 通过；未改 arch baseline。

## 2026-08-30 Grid Core table body row-view projection（当前工作树）

- 新增 `projectTableBodyRows`，统一显式 flat path 与 tree flatten 后的 row-index/tree metadata 组装；lazy children、group/body exclusion、source-row identity 与 adapter reactivity/DOM/events 仍保持原有归属。
- Core tree focused **5/5**；React/Vue/Solid/Svelte focused **44/44、29/29、68/68、61/61**，Core full **131 files / 1,881 tests**、typecheck/build/lint、Prettier 与 `git diff --check` 通过。keyless tree row 的稳定语义未被臆造，仍按现有 public contract 处理。

## 2026-08-30 Grid Core pagination total precedence correction（当前工作树）

- `createPaginatedResource.hasMore()` 先评估定义的 `total`，再使用 short-page heuristic；paged offset 与 infinite accumulated count 均保持正确，unknown-total short/empty-page exhaustion、cancel/stale/dispose 语义不变。
- Pagination **22/22**，adversarial review PASS；Core build/typecheck 与 targeted Prettier、`git diff --check` 通过。

## 2026-08-30 Grid Core resilience and compatibility hardening（当前工作树）

- query-cache 在 reentrant fetcher 场景预先安装 generation/in-flight promise；DataSource resilient cache 对 JSON-safe query 做 canonical key，对非 JSON-safe 值 fail-closed 隔离；SWR 通过 `ResilientFetcherOptions.staleWhileRevalidate` opt-in 透传，默认关闭。
- outbox 的 in-flight remove/clear 现在报告 `failed`/`queued: false` 的不确定交付，保留 executorStatus；DataSource 会清理 optimistic/pending 状态并在 resolved uncertainty 下 reload/invalidate。旧 `Outbox`、`PaginatedResource`、`DataSourceController` 与 `GridEditingValidation` 结构保持可实现，factory 返回 advanced capability。
- Core resilience/data-source focused **116/116**；Core 全量 **131 files / 1,908 tests**；Core/React/Vue build/typecheck 与 `git diff --check` 通过。Core lint 仅保留 complexity warnings。

## 2026-08-30 Grid Core tree and finite-value hardening（当前工作树）

- 四端 tree checkbox cascade 在 lazy placeholder `children: []` 下优先非空 eager children，否则使用 lazy cache；React uncontrolled checked model 不再被等价 default prop 重置，Vue/Solid/Svelte 同步保持 shape/disabled 变化语义。
- Svelte Table 增加 additive `lazyLoad` bridge，numeric row key 使用原始 resolved key 写回；Svelte standalone tree lazy rejection 清理 loading、标记 error、收起并允许 retry。Core table-sort 保留 null-first，column-width 对 overflow/NaN/Infinity fail-closed。
- React/Vue/Solid/Svelte tree/table focused **29+103、26+94、23+70、14+60**；React Tree 原有 update-depth 失败已修复。未调整 arch baseline。

## 2026-08-30 Grid Core virtualizer finite-input hardening（当前工作树）

- Core `createVirtualizer` 现在对 count、estimate、viewport/scroll/buffer/fixedSize、index 与 measure 输入做有限值/非负归一化；超大 finite count 在分配 size tree 前 fail-closed，Fenwick aggregate size capped，避免 NaN/Infinity/overflow 污染窗口状态。
- 保留有效输入、零尺寸、stable-key/index-key、SSR 与既有 adapter API；负小数 index 不再截断成 `0`，非有限 measurement 不写入 cache/tree。Core virtualizer **34/34**、全量 **131 files / 1,915 tests**、typecheck/build 通过，lint **0 errors / 8 complexity warnings**，未改 adapter、manifest 或 arch baseline。

## 2026-08-31 Grid Core final closure（当前工作树，已验证）

- Core `query-cache` 的可选 `maxEntries` 已完成容量 hardening：finite capacity 会先做 floor/clamp 归一化，再进入有界 LRU；`get/fetch/set/invalidate` 刷新 recency；`undefined` 与非有限值保持无限容量，SWR/default 行为不变；被驱逐、移除或清空的 in-flight generation 会被 orphan，late settle 不会污染随后重建的同 key entry；`maxEntries: 0` 时 cache 不保留 settled entry，但仍会去重同 key 的 in-flight fetch。
- `ResilientFetcherOptions.maxEntries` 为 additive option，并直接透传 `QueryCacheOptions.maxEntries`；`undefined`、`NaN`、`+Infinity` 与 `-Infinity` 继续保持无限容量。
- Core 公共 barrel、拆分后的 row-edit / remote-table tests，以及 React/Vue/Solid/Svelte 主 Table 实现与主 Table 测试分解后都低于各自现有 ratchet baselines；本批不改变 public API。
- Svelte 修复 `useDataSource` initial-load `onMount` 与 same-id stale-blur identity；React 的 isomorphic layout effect 覆盖 Table、grid virtual、`IrisVirtualScroll` 与 Select，并收口 pagination/table helper warnings；Vue 修复 resizer lifecycle 与 conditional DataSource `onMounted`。
- 当前 verified package totals：Core **133 files / 1,922 tests**；React **273 files / 3,072 tests**；Vue **195 files / 1,749 tests**；Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）；Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）。Core + 四适配器 full suites 合计 **9,099 tests**。
- Gates：Core 与四个适配器 full tests/typecheck/build/lint 全部通过（Svelte `svelte-check` **0 errors / 0 warnings**）；`pnpm check:manifest` 报告每个框架 **155 components**、tokens **86**；Core framework-import guard、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 全部通过。非阻断输出仅剩既有 lint complexity warnings（**10** total：Core **8**、React **1**、Vue **1**）、arch ratchet **301** non-blocking warnings，以及预期的 jsdom navigation / localStorage stderr；keyless-tree identity 仍是现有 public API limitation。

## 2026-08-31 Grid Core resilience follow-up（当前工作树，已验证）

- `ResilientFetcherOptions.maxEntries` 已按 additive 方式接入，并直接透传 `QueryCacheOptions.maxEntries`；focused resilient-fetcher 回归 **11/11** 覆盖 forwarded LRU eviction，以及 `undefined`、`NaN`、`±Infinity` 保持无限容量的兼容路径。
- 最终 adversarial pass 额外修复了 `maxEntries: 0` 时“新建 fetch entry 在并发同 key 调用共享 in-flight promise 前被过早驱逐”的竞态；zero-capacity cache 现仍去重 in-flight 调用，但不保留任何 settled entry，并已补齐回归覆盖。
- Post-fix Core preflight **23 files / 262 tests** 与 Core full **133 files / 1,922 tests** 通过。

## 2026-08-31 Grid Core realtime tuning hardening（当前工作树，已验证）

- `createReconnectingSource` 对非有限、负值和 fractional backoff/max-retry tuning 做确定性归一化，确保 delay/retry counter 为 finite/non-negative；有效/default 参数、`maxRetries: 0`、`factor: 0` 与 `maxBackoffMs < backoffMs` 语义保持。
- 连接 generation、terminal `close()`、active 时幂等 `open()`、唯一 reconnect timer、同步 connect/handler/teardown 异常和 SSR 无 DOM 依赖保持；补齐 `onStatus` reconnect throw 仍装载 timer、同步 `onOpen` throw 不丢 teardown 的竞态修复。
- Realtime **25/25**；Core 当前全量 **133 files / 1,930 tests**、typecheck/build 通过，lint **0 errors / 8 complexity warnings**；adversarial review PASS。未改 adapter、manifest 或 arch baseline。

## 2026-08-31 Grid Core zero-capacity cache and durable outbox follow-up（当前工作树，已验证）

- `query-cache` 的 `maxEntries: 0` 现在在 fetch、set、invalidate 路径都不保留 settled/orphaned entry，但仍保留同 key in-flight 去重；新增回归覆盖 in-flight 被 `set` 或 `invalidate` 替换后的容量边界。
- Durable outbox 的 `remove`/`clear` 仅在 storage commit 成功后标记 in-flight removal；持久化失败时仍排队的执行不会被误报为显式移除。
- Core focused **102/102**（query-cache 22、resilient-fetcher 11、data-source-resilient 19、outbox 16、virtualizer 34）；Core 全量 **133 files / 1,924 tests**、build/typecheck 通过，lint **0 errors / 8 warnings**；定向 Prettier 与 `git diff --check` 通过。未改 public API、manifest 或 arch baseline。

## 2026-08-31 React Grid projected-row reconciliation follow-up（当前工作树，已验证）

- React Table 的 row patch reconciliation 现统一委托 Core `reconcileProjectedRows`；适配器继续保留 legacy `rowPatchKey` 的 `rowKey` / `rowId` / tree identity 解析，以及 index-key write-back 的 fail-closed 语义，不再重复维护可见投影 patch 合并循环。
- Delete 与 context-menu clear 在 sorted keyless `rowId` 视图上的 focused 回归已补齐；最终 review 未再发现 concrete regression。本批未修改任何 Core source 文件。
- 当前 verification 口径：Core full **133 files / 1,924 tests**；React full **273 files / 3,074 tests**；Vue **195 files / 1,749 tests**；Solid **170 files / 1,197 tests**（client **162 / 1,147**；SSR **8 / 50**）；Svelte **168 files / 1,159 tests**（client **163 / 1,107**；SSR **5 / 52**）；Core + 四适配器 full suites 合计 **9,103 tests**。
- Gates：Core / React `typecheck`、build、lint 与受影响适配器 smoke / full checks 通过；targeted Prettier 与 `git diff --check` 通过。非阻断输出仅剩既有 lint complexity warnings（**10** total：Core **8**、React **1**、Vue **1**）、`pnpm arch-check:ratchet` **301** 条 non-blocking warnings、预期的测试环境 stderr（Node `ExperimentalWarning` localStorage；React 既有 jsdom navigation / `act(...)` / DOM nesting / list-key / intentional provider error logging），以及 keyless-tree identity 的 public API limitation。

## 2026-08-31 Grid Core realtime tuning hardening（当前工作树，已验证）

- `createReconnectingSource` 对非有限、负值和 fractional reconnect tuning 做确定性归一化；backoff delay、retry counter 始终 finite/non-negative，保留 `maxRetries: 0`、`factor: 0`、`maxBackoffMs < backoffMs`、默认与有效参数语义。
- 连接代际、terminal `close()`、active 时幂等 `open()`、同步 connect/handler/teardown 异常、唯一 reconnect timer 与 SSR 无 DOM 依赖保持不变；补齐 `onStatus` reconnect throw 仍装载 timer、同步 `onOpen` throw 不丢 teardown 的回归。
- Realtime focused **25/25**；Core 当前全量 **133 files / 1,930 tests**、typecheck/build 通过，lint **0 errors / 8 complexity warnings**；最终 adversarial review PASS。未改 adapter、manifest 或 arch baseline。

## 2026-09-01 Grid Core projected-row hardening（当前工作树，已验证）

- Core `reconcileProjectedRows` 的 flat reconciliation 现在在 true no-op 时保留原始
  `sourceRows` source-array identity；duplicate-key rows 按各自唯一的 source slot
  写回；duplicate row-object identity 则 fail-closed。Core `table-projection`
  覆盖已补齐 keyless sorted flat reconciliation、duplicate keys 与 duplicate row
  objects。
- React `IrisTable` 先前已将 row patch reconciliation 委托给该 helper；本批无任何
  adapter source 变更。
- 当前 verification totals：Core **133 files / 1,936 tests**；React **273 files /
  3,074 tests**；Vue **195 files / 1,749 tests**；Solid **170 files / 1,197 tests**
  （client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）；Svelte
  **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files /
  52 tests**）；Core + 四适配器 full suites 合计 **9,115 tests**。
- Gates：Core 与 React/Vue/Solid/Svelte full tests/typecheck/build/lint 通过；
  targeted Prettier、`git diff --check`、Core framework-import guard 与
  `pnpm check:manifest`（每框架 **155 components**、tokens **86**）通过。
- 架构门：`packages/react/src/primitives/table/Table.tsx` 已回到 ratchet baseline
  （arch count **9,137** == baseline **9,137**）；`pnpm arch-check:ratchet`
  当前仍保留且仅保留 1 个无关阻断项：`packages/core/src/realtime.test.ts`
  **547** 行，来自独立的 non-Grid 工作，因此本批不宣称 ratchet 全绿。
- 非阻断输出仅剩既有 lint complexity warnings（**10** total：Core **8**、React
  **1**、Vue **1**）、arch ratchet **301** 条 non-blocking warnings、预期测试环境
  stderr（Node `ExperimentalWarning` localStorage；React 既有 jsdom navigation /
  `act(...)` / DOM nesting / list-key / intentional provider error logging）；
  keyless-tree identity 仍是现有 public API limitation。

## 2026-09-01 Grid Core MCP and test-boundary follow-up（当前工作树，已验证）

- MCP command boundary 继续 fail-closed：无效/空 sanitized tool name 不暴露或执行，malformed parameter definition 返回稳定失败；LLM planner 对模型填充的 args 复用同一参数校验，invalid args 回退 deterministic planner。commands focused **23/23**，未加入授权、确认、限流或 durable outbox。
- `packages/core/src/realtime.test.ts` 拆为主生命周期测试、connect-error 测试与共享 support helper；保留全部 **25** 个 realtime tests，不改 `realtime.ts` 或运行时契约，两个测试文件分别 **306/213** 行，均低于 500 行门槛。
- 当前 Core full **134 files / 1,936 tests**；Core typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 arch baseline、manifest 或禁止目录。

## 2026-09-02 React Grid column-state handoff follow-up（当前工作树，定向已验证）

- React `useGridColumns` 现在缓存最近一次非受控/`defaultWidths` 列宽快照；当受控 `widths` 被移除时，bridge 会立即恢复该快照并静默重同步 model，因此非受控 → 受控 → 非受控会回到最近一次本地/默认宽度，而不是泄漏旧的受控 map。若初始即受控，则撤掉 `widths` 后稳定回退 `defaultWidths`。
- 对抗式复核额外发现并修复了 React-only 的 pinned handoff 连带问题：`pinnedColumns` 从受控回到非受控时不再重置为 `EMPTY_PINNED`，而是恢复最近一次非受控/默认 pinned 快照，并保留显式 `null` unpin。本批未修改任何 Core source 文件。
- 新增 focused regressions：`packages/react/src/grid/useGridColumns.test.tsx` 覆盖非受控 → 受控 → 非受控 widths restore、初始受控 widths 移除回退 `defaultWidths`、pinned `null` snapshot restore；相关列状态/列宽回归还重跑了 Core `packages/core/src/grid-columns.test.ts`，以及 React `packages/react/src/primitives/table/auto-resize-columns.test.tsx`、`packages/react/src/primitives/table/reset-column-widths.test.tsx`、`packages/react/src/primitives/table/test/pin-column-menu.test.tsx`、`packages/react/src/primitives/table/test/pinned-drag-controlled-reset.test.tsx`。
- 通过：React full **273 files / 3,075 tests**、Core focused `grid-columns`、React `typecheck`/build/lint、targeted Prettier 与 `git diff --check`。当前工作树 verified counts（含独立 MCP hardening）为 Core **134 files / 1,941 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）、Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**），Core + 四适配器 full suites 合计 **9,121 tests**。本切片未重跑全部包门禁。
- 本切片验证时 `pnpm arch-check:ratchet` 仍被独立的 non-Grid commands 文件阻断；该阻断随后由下一切片的模块拆分解决。keyless-tree identity 仍是现有 public API limitation。

## 2026-09-02 Grid Core remote-table hardening（当前工作树，已验证）

- framework-free Core remote-table 现在在初始 params 摄取、`setParams` 摄取、派生 state 投影与对外 `query` 交接时统一 clone `sort` / `sorts` / `filters`；调用方持有的入参对象与 query 内被修改的对象不再别名污染 live state，但值与既有 API 行为保持不变。复核范围内的 DataSource / pagination 合同无需其他 source 改动。
- params / lifecycle / data-source / pagination focused 回归 **92/92** 通过。
- Core 当前完整验证为 **136 files / 1,943 tests**；Core `typecheck` / build / lint 通过，lint 仅保留 **8** 条既有 warnings；targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过。
- 当前工作树 ledger 更新为：Core **136 files / 1,943 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）、Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）；合计 **9,123 tests**。本切片只新增验证了 Core remote-table surface，不宣称四个适配器 full suites 在此切片内重跑。

## 2026-09-02 Grid Core host reentrancy hardening（当前工作树，已验证）

- framework-free `packages/core/src/grid.ts` 现在会在 feature `setup()` 内发生 reentrant `core.use()` / `core.ready()` / `core.destroy()` 时收口宿主状态：外层 `use()` 失败会回滚该轮新增的全部 feature install（含嵌套 install），失败后若实例尚未 destroy 则恢复进入 `use()` 前的 `status`；若 `setup()` 中途已 destroy，则中止 `setup()` 之后的 methods/features 注册，并跳过已移除 record 以避免 double cleanup。
- Focused Grid regressions 新增 `packages/core/src/grid.reentrancy.test.ts`，共 **3** 个 tests；`packages/core/src/grid.test.ts` 保持不动，因为它已在 **500** 行 arch ratchet 上限。
- Public API 与既有 Phase 0–4 决策不变。Core 当前完整验证为 **138 files / 1,951 tests**；Core `typecheck` / build / lint、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过，lint 仅保留既有 warnings。
- 当前工作树 ledger 更新为：Core **138 files / 1,951 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）、Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）；合计 **9,131 tests**。这些 adapter totals 仅作为当前 ledger 记录；本切片不宣称重跑了全部 adapter full suites。

## 2026-09-02 Grid Core cell-edit stale-async hardening（当前工作树，Core 已验证）

- framework-free `packages/core/src/cell-edit.ts` 现在会在草稿值发生变化时递增内部 session generation；先前草稿上已发出的晚到 async validation/commit 因 generation 过期会被丢弃，不再把 stale value 写回并错误关闭当前编辑会话。公共 API、row-key 语义与既有 commit metadata 均未改变。
- 回归已补到 `packages/core/src/grid-editing.test.ts`；本切片 focused 回归通过：Core `cell-edit` + `grid-editing` **28/28**，React `useGridEditing` smoke **2/2**，Vue `useGridEditing` smoke **1/1**。Solid/Svelte focused `useGridEditing` 在该 runner 因缺少环境依赖未能运行，本条不宣称它们通过。
- 验证：Core full suite **138 files / 1,953 tests**、Core build、Core `typecheck`、Core `lint`（**0 errors / 8 existing warnings**）、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过。
- 当前工作树 ledger 口径更新为：Core **138 files / 1,953 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）、Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）；Core + 四适配器合计 **9,133 tests**。这些 adapter totals 仅作 ledger context 记录，不表示本切片已全量重跑。

## 2026-09-01 Grid Core command-module decomposition（当前工作树，已验证）

- 保留 `@iris-ui-kit/core/commands` public entrypoint，将 command registry、MCP boundary、LLM planner 分拆为 `commands-registry.ts`、`commands-mcp.ts`、`commands-llm.ts`；public barrel `commands.ts` 仅 **37** 行，行为、导出、顺序、SSR/framework-free contract 保持。
- 原 `commands.test.ts` 拆为 registry/MCP/LLM 三组测试，分别 **73/332/121** 行；commands focused **28/28**，不删除或弱化覆盖。
- Core 当前 full **136 files / 1,941 tests**；Core typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 arch baseline、manifest 或禁止目录。

## 2026-09-01 Grid Core remote-table boundary hardening（当前工作树，已验证）

- `createRemoteTableSource` 现在在初始参数、`setParams`、派生 state 与 `options.query` handoff 边界复制 `sort`/`sorts`/`filters`，调用方或 query callback 修改传入对象不会隐式改写 controller state；旧参数、分页、signal/abort、latest-wins、resilient cache、destroy 与 SSR 语义保持。
- Remote-table/DataSource/pagination focused **92/92**；Core 当前 full **136 files / 1,943 tests**，typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-01 Grid Core DataSource ownership hardening（当前工作树，已验证）

- DataSource 在 setter/build/query 边界复制 sort、multiSort、filters、filterRules；fetch result rows、optimistic mutation rows 与 selectedKeys 也不再与调用方/内部 canonical state 共享可变容器，保留 `FilterRule.value` identity 及既有 fetch/mutation API。
- 修复 fetcher/query 外部修改污染 live state、fetch-owned rows 后续修改反写 state，以及 in-place optimistic mutation 破坏 rollback canonical rows 的问题；新增 ownership 与 rollback 回归。
- DataSource/resilient/outbox focused 回归通过；Core 当前 full **137 files / 1,948 tests**，typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-01 Grid Core feature-host reentrancy hardening（当前工作树，已验证）

- Core Grid feature host 现在对 `setup()` 内 reentrant `use()`、`ready()`、`destroy()` 做事务式保护：失败时回滚嵌套安装、恢复此前 status、避免 destroy 后继续注册 methods/features，并跳过已清理记录以防重复 dispose。
- 保留 feature 依赖拓扑排序、生命周期顺序、ready/destroy 幂等与既有 public API；新增 `grid.reentrancy.test.ts`，未改变 framework-free/SSR contract。
- Grid focused tests、Core typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过；Core 当前 full **137 files / 1,951 tests**。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-02 Grid Core selection and expansion controller hardening（当前工作树，已验证）

- Selection multi-mode 的 `NaN`/SameValueZero 删除语义已修复：`deselect(NaN)` 与 `toggle(NaN)` 不再因 `!==` 留下已选 key；默认/受控 mirror、顺序、onChange、store/index freshness 与 `computeSelectionFlags` 合同保持。
- Expansion model 现在在 direct `store.setState()`、batch 与 reentrant subscriber 写入后惰性重建 membership index，并从实际 post-notify state 同步 commit；single/multiple、NaN/Infinity key、顺序与既有 API 保持。
- Selection、tree-selection、expansion、grid-expansion 相关 focused 回归及 Core full 验证通过；Core 当前 **138 files / 1,957 tests**，typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-04 Grid Core tree projection write-back hardening（当前工作树，定向已验证）

- `packages/core/src/table-projection.ts` 现在在 canonical tree 存在 duplicate row keys 或 repeated row-object identities 时，对 tree projection write-back fail-closed，避免 ambiguous branch update；`packages/core/src/table-projection.test.ts` 新增对应 regression。
- 本批为 additive hardening，不引入 keyless-tree identity，也不改变 public API。
- Runner validations：Core build/typecheck passed；Core focused `table-projection` / grid rows / clipboard tests **41/41** passed；React focused tests/typecheck/build/lint passed；Vue bridge test/lint passed，但 broader Vue checks 因缺少 workspace theme dependencies 被阻断；Solid typecheck/lint passed，tests/build 因缺少 `vite-plugin-solid` / `tsup` 被阻断；Svelte lint passed，tests/typecheck/build 因缺少 Svelte tooling 被阻断。Targeted Prettier、framework-free import guard 与 `git diff --check` passed。本批不宣称 full adapter reruns。

## 2026-09-05 Grid Core virtualizer window hardening（当前工作树，已验证）

- `packages/core/src/virtualizer.ts` 修正 fixed-size window calculation：部分可见的首行现在会被纳入窗口；例如 count 10、size 20、viewport 20、scroll 10 时，indices 为 **[0, 1]**。
- `packages/core/src/virtualizer.test.ts` 新增上述 regression，并补充 invalid/fractional controls、huge counts、non-finite sizes 与 aggregate overflow 的 edge-case coverage。
- Pagination、sorting、filtering 与 range audit 未发现有证据支持的 defect（no evidence-backed defect）。本批不改变 public API 或 keyless-tree identity semantics。
- 验证：Core build/typecheck passed；Core focused **112** tests passed；本切片后 Core full suite **138 files / 1,958 tests** passed；React/Vue focused adapter tests passed；React/Solid typecheck passed；Prettier、framework-free import guard、`git diff --check` 与 `pnpm arch-check:ratchet` passed。
- Solid tests/build 因缺少 `vite-plugin-solid` 被阻断；Svelte tests/typecheck/build 因缺少 tooling 被阻断；Vue typecheck 因缺少 workspace theme/tokens/icons/skins declarations 被阻断。本批不宣称 full adapter reruns。
- 当前 ledger context：Core **138 files / 1,958 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**、Svelte **168 files / 1,159 tests**，total **9,138**；adapter totals 仅作 ledger context，不表示本切片已全量重跑。

## 2026-09-05 Grid Core roving-navigation finite-input hardening（当前工作树，已验证）

- Core `roving` 导航数学现在对 NaN/Infinity/负值/fractional count 与 index fail-closed，避免全 disabled 或 infinite count 非终止；`nextGridCell` 的 invalid cell/pageSize 与 PageUp/PageDown disabled-target fallback 也保持确定性。
- 保留 valid-input 的 loop/non-loop、Home/End、typeahead wrap/case/trim、same-row/column 与 public API 语义；无 DOM/框架依赖。
- Roving focused **23**、Core keyboard/grid focused **136**、React table keyboard focused **90**；Core 当前 full **138 files / 1,965 tests**，typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core formula malformed-row hardening（当前工作树，已验证）

- `packages/core/src/formula.ts` 现在安全拒绝 `null` 与非 object row；`evaluateFormula`（例如 `evaluateFormula("price", null)`）遇到 malformed row 时 fail-closed 返回 `null`，不再抛异常。`packages/core/src/formula.test.ts` 新增 malformed-row regression coverage。
- 本批不改变 public API 或 keyless-tree identity semantics。
- Core build passed；Core focused formula/table-value tests **75 passed**；React formula tests **27 passed**；targeted Prettier、framework-free import guard 与 `git diff --check` passed。Vue focused formula checks 因缺少 `@iris-ui-kit/theme` 被阻断；Solid focused formula checks 因缺少 `vite-plugin-solid` 被阻断；Svelte focused formula checks 因缺少 Vitest module 被阻断。
- 共享 worktree 中观察到的当前 Core full run 为 **138 files / 1,965 tests**；该计数不表示全部属于本 formula slice，也不表示本批重跑了完整 adapter suites。

## 2026-09-05 React Grid column-state handoff hardening（当前工作树，定向已验证）

- `packages/react/src/grid/useGridColumns.ts` 现在跟踪最近一次 uncontrolled order snapshot；移除受控 `order` 后，bridge 会恢复该 snapshot，而不是暴露被 Core 拒绝的 optimistic order。
- `packages/react/src/grid/useGridColumns.test.tsx` 新增对应 regression，并补充 width/order/pin handoff coverage。本切片未修改任何 Core source 文件，也未改变 public API 或 keyless-tree identity semantics。
- 验证：Core focused tests **47/47**、React column tests **45/45**、React typecheck、targeted Prettier、Core framework-free import guard 与 `git diff --check` 通过。
- Vue focused tests 因现有缺失依赖 `@iris-ui-kit/theme` 被阻断；Solid focused tests 因现有缺失依赖 `vite-plugin-solid` 被阻断；Svelte focused tests 因缺少 `vitest` module 被阻断。Full adapter suites 未重跑。

## 2026-09-05 Grid Core clipboard and sort/filter boundary hardening（当前工作树，已验证）

- Clipboard Core 对 multi-cell overflow into empty grid、malformed `setValue`/`overflowRows`/`reconcileRows` 输出与 direct serializer coordinates fail-closed；HTML copy 增加 formula-injection safety，保留 TSV-only paste、adapter-owned I/O 与既有 API。
- Table sort/filter Core 现在对 NaN/Infinity、malformed sort/filter channels、异常 filter method 与 comparator result 做确定性 fail-closed；稳定 tie、多排序优先级、identity no-op、resolver contract 与有效输入行为保持。
- Core 当前 full **138 files / 1,975 tests**；clipboard/range、sort/filter、typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core summary/aggregate finite-input hardening（当前工作树，已验证）

- Summary/aggregate Core 对 malformed operation/column/spec/value callback/raw coercion 做 fail-closed；finite extreme values 的 avg 不再溢出，min/max 不再因超大输入触发 spread `RangeError`，fractional/non-finite `aggregateAccuracy` 不再误四舍五入。
- 保留空数据默认值、count/null/zero/numeric-string 语义、排序与重复/未知列行为、adapter value resolver/custom render contract 及 framework-free/SSR 行为。
- Summary/aggregate focused **62**、Core 当前 full **138 files / 1,984 tests**；typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core table-summary/aggregate hardening follow-up（当前工作树，已验证）

- `packages/core/src/data-view/aggregate.ts` 与 `packages/core/src/table-summary.ts` 现在校验 malformed aggregate operations/specs/columns/callback inputs，safely coerce finite values，避免 average overflow 与 spread-based min/max `RangeError`，并拒绝 fractional/non-finite `aggregateAccuracy`。
- `packages/core/src/table-summary.test.ts` 与 `packages/core/src/data-view-filterable.test.ts` 含有对应 regression coverage；valid empty/default、count、ordering、duplicate/unknown-column、callback-exception、no-mutation 与 adapter value-resolution semantics 保持不变。
- 验证：summary/aggregate focused **62** tests passed；当前 Core full run **1,984** tests passed；Core typecheck/build passed；lint passed with unrelated existing warnings；`git diff --check` 与 `pnpm arch-check:ratchet` passed。
- 本切片不宣称 adapter tests 或 full adapter reruns；未修改 adapters、public API、keyless-tree identity semantics、manifests 或 prohibited files。

## 2026-09-05 Grid Core tree mutation hardening and ratchet split（当前工作树，定向已验证）

- `packages/core/src/grid-tree-rows.ts` 与 `packages/core/src/grid-tree-children.ts` 现在在 keyed update/remove/child hydration 前 fail-closed：只要可达树结构含 duplicate keys 或 repeated/cyclic row-object identity，就不写回；没有臆造 keyless identity。
- validation helper 仅为满足 arch ratchet、将 `grid-tree-rows.ts` 保持在 **478** 行而移至新文件 `packages/core/src/grid-tree-validation.ts`；public exports 与 runtime semantics unchanged。回归位于 `packages/core/src/grid-tree-rows.audit.test.ts`。
- 验证：Core build、focused tree tests（**2 files / 3 tests**）、Core typecheck、targeted Prettier、framework-free import guard、`git diff --check` 与 `pnpm arch-check:ratchet` 均通过；ratchet 仅有 non-blocking warnings。Vue/Solid/Svelte tree tests 因既有缺失 workspace dependencies 被阻断；本切片不宣称 full adapter reruns。

## 2026-09-05 Grid Core clipboard/range callback hardening（当前工作树，已验证）

- Clipboard/range Core 现在截断 fractional coordinates、忽略 non-finite updates，避免 overflow auto-ID collision；callback row/snapshot、malformed `setValue`/`overflowRows`/`reconcileRows`、partial/empty range 与 serializer 输入均 fail-closed。HTML formula safety 保持，TSV-only paste 与 adapter-owned clipboard I/O 不变。
- 保留 valid-input 的 range、editable/formula、transaction metadata、no-op identity 与 public API contract；新增 focused hardening coverage。
- Core 当前 full **140 files / 1,990 tests**；Core typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core keyboard/editing lifecycle hardening（当前工作树，定向已验证）

- `packages/core/src/keyboard-nav.ts` 现在会归一化无效的 count/index，并在选中前拒绝越界或 disabled 的 `initialIndex`；对应回归已补到 `packages/core/src/keyboard-nav.test.ts`。
- `packages/core/src/grid-editing.ts` 现在会在 dispose 后抑制异步校验回调；`packages/core/src/grid-editing.test.ts` 新增 disposal coverage。
- 既有 public API 与 keyless-tree identity semantics 保持不变。
- 验证：Core build/typecheck passed；Core focused keyboard/editing tests **95 passed**；React、Vue、Solid、Svelte bridge/table checks passed；targeted Prettier、framework-free import guard 与 `git diff --check` passed。React advanced suite 的 Vitest worker 出现 `onTaskUpdate` timeout，但 tests 已通过，focused React checks clean；本条不宣称 full adapter reruns。
- 当前 shared-worktree context 中观察到 Core full run 为 **140 files / 1,993 tests**；该计数仅表示当前 shared-worktree context，并非可全部归因于本 slice。

## 2026-09-05 Grid Core tree-selection cascade hardening（当前工作树，已验证）

- Tree selection 对 unknown/empty/disabled 操作现在 fail-closed，不再为 no-op 触发通知；disabled branch 从 ancestor cascade 排除，duplicate flat definitions 使用 first-definition-wins，nodes snapshot 不受调用方后续 mutation 影响。
- 保留 branch checked/indeterminate 派生、leaf ordering、cycles/duplicate guards、NaN/Infinity/0 keys、reentrant store 与 framework-free/SSR contract；新增 focused regression coverage。
- Tree-selection focused **17**、Core grid/tree focused **25**、React/Vue/Solid/Svelte tree checks **47/41/38/32**；Core 当前 full **140 files / 2,000 tests**，typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core selection/expansion lifecycle hardening（当前工作树，定向已验证）

- `packages/core/src/selection.ts` 与 `packages/core/src/expansion.ts` 现在会在 store/callback 通知前检测有效的 SameValueZero no-op；`packages/core/src/grid-selection.ts` 与 `packages/core/src/grid-expansion.ts` 在 Core dispose 后抑制 callback。
- `packages/core/src/selection.test.ts`、`packages/core/src/expansion.test.ts` 与 `packages/core/src/grid.test.ts` 新增对应 regression。既有 public API 与 keyless-tree identity semantics 保持不变。
- 验证：Core build passed；Core focused tests **95 passed**；React bridge/lazy tests passed；Vue/Solid bridge tests passed；Solid/Svelte lazy tests passed；Core/React/Vue/Solid/Svelte typechecks passed；targeted ESLint/Prettier、framework-free import guard 与 `git diff --check` passed。
- Vue lazy-tree test 在 **120s** 超时；该 timeout 未产生 source changes。本批不宣称 full adapter reruns。

## 2026-09-05 Grid Core test ratchet split（当前工作树，已验证）

- 这是仅限测试的结构清理：`packages/core/src/grid.test.ts` 从 **521** 行拆为 **339** 行；新增 `packages/core/src/grid-selection-expansion.test.ts` **118** 行与 `packages/core/src/grid-sorting.test.ts` **69** 行。
- 全部 **20** 个 Grid tests 均保留；3 个文件 / **20** 个 focused tests passed。未修改 `grid.ts`、feature source、public API 或 runtime behavior。
- 验证：Core full suite **142 files / 2,005 tests**；Core typecheck/build/lint（**0 errors / 9 existing warnings**）、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 均通过。本批不宣称 full adapter reruns。

## 2026-09-05 Grid Core resilience and test-boundary follow-up（当前工作树，已验证）

- `circuit-breaker` 的 half-open 状态现在只允许一个 trial in flight，避免并发请求同时穿过半开门；query-cache/resilient-fetcher 的 TTL/SWR、LRU、generation、zero-capacity 与既有默认语义保持。
- Grid selection/expansion 对 SameValueZero no-op 与 Core dispose 后 callback 做保护；`grid.test.ts` 按 host、selection/expansion、sorting 拆分，原有 **20** 个 Grid tests 全部保留，文件均低于 500 行门槛。
- 当前 Core full **142 files / 2,005 tests**；resilience focused **78**、Grid focused **20**，Core typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-06 Grid Core sort/filter bridge hardening（当前工作树，定向已验证）

- `packages/core/src/grid-sorting.ts` 现在对语义等价的 fresh-object sort/multi-sort setters 抑制 callbacks/events 与不必要的 store writes；`packages/core/src/grid-filtering.ts` 增加等价的 no-op guards，并使 clear 保持 atomic，只通知实际发生变化的 channels。
- 回归位于 `packages/core/src/grid-state.test.ts` 与 `packages/core/src/grid-sorting.test.ts`。未改变 keyless-tree identity 或 public API semantics。
- 验证：Core build passed；Core focused tests **30 passed**；React focused tests **38 passed**；React/Vue/Solid/Svelte typechecks passed；targeted Prettier、framework-free import guard 与 `git diff --check` passed。
- 更广的 adapter filter-panel suites 存在既有 **5-second timeouts**；未修改 adapter source，也未运行 full adapter reruns。

## 2026-09-06 Grid Core range/clipboard hardening（当前工作树，已验证）

- `packages/core/src/grid-clipboard.ts` 现在将 paste callback/event row snapshots 与 custom `setRows` bindings 隔离；`packages/core/src/range-stats.ts` 对 Symbol 等无法 coercion 的值按 non-numeric 处理，不再抛异常。
- 回归覆盖位于 `packages/core/src/grid-range-clipboard.test.ts` 与 `packages/core/src/range-stats.test.ts`。保留 shallow nested-row semantics；未修改 adapter、public API 或 keyless-tree identity semantics。
- 验证：Core build passed；Core focused tests **44 passed**；React/Vue/Solid/Svelte range/clipboard tests passed；React/Vue/Solid/Svelte SSR tests passed；targeted Prettier、framework-free import guard 与 `git diff --check` passed。本批不宣称 full adapter reruns。

## 2026-09-06 Grid Core flat row transaction hardening（当前工作树，已验证）

- `packages/core/src/grid-rows.ts` 现在将“同长度且所有 row 引用均未变化”的数组视为 `commit`/`loadData` no-op，避免 replacement store write/notification/transaction；`packages/core/src/grid-rows.test.ts` 新增 regression coverage。
- 未修改 adapter、public API 或 keyless-tree identity semantics。`packages/core/src/grid-rows-lazy.ts` 不存在；lazy behavior 仍位于现有 tree-child/adapter paths。
- 验证：Core build/typecheck passed；focused Core tests **54 passed**；React bridge **10 passed**、Vue bridge **3 passed**、Solid bridge **3 passed**、Svelte bridge **3 passed**；lazy tests React **14 passed**、Vue **7 passed**、Solid **10 passed**、Svelte **14 passed**；targeted Prettier、framework-free import guard 与 `git diff --check` passed。
- Vue parity file 有 **3** 个 unrelated filter-test timeouts，但 lazy tests passed；本条不宣称 full adapter reruns。

## 2026-09-06 Grid Core layout/span/responsive hardening（当前工作树，定向已验证）

- `packages/core/src/responsive.ts` 现在在 responsive tail hiding 期间快照 pinned-column 结果，因此 malformed/re-entrant pin callbacks 不会被重复调用并抛错；`packages/core/src/grid-span.ts` 将 fractional spans 归一化为正的 CSS Grid 整数。
- 回归位于 `packages/core/src/responsive.test.ts` 与 `packages/core/src/grid-span.test.ts`。layout/width/column virtual/fade helpers 审计未发现其他有证据支持的 defect。
- 未修改 adapter source、public API 或 keyless-tree identity semantics。
- 验证：Core build/typecheck passed；Core focused tests **47 passed**；React/Vue/Solid/Svelte layout、virtualization、span、pinned、responsive 与 SSR-focused tests passed；四个适配器 typechecks passed；Svelte check **0 errors / 0 warnings**；targeted Prettier、framework-free import guard 与 `git diff --check` passed。Full repository suite 与 dedicated RTL table tests 仍在本次 focused audit 范围之外；本批不宣称 full adapter reruns。

## 2026-09-06 Iris Core lifecycle, data-boundary, and pure utility hardening（当前工作树，已验证）

- Core outbox 修复 `__proto__` payload、duplicate/malformed persisted metadata、reentrant subscriber ordering 与 storage-save-after-resolve bookkeeping；pagination、ResourceController、query parser、path、table export、column、i18n、nav、date/responsive utilities 完成对应的 malformed input、ownership、cycle、finite-value 与 lifecycle fail-closed hardening。
- 保留 legacy closure/in-memory outbox、pagination omitted-mode append、现有 query grammar、path/date/local-time、export byte compatibility、Grid/adapter ownership 与 framework-free/SSR 语义；未引入 cursor pagination、授权或宽泛重构。
- 最近验证：outbox focused **39**、pagination **28**、resource/DataSource **79**、query-parser **49**、path **71**、table-export **37**、columns/column-type **36**、i18n **25**、nav **40**、date/responsive **35**（DST **17**）；Core full **142 files / 2,079 tests**，typecheck/build/lint、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过（仅既有 warnings）。
- Grid clipboard source ratchet split 后 `grid-clipboard.ts` **401** 行、helper **117** 行，public exports/behavior unchanged；未修改 adapters、manifest/llms、arch baseline 或禁止目录。

## 2026-09-06 Grid/Core form, plugin, and controller hardening（当前工作树，已验证）

- Form Core 收口验证/提交的 reentrant lifecycle、snapshot ownership、prototype-sensitive fields、nested array planning、draft hydrate/serialize 与 fractional index/step；Undo stack 归一化 history limit，plugin runtime 修复 lazy/eager last-wins、partial install cleanup、duplicate dependency ordering 与 registry prototype safety。
- Grid Core 收口 rows transaction reentrancy/ownership、NaN key 与 index normalization、tree removal fail-closed、column-state no-op/width/pin validation、pagination no-op/disposal；layout/span/responsive 边界保持 framework-free。
- 最近验证：form focused **180**、undo/event-bus **39**、plugin **76**、Grid columns **13**、Grid pagination **22**、Grid rows/tree **64**；Core full **145 files / 2,131 tests**，typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过（仅既有 warnings）。未改 adapters、manifest/llms、arch baseline 或禁止目录。

## 2026-09-06 Grid Core row-edit adapter identity hardening（当前工作树，定向已验证）

- Same-ID row-edit begin/switch previously reused adapter session projections, allowing a stale old-editor callback to commit or cancel a newly opened session; this was reproduced in Solid. Successful begin/switch now resets row-session projections across React/Vue/Solid/Svelte, and stale cancel callbacks perform identity checks before acting.
- Files touched: `packages/react/src/primitives/table/table-row-edit.tsx`, `packages/react/src/primitives/table/Table.tsx`, `packages/vue/src/primitives/table/table-row-edit.ts`, `packages/vue/src/primitives/table/table-edit-renderers.ts`, `packages/solid/src/primitives/table/table-row-edit.tsx`, `packages/solid/src/primitives/table/table-edit-renderers.tsx`, `packages/solid/src/primitives/table/table-row-edit.test.tsx`, `packages/svelte/src/primitives/table/table-row-edit.svelte.ts`, `packages/svelte/src/primitives/table/TableBodyRow.svelte`.
- No Core source changes, no public API or keyless-tree identity changes.
- Validation: Core row-edit tests **22**; React **13**; Vue **9**; Solid **14**; Svelte **9**; all four adapter typechecks; targeted Prettier; framework-free Core import guard; `git diff --check` passed. This slice does not claim full adapter reruns.
- The workspace had extensive pre-existing unrelated changes; they are not attributed to this slice.

## 2026-09-07 Grid Core table views/group hardening（当前工作树，定向已验证）

- `packages/core/src/table-group.ts` 现在会在同一个 row object 多次出现时保留彼此不同的 source indexes；`packages/core/src/table-group.test.ts` 新增对应 regression。
- `packages/core/src/table-views.ts` 现在将显式 `fallback: null` 视为关闭 ambient storage，并将 `storage: false` 视为跳过 lookup；`packages/core/src/table-views.test.ts` 新增 persistence-boundary coverage。
- 未修改 adapter source、public API 或 keyless-tree identity semantics。
- 验证：Core build passed；Core focused tests **52 passed**；React **79**、Vue **17**、Solid **11**、Svelte **11** focused checks passed；四个适配器 typechecks passed；targeted Prettier、framework-free import guard 与 `git diff --check` passed。
- Full repository/E2E gates 与 full adapter suites 未运行。

## 2026-09-07 Grid Core virtual-scroll bridge hardening（当前工作树，定向已验证）

- Solid/Vue/Svelte fixed-window bridges now consume Core virtualizer state, so partial-scroll visibility matches Core. All four adapters pass fixed-size mode to Core and remeasure on fixed-size handoff.
- React/Solid/Vue re-seat keyed measurements when data arrays change. Focused partial-boundary regressions were added across all four adapters; the React table expectation was updated for the already-fixed Core boundary behavior.
- Reproduced defect: Solid with `scrollTop=10`, row/viewport height `20`, and `buffer=0` rendered one row instead of two.
- No new Core source changes in this slice; no public API or keyless-tree identity changes.
- Validation: Core virtualizer/grid tests **41 passed**; focused adapter/table tests passed; React/Vue/Solid/Svelte typechecks passed; SSR/hydration tests passed; targeted ESLint/Prettier, framework-free Core import guard, and `git diff --check` passed.
- Full monorepo gates and full adapter suites were not run.
- 本条仅记录 fixed-window slice；auto measurement 的 index-keyed stale-height follow-up 见后续独立条目。

## 2026-09-06 Iris Core profile hardening（当前工作树，已验证）

- Profile Core 对 hostile getter/proxy、malformed storage/raw state、prototype-sensitive keys、深层 snapshot/存储 ownership、no-op mutation、localStorage 异常、HTTP failed PUT、headers 隔离、async save serialization 做 fail-closed hardening。
- 本条 runtime hardening 仅涉及 `packages/core/src/profile.ts` 与 `packages/core/src/profile.test.ts`；后续 `profile-helpers.ts` 拆分属于 ratchet-only decomposition。Profile focused **18**、Core full **145 files / 2,138 tests**、typecheck/lint（**0 errors**，仅既有 complexity warnings）、Prettier、framework-free import guard、`git diff --check` 通过。未宣称 build/整仓门禁。
- 兼容 API 的 `profile.store` 仍暴露 raw mutable Store；函数值自有属性不深拷贝，hydrate 竞态契约未改变。

## 2026-09-06 Grid Core table group/view hardening（当前工作树，定向已验证）

- `buildTableGroupPlan` 修复同一 row object 重复出现时 source index 被 Map 覆盖；`table-views` 让显式 `fallback: null`/`storage: false` 不触碰 ambient localStorage。
- 仅修改 `packages/core/src/table-group.ts`、`packages/core/src/table-group.test.ts`、`packages/core/src/table-views.ts`、`packages/core/src/table-views.test.ts`，不改 adapter；验证 Core build、group/view focused **52**、React **79**、Vue **17**、Solid **11**、Svelte **11**、四端 typecheck、targeted Prettier、framework-free import guard、`git diff --check` 通过。未运行 full repository/E2E。

## 2026-09-07 Grid Core pagination bridge hardening（当前工作树，定向已验证）

- 复现 Solid controlled page handoff defect：page 从 **1→2** 后 Core model 仍停在 **1**；`packages/solid/src/grid/index.ts` 现以响应式方式同步 controlled page，并加入 regression coverage。
- `packages/svelte/src/grid/useGrid.ts` 现使用 sync helper，并以 focused harness/tests 覆盖 controlled synchronization。
- `packages/core/src/grid-pagination.ts` 增加 safe-integer normalization；`setPageSize` 遇 invalid/equivalent 输入时保留当前 page 并成为 true no-op，`grid-pagination.test.ts` 新增对应 coverage。React/Vue 不需要 source changes。
- 不引入 page-to-total clamping；现有 public tests 明确允许超出 total 的 page。未修改 remote-table、data-source、outbox、query-cache 或 keyless-tree identity。
- 验证：Core build passed；Core focused tests **40**；React **35**；Vue **22**；Solid relevant tests **10**；Svelte relevant tests 与 typecheck passed；四个 adapter typechecks、targeted Prettier、framework-free import guard 与 `git diff --check` passed。Full adapter/monorepo suites 未重跑。

## 2026-09-06 Iris Core machine hardening（当前工作树，已验证）

这是一次窄范围 machine 审计；本条 runtime hardening 仅涉及 `packages/core/src/machine.ts` 与 `packages/core/src/machine.test.ts`：修复一层 compound state 的 child→child transition 丢失 parent handler/entry/exit/after、child target 与 top-level target 混淆、timer scope/cancellation/stale callback/invalid delay、entry action reentrant send 未排队，以及 stop 后仍调度新 timer 的问题。后续 `machine.test-support.ts` 与 `machine.reentrancy.test.ts` 拆分属于 ratchet-only decomposition。

验证：machine focused **24/24**；该批 agent 完成时 Core full **145 files / 2,145 tests**，随后全量本地验证为 **145 files / 2,146 tests**；Core build、typecheck、lint **0 errors**（仅 complexity warnings）、targeted Prettier、framework-free import guard 与 `git diff --check` 通过。本批未覆盖异常 callback 回滚、context 深拷贝、超过一层嵌套、parallel/actors；未修改 adapters、API、keyless-tree 或禁止路径，不宣称整仓或四框架 full gate。

## 2026-09-07 Iris Core keymap hardening（当前工作树，已验证）

这是一次窄范围 Core 审计，仅修改 `packages/core/src/keymap.ts` 与 `packages/core/src/keymap.test.ts`：malformed runtime input fail-closed；`normalizeKeymap` 忽略 inherited override keys；拒绝空 `+` segment，同时保留带空格的合法 `Ctrl + Shift + Z`；`format`/`match` 对 malformed input 做保护。Cmd/Meta/Option 同义词、重复同义 modifier、default alias replacement、exact modifier matching、case/space normalization 与 SSR/no-op 语义保持不变。

验证：keymap focused **22**；Core full（agent evidence）**145 files / 2,150 tests**，随后本地 Core 受其他已落盘 Core slices 影响为 **145 files / 2,146 tests**；Core typecheck、lint **0 errors / 20 complexity warnings**、targeted Prettier、framework-free import guard 与 `git diff --check` 通过。未覆盖 hostile Proxy/accessor getter；未修改 adapter、public API 或禁止路径，不宣称整仓或四框架 full gate。

## 2026-09-07 Grid Core arch-ratchet decomposition follow-up（当前工作树，已验证）

- 本轮仅做 arch ratchet decomposition：`packages/core/src/profile.ts` **378** 行 + 新 `packages/core/src/profile-helpers.ts` **164** 行；`packages/core/src/machine.test.ts` **434** 行 + `packages/core/src/machine.test-support.ts` **41** 行 + `packages/core/src/machine.reentrancy.test.ts` **53** 行；React `packages/react/src/primitives/table/table-row-edit.tsx` **349** 行 + 新 `packages/react/src/primitives/table/table-row-edit-projection.ts` **160** 行。
- `pnpm arch-check:ratchet` 无 blockers；Core/React focused 验证、typecheck/build、targeted Prettier、framework-free guard 与 `git diff --check` passed。public API/behavior unchanged，`scripts/arch-baseline.json` 未改。

## 2026-09-07 Grid Core window hardening（当前工作树，定向已验证）

- 涉及 `packages/core/src/window/{geometry,manager,session}.ts` 与 `packages/core/src/window.test.ts`。
- 对 malformed/non-finite/null/throwing geometry、workspace/focus/z reentrancy、session geometry ownership 做 fail-closed hardening。
- Window focused **36**；Core typecheck/build、targeted Prettier、framework-free guard 与 `git diff --check` passed；无 tracked dist。

## 2026-09-07 Grid Core virtual auto-measurement bridge follow-up（当前工作树，定向已验证）

- 涉及 React/Vue/Solid/Svelte virtual-scroll sources/tests；已复现 auto measurement 的 index-keyed stale height 污染 keyed reorder，现由 Core `virtualizer.measure` keyed cache 接管，`estimate` 仅作为 configured fallback。
- Focused：React **16**、Vue **12**、Solid **6**、Svelte **12**；四端 typecheck、targeted Prettier、framework-free guard 与 `git diff --check` passed。
- 本 follow-up 没有 Core source change；不宣称 full adapter/monorepo gate。

## 2026-09-07 React Grid visibility snapshot hardening（当前工作树，定向已验证）

- `packages/react/src/grid/useGridColumns.ts` now clones controlled visibility into the returned state snapshot, preventing a caller mutation of the controlled map from mutating a previously returned snapshot; `packages/react/src/grid/useGridColumns.test.tsx` adds the regression.
- Existing width/order/pinned handoff, rejected-proposal, silent-sync, callback, and SSR paths were rechecked with no further changes.
- No Core source, public API, or keyless-tree identity semantics changed. No other files changed by this slice; full adapter reruns are not claimed.
- Validation: focused React tests **8 passed**; React typecheck; targeted Prettier; `git diff --check` passed.

## 2026-09-07 Grid Core selection/expansion adapter-boundary hardening（当前工作树，定向已验证）

- Reproduced a React controlled selection handoff defect: after a rejected toggle, controlled → uncontrolled exposed the rejected `[a,b]` proposal instead of the prior uncontrolled snapshot.
- React selection now handles controlled handoff, SameValueZero comparison, and immutable snapshots; React expansion snapshots are immutable. Vue/Solid/Svelte added selection handoff parity and selection/expansion snapshot copying.
- Files touched: `packages/react/src/grid/useGridSelection.ts`, `packages/react/src/grid/useGridExpansion.ts`, `packages/react/src/grid/useGridCore.test.tsx`, `packages/vue/src/grid/index.ts`, `packages/solid/src/grid/index.ts`, `packages/solid/src/primitives/table/IrisTable.tsx`, `packages/svelte/src/grid/useGrid.ts`, `packages/svelte/src/useStore.ts`, `packages/svelte/src/primitives/table/IrisTable.svelte`.
- No Core source, public API, or keyless-tree identity semantics changed.
- Validation: Core focused **55**; React **94**; Vue **81**; Solid **59**; Svelte **51**; all four adapter typechecks; targeted ESLint/Prettier; Core framework-free import guard; `git diff --check` passed.
- Full monorepo gates and full adapter suites were not run.

## 2026-09-07 Grid Core clipboard malformed-input hardening（当前工作树，定向已验证）

- `packages/core/src/grid-clipboard.ts` now runtime-guards paste text so `GridClipboardModel.paste(null)` fails closed instead of throwing; `packages/core/src/grid-clipboard-malformed.test.ts` adds the regression.
- No adapter source, public API, or keyless-tree identity semantics changed.
- Validation: Core build/typecheck passed; focused clipboard tests **23 passed**; React hook **2 passed**; Vue **22 passed**; Solid **10 passed**; Svelte **22 passed**; Vue/Solid/Svelte SSR formula checks passed; all four adapter typechecks passed; targeted Prettier/ESLint passed; framework-free Core import guard passed; and `git diff --check` passed.
- The React grid-clipboard integration suite remains an existing dirty-worktree **6/6 timeout** before and after this slice, and was not modified. Full adapter/monorepo gates were not run.

## 2026-09-07 Grid Core four-adapter column bridge snapshot audit（当前工作树，定向已验证）

- The audit reproduced three adapter-boundary defects: React controlled order/width/pinned snapshots previously aliased caller inputs; Vue/Solid/Svelte store snapshots aliased Core state; and Vue/Solid/Svelte order/width/pinned handoff retained rejected controlled values.
- The minimal adapter fix clones React controlled snapshots, copies Vue/Solid/Svelte store snapshots, and synchronizes independent uncontrolled snapshots across all four adapters' order/width/pinned channels. No Core/public API/keyless-tree identity changes.
- Files in scope: `packages/react/src/grid/useGridColumns.ts` + `packages/react/src/grid/useGridColumns.test.tsx`; `packages/vue/src/grid/index.ts` + `packages/vue/src/grid/index.test.ts`; `packages/solid/src/grid/index.ts` + `packages/solid/src/grid/index.test.tsx`; `packages/svelte/src/grid/useGrid.ts`, `packages/svelte/src/grid/syncGridColumns.svelte.ts`, `packages/svelte/src/grid/GridColumnsBridgeHarness.svelte` + `packages/svelte/src/grid/index.test.ts`.
- Validation: all four adapter typechecks; adapter grid tests React **36**, Vue **9**, Solid **11**, Svelte **27**; focused table tests React **96**, Vue **18**, Solid **5**, Svelte **15**; no remaining defect in scope. Full adapter/monorepo gates were not run.

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
