# Grid Core + Feature 重构设计

> 状态：Phase 0–4 已实现并完成最终验证（2026-08-31，含最新 adversarial pass 的 Grid closure）。本文是后续 Grid 重构的真相源；
> `docs/vxe-grid-comparison.md` 继续记录功能覆盖，不再作为架构设计文档。

2026-08-28：Solid `columnPinMenu` parity gate accepted；静态列 pin 的 live fallback regression 已补测；Solid client **157 files / 1,111 tests**、SSR **7 files / 49 tests**，typecheck/lint/build、spec audit（**1,589 files / 0 violations**）、`pnpm check:manifest`、`git diff --check` 均通过，`scripts/arch-baseline.json` 未改。`arch-check:ratchet` 的阻断项仍为 baseline 已豁免的 6 个 React/Vue/Solid/Svelte 表文件，未调整 baseline。
2026-08-28：Vue `columnPinMenu` parity gate accepted；修复 default-off 替换 `columns` 后 static pin fallback 过期，并使已打开菜单跟随 live i18n；focused **14/14**、全量 **188 files / 1,701 tests**、typecheck/build、lint 0 errors（1 条既有 complexity warning）、spec audit **1,895 files / 0 violations**、manifest **155×4 / 86 tokens** 与 `git diff --check` 通过；`scripts/arch-baseline.json` 未改。`arch-check:ratchet` 仍因六个既有 oversized table 文件报红，未调整 baseline。
2026-08-28：Vue `searchHighlight` parity gate accepted；focused **12/12**、全量 **190 files / 1,713 tests**（含 SSR **11 files / 20 tests**）、typecheck/build、lint 0 errors（1 条既有 complexity warning）、spec audit **1,590 files / 0 violations**、manifest **155×4 / 86 tokens** 与 `git diff --check` 通过；`scripts/arch-baseline.json` 未改。`arch-check:ratchet` 仍因 6 个既有 oversized table 文件报红，未调整 baseline。
2026-08-28：Vue `recentFilters` parity gate accepted；review PASS，无阻塞项；全量 **192 files / 1,721 tests**（SSR **12 files / 21 tests**）、typecheck/build、lint 0 errors（1 条既有 complexity warning）、spec audit **1,592 files / 0 violations**、`pnpm check:manifest`（**155×4 / 86 tokens**）与 `git diff --check` 通过；`scripts/arch-baseline.json` 未改。`arch-check:ratchet` 仍命中 6 个既有 oversized table 文件，未调整 baseline。

## 1. 为什么现在必须重构

Iris Table 已完成 vxe-grid 主要功能覆盖，但当前实现仍以“继续增加 prop + 在组件内接线”为主：

| 适配器 | 主文件行数（2026-08-22） |
| ------ | -----------------------: |
| React  |                   10,232 |
| Vue    |                    2,674 |
| Solid  |                    2,339 |
| Svelte |                    1,613 |

类型层已经按 layout/editing/query/advanced 拆分，但运行时仍然是单体。结果是：

- 不使用审计、公式、导入导出等能力的应用仍经过相关接线代码；
- 新能力需要同时修改 props、state、事件、handle、UI 与生命周期，遗漏面扩大；
- React 先实现、其他框架逐项追赶，容易把“同一能力”复制成四套；
- props 数量不再能表达能力边界，文档和 AI 生成也难以选择最小功能集。

本轮目标不是再造一个复杂框架，而是增加一个很小的实例级能力宿主，让现有 core
控制器能被组合起来。

## 2. 开源项目取舍

### TanStack Table：采用 feature 对象和实例 API

[TanStack Table Custom Features](https://tanstack.com/table/latest/docs/framework/react/guide/custom-features)
把每种能力拆成独立 feature，由 feature 提供初始状态、默认选项和实例 API。值得采用的是：

- 一个能力的状态、配置和 API 放在一起；
- feature 按表实例组合，不需要修改核心对象；
- 未选择的 feature 可被 tree-shaking。

Iris 不复制其 prototype/row/cell 多层扩展点。四框架适配器目前最需要的是表实例级能力，
先只支持这一层。

### AG Grid：采用显式 module 列表，不采用全局注册

[AG Grid Modules](https://www.ag-grid.com/angular-data-grid/modules/) 同时支持全局注册和
单个 Grid 传入 modules。Iris 只采用后者：

```ts
createGridCore({ features: [selection, sorting, exportCsv] })
```

不增加全局 `ModuleRegistry`。全局可变注册会增加 SSR、测试隔离、多版本共存和摇树困难。

### vxe-table：采用方法按能力归属，不采用运行时复制方法

[vxe-table 源码](https://github.com/x-extends/vxe-table/blob/master/packages/table/src/table.ts)
和官方插件展示了模块向 Table/Grid 扩展方法的思路；其公开 API 也按 selection、edit、filter、
export 等能力形成方法族。Iris 保留这种用户熟悉的方法语义，但不复制 methods 对象或
monkey-patch 组件实例。每个 feature 在自己的 Grid Core 实例上注册方法。

## 3. 最小模型

实现入口：

- `@iris-ui-kit/core/grid`
- `createGridCore`
- `createGridFeature`
- `createGridSelectionFeature`（首个真实能力）

```ts
import {
  createGridCore,
  createGridFeature,
  createGridSelectionFeature,
} from '@iris-ui-kit/core/grid'

const exportFeature = createGridFeature({
  name: 'export',
  dependsOn: ['selection'],
  setup(ctx) {
    return {
      methods: {
        exportSelected: () => {
          const getSelection = ctx.getMethod<() => Array<string | number>>('getSelection')
          return getSelection?.() ?? []
        },
      },
      onReady() {
        // DOM 已由适配器挂载；只有这里可以做 DOM 相关接线
      },
      dispose() {
        // 清理 timer / observer / 外部资源
      },
    }
  },
})

const grid = createGridCore({
  features: [createGridSelectionFeature({ getKeys: () => [1, 2, 3] }), exportFeature],
})

grid.on('selection:change', ({ selectedKeys }) => console.log(selectedKeys))
grid.ready()
grid.invoke('toggleRowSelection', 2)
grid.destroy()
```

### 生命周期

只保留三个跨框架阶段：

| 阶段      | 触发点                            | 允许事项                                  |
| --------- | --------------------------------- | ----------------------------------------- |
| `setup`   | Grid Core 加载 feature            | 创建 controller、注册方法、订阅实例事件   |
| `onReady` | React/Vue/Solid/Svelte DOM 挂载后 | DOM observer、floating anchor、快捷键接线 |
| `dispose` | 适配器卸载 Grid                   | 清理资源；按 feature 逆序执行             |

不引入 `created/beforeMount/mounted/activated/deactivated/beforeDestroy/destroyed`
七套同义钩子。框架自己的生命周期留在薄桥，Grid feature 只看跨框架语义。

### 依赖与冲突

- 构造参数中的 feature 会按 `dependsOn` 做稳定拓扑排序；
- 缺失依赖、循环依赖、重复 feature 名和重复 method 名直接抛错；
- `ready()`、`destroy()` 幂等；
- ready 后仍可 `use(feature)`，该 feature 的 `onReady` 会立即执行；
- Phase 0 不支持 `unuse` 或热替换，避免先引入动态卸载复杂度。

## 4. props、事件、方法怎样组合

结论：**归属跟随 feature，机制由 core 独立提供。**

一个 feature 可以同时拥有配置、controller、方法、事件和生命周期；也可以只实现其中一类：

- method-only：CSV 序列化、状态导出；
- event-only：埋点、审计观察器；
- lifecycle-only：ResizeObserver、快捷键作用域；
- 完整能力：编辑、选择、代理数据源。

这比把 method plugin、event plugin、lifecycle plugin 再拆成三套注册系统更简单。它们共享同一个
`GridFeature.setup(ctx)`，但可通过空字段独立组合。

### props 规则

保留真正属于 Grid 壳的少量顶层 props：

```ts
;(data, columns, rowKey, loading, disabled, invalid, error, className, style)
```

其余配置逐步进入 feature factory：

```tsx
<IrisGrid
  data={rows}
  columns={columns}
  features={[
    gridSelection({ mode: 'multiple', onChange: setSelection }),
    gridEditing({ mode: 'cell', trigger: 'dblclick' }),
    gridExportCsv({ filename: 'users.csv' }),
  ]}
/>
```

不再继续增加 `selectionConfig/editConfig/exportConfig/...` 巨型嵌套对象；factory 本身就是配置边界，
也能自然按包导入。

### 事件规则

- 行点击、编辑提交等“业务处理回调”放在 feature options，类型最清晰；
- 日志、联动、调试等“观察事件”走 Grid Core 实例事件总线；
- feature 内通过 `ctx.on()` 订阅，Core 自动在销毁时取消；
- 事件不会替代行为，也不允许监听器 monkey-patch 其他 feature。

### 方法规则

- 方法由拥有行为的 feature 注册，例如 selection 提供 `getSelection/clearSelection/selectAll`；
- 适配器的 legacy `IrisTableHandle` 逐步改为委托这些方法，旧 API 不立即破坏；
- 新 API 用 `hasMethod/getMethod/invoke` 做能力探测；
- 未加载 feature 时对应方法不存在，不放置几十个空实现。

## 5. 能力分层

### Kernel：永远存在，零业务 prop

- feature 排序与安装；
- 实例事件总线；
- method registry；
- `setup → ready → dispose` 生命周期；
- 冲突检查与逆序清理。

### A：标准 Grid 能力，适配器默认 preset 加载

| Feature    | 现有 core 复用点                       | 主要方法族                        |
| ---------- | -------------------------------------- | --------------------------------- |
| rows       | table-rows / data-view                 | getData/loadData/insert/remove    |
| columns    | columns / column-state（Phase 1）      | visibility/order/width/pin        |
| selection  | createSelectionModel（Phase 0 已实现） | get/clear/selectAll/toggle        |
| sorting    | data-view / compareValues（Phase 1）   | sort/clearSort/getSort            |
| filtering  | data-view / recent-filters（Phase 1）  | setFilter/clearFilter             |
| expansion  | createExpansion（Phase 1 已实现）      | toggle/expandAll/collapseAll      |
| pagination | pagination（Phase 1）                  | setPage/setPageSize/getPagination |
| virtual    | virtual / virtualizer                  | scrollToRow/scrollToIndex/measure |

`IrisGrid` 默认 preset 保持“一个组件即可起步”；低阶 `createGridCore()` 仍允许空 host，供插件和测试按需组合。

### B：可选、可摇树能力

| 能力组             | 建议落点                                             |
| ------------------ | ---------------------------------------------------- |
| editing/validation | `core/grid` feature（Phase 3），适配器提供 editor UI |
| range/clipboard    | `core/grid` feature（Phase 3），按需导入             |
| proxy/query        | `plugin-pro-table/core`                              |
| CSV/Excel/import   | 独立 export feature；Excel 留插件                    |
| persistence/views  | 独立 state feature                                   |
| audit/history/undo | 独立 feature，可组合依赖 editing/rows                |
| formula            | 独立 feature；跨表与编辑都通过 methods/events        |
| chart/perf         | `plugin-charts` / diagnostics feature                |
| collaboration      | 外部插件，Grid Core 只承载事件与展示状态             |

### C：纯函数材料

`compareValues`、CSV 序列化、公式求值、range stats、virtual range 等继续保留为普通 core 导出，
不强迫纯函数包装成 feature。

## 6. npm 插件与 Grid feature 的关系

两者不是同一个层级：

- `IrisPlugin`：Provider 级，注册 tokens/messages/store；
- `GridFeature`：单个 Grid 实例级，注册 grid state/method/event/lifecycle。

一个重型 npm 插件可以同时导出二者：

```ts
export const editorPlugin = createPlugin(/* provider tokens/messages */)
export const gridEditor = (options) => createGridFeature(/* per-grid capability */)
```

因此 Provider 不会自动让页面中每个 Grid 都承担编辑器成本；消费方仍显式把 `gridEditor()` 放入目标
Grid 的 `features`。

## 7. 迁移路线

### Phase 0 — capability host（已完成）

- [x] `createGridCore/createGridFeature`；
- [x] 实例事件、方法、生命周期与依赖排序；
- [x] 首个 `createGridSelectionFeature`；
- [x] `@iris-ui-kit/core/grid` 子路径；
- [x] 契约测试覆盖顺序、冲突、事件、ready/dispose、selection。

### Phase 1 — 单框架打透

- [x] 增加 React `useGridCore` 薄桥（含 StrictMode effect replay 守卫）；
- [x] selection 委托 `createGridSelectionFeature`，公开 props/handle/DOM 不变；
- [x] expansion 委托 `createGridExpansionFeature`，与 selection 组合在同一 Grid Core；
- [x] sorting 委托 `createGridSortingFeature`，单列/多列共用一个状态模型；
- [x] filtering 委托 `createGridFilteringFeature`，文本/checked values 共用状态模型；
- [x] rows 委托 `createGridRowsFeature`，统一 commit/transact/sync 事务入口；
- [x] pagination 委托 `createGridPaginationFeature`，proxy 请求生命周期留在适配器；
- [x] columns 委托 `createGridColumnsFeature`，四个状态通道共用一个 model；
- [x] virtual 委托 `createGridVirtualFeature`，窗口、测量缓存和滚动方法共用一个 controller；
- [x] legacy props → feature options 使用七组纯转换器；
- [x] React 门禁、SSR、axe、现有 vxe parity 已通过；React bridge 已稳定后扩展其余框架。

Phase 1 selection 切片实测：React 新增 `@iris-ui-kit/react/grid` 子路径和
`useGridCore/useGridSelection`；`Table.tsx` 不再直接 import/创建 `SelectionModel`，由 feature
拥有 controller，React 仅桥接 store 和受控 prop。主文件 10,232 → 10,207 行（净减 25）；原有
selection props、handle 和 DOM 契约保持不变。

Phase 1 expansion 切片继续复用同一个 `useGridCore()` 实例：
`useGridSelection(core, options)` 与 `useGridExpansion(core, options)` 各自安装 feature，但不创建第二个
core。`createGridExpansionFeature` 随能力一起提供 controller、methods 和 `expansion:change` 事件；
Table 不再直接创建 `ExpansionModel`。两个切片合计使主文件 10,232 → 10,200 行（净减 32）。

Phase 1 sorting 切片把原 React-only `useTableSort` 的状态所有权下沉为
`createGridSortingFeature`：三态单列排序、多列点击顺序、clear、受控静默同步、methods 和
`sorting:change` 事件都由 core 提供。React `useGridSorting(core, data, options)` 只保留列比较器、公式值
和 memo 派生；Table 的远程排序、查询排序、props/handle/DOM 契约不变。三个切片累计使主文件
10,232 → 10,198 行（净减 34）。

Phase 1 filtering 切片由 `createGridFilteringFeature` 承载 text filters、checked values、methods 与
`filtering:change` 事件；`useGridFiltering(core, data, options)` 负责 form/query/rules/remoteFilter 的行视图
派生。FilterPanel apply/clear 和 handle `clearFilter()` 都通过同一 model；旧 props、专用回调和统一 Table
事件顺序不变。四个切片累计使主文件 10,232 → 10,133 行（净减 99）。

Phase 1 rows 切片提供唯一的行数据 store 和三类入口：用户写入走 `commit/transact`，依次执行事务前置观察、
store 更新、后置回调与 `rows:change`；受控 props/proxy 刷新走静默 `sync`。事务 `meta` 由适配器拥有，core
仅透传，不耦合 undo/audit/history。React Table 的批量操作和单元格编辑都进入同一个 model：前者保留
version history 与 `onDataChange`，后者保持原有“不创建 row version、不触发 onDataChange”语义；两者继续
共用 undo/audit，并保留自定义 `rowId` 写回。
五个切片累计使主文件 10,232 → 10,109 行（净减 123）。五个 React bridge 的安装样板统一复用内部
`useGridFeature`，每个能力只声明 feature factory 与 model method，不重复实现生命周期。

Legacy Table API 通过 `toGridRowsOptions/toGridSelectionOptions/toGridExpansionOptions/
toGridSortingOptions/toGridFilteringOptions/toGridPaginationOptions/toGridColumnsOptions` 七个纯函数映射为 feature options。转换器只负责重命名、默认值、
mode 和引用策略；统一事件、proxy、undo/audit/history 等副作用仍由 Table 以回调注入。映射函数无 React
生命周期依赖，可独立测试，也可供自定义 Grid preset 复用；接入后 `IrisTable` 圈复杂度 369 → 364。

Phase 1 pagination 切片由 `createGridPaginationFeature` 统一拥有 page/pageSize/total 状态、
`setPage/setPageSize/setPagination/getPageCount` methods 和 `pagination:change` 事件；pageSize 变化重置到第 1 页，
受控 proxy 状态通过 `useGridPagination` 静默同步。网络请求、首次查询前的 URL/persistState 恢复以及
`proxyConfig.onPageChange` 仍由 `useTablePagination` 薄桥编排，feature 不依赖 remote source。Pager UI 不再直接
调用 `proxy.setParams`；完整 React 测试 3,025 项保持通过。六个切片累计使主文件 10,232 → 10,117 行
（净减 115），新增运行时代码按能力落在 core/bridge，而非继续堆入 Table。

Phase 1 columns 切片将 visibility/order/widths/pinned 四个通道统一放入
`createGridColumnsFeature`，随能力提供分通道 methods、受控静默 `sync` 和 `columns:change` 事件。
React `useGridColumns` 保留各通道独立的受控/非受控策略：legacy visibility/order 固定为纯受控，确保
`columnOrder` 从有值回到 `undefined` 时立即恢复源码顺序；widths/pinned 继续双模，显式 `null` pin 仍覆盖
静态列声明。`useTableColumns` 只派生 preset、列树、响应式 fit 和 header matrix，不再创建宽度/固定状态；
列设置面板、resize、pin menu、固定边界拖拽、persist/views/import 都委托同一 feature。七个切片累计使
主文件 10,232 → 10,148 行（净减 84），列布局 helper 同时减少 26 行；完整 React 测试 3,028 项保持通过。

Phase 1 virtual 切片将现有 `createVirtualizer` 包装为实例级 `createGridVirtualFeature`，统一拥有 count、viewport、
overscan、测量缓存、`scrollToIndex/scrollToOffset/measure/remeasure` 方法和 `virtual:range-change` 事件。
`IrisVirtualScroll` 可接收 feature-owned controller；Table 使用该入口时不再创建第二份窗口状态，同时保留独立使用
`IrisVirtualScroll` 时的内部 controller fallback。legacy `scrollToRow` 对未挂载的虚拟行先通过 plan key 定位 index，
再委托 viewport bridge，未知 key 继续无操作。

### Phase 2 — 四框架薄桥（已实现）

四个适配器现在均提供 `@iris-ui-kit/<framework>/grid` 子路径，并桥接同一组 core feature：
`useGridCore`、rows、columns、selection、expansion、sorting、filtering、pagination、virtual。
Vue 使用 `ref + subscribe`，Solid 使用 `createSignal`，Svelte 使用 `toStore`；生命周期分别映射到
`onMounted/onBeforeUnmount`、`onMount/onCleanup`、`onMount/onDestroy`。桥接层只负责实例安装、快照订阅和
回调转发，controller、method、event 仍只存在于 `@iris-ui-kit/core/grid`。

同名入口和 package exports 已补齐：
`@iris-ui-kit/react/grid`、`@iris-ui-kit/vue/grid`、`@iris-ui-kit/solid/grid`、
`@iris-ui-kit/svelte/grid`。四端 Table 的 selection/expansion 已切换到同一 Grid Core 实例，
并保留 legacy props、事件和 handle。四端 typecheck/build 已验证，core grid 与 virtualizer contracts 通过；
既有 DOM `tableSelect/tableSort/tableExpand/tableCellEdit` ContractScenario 继续作为适配器行为门禁；新增
`packages/{vue,solid,svelte}/src/grid/index.test.*` 与既有 React grid tests 作为四端桥接 smoke contract。
virtual smoke 同时断言四端共享 controller 的 total-size snapshot；React Table 的窗口、tree/detail、键盘分页、
展开锚定和 off-window `scrollToRow` 继续由既有 DOM 契约覆盖。

### Phase 3 — 重型能力搬迁（第一批已实现）

`@iris-ui-kit/plugin-pro-table/core` 新增可选的 GridFeature：
`createGridExportFeature`（CSV/JSON/SpreadsheetML/HTML）、`createGridPersistenceFeature`（注入 storage，
SSR 安全、失败 fail-inert）、`createGridHistoryFeature`（rows 依赖、undo/redo）
、`createGridAuditFeature`（基于 `diffRows` 的有界审计）和 `createGridFormulaFeature`（复用 core memoized evaluator）。
每个 feature 将自己的 methods、events、依赖和清理放在同一模块，不把浏览器下载、storage 或 UI 渲染塞进 core。

第二批新增 `createGridViewsFeature`：复用 core `readTableViews/writeTableViews` 的存储格式与清洗规则，
feature-owned model 统一承载命名视图列表、active key、save/upsert/select/delete/reload/clear/sync methods 和
`views:change` 事件。snapshot 的采集与回放通过回调注入，标签和工具栏渲染仍属于框架适配器；存储拒绝或 quota
错误继续 fail-inert，`storage: false` 可作为纯内存模式使用。该能力拆在独立 `grid-views.ts`，未把主 feature 文件推近
架构行数上限。

第三批新增 `createGridQueryFeature`，显式依赖 rows/pagination/sorting/filtering：每次请求从四个标准 feature 取得不可变
query snapshot，通过注入 fetcher 执行远程读取，并以 silent `syncRows/syncPagination` 回写，避免把服务器刷新记录成
编辑事务。feature-owned model 提供 idle/loading/success/error 状态、`loadGridData/reloadGridData/cancelGridQuery`
methods、`query:change` 事件和可选 ready-immediate；AbortController 与 request epoch 同时保证取消和“后发请求优先”，
即使旧 fetcher 忽略 signal 并延迟成功，也不能覆盖新 rows。dispose 只中止资源，不在销毁期发业务事件。

第四批将标准 editing/validation 能力落入 `@iris-ui-kit/core/grid`：`createGridEditingFeature` 显式依赖 rows，复用
`createCellEdit` 与 `validateEditRulesAsync`，由 feature-owned model 统一提供 edit session、draft/error/validated 状态、
`startCellEdit/setCellDraft/commitCellEdit/cancelCellEdit` methods，以及 `editing:change/editing:commit` 事件。提交只通过
rows 的 `setRows({ reason: 'cell-edit' })` 事务入口写回；无变化提交不产生 rows/commit 事件。行键同时支持 string/number，
规则校验可使用当前 rows 执行 unique 检查，值转换和自定义校验保持可注入；取消、切换会话或 dispose 会使进行中的异步
校验失效，不能延迟回写。editor DOM、触发方式和焦点仍留在四框架适配器。

第五批新增 `createGridRangeFeature/createGridClipboardFeature`。range feature 复用 `createCellRange`，统一承载
anchor/active 状态、标准化矩形、methods 与 `range:change` 事件；clipboard 显式依赖 rows/range，通过注入的有效列快照
复用 `serializeTableRange`，提供 TSV/CSV/HTML 序列化和 `clipboard:change`。TSV paste 只从 range 读取目标：单格选择从
anchor 向现有表格边界流式写入，多格选择严格裁剪到矩形；锁定策略、字符串转值和自定义 setter 均由 options 注入，最终
只产生一次 `setRows({ reason: 'clipboard-paste' })` 事务，无变化不发事件。系统 clipboard I/O、快捷键、复制闪烁和浮动
工具栏仍属于适配器；overflow insert 依赖宿主的建行/主键策略，暂保留在 legacy adapter，后续通过显式 factory 注入迁移。

React 随后新增 `useGridRange` 薄桥，并把 IrisTable 原先直接持有的 `createCellRange()` controller 委托给与
rows/columns/selection 相同的 Grid Core 实例。React 只订阅 anchor/active snapshot，pointer capture、键盘扩选、toolbar
定位和 clipboard I/O 保持在适配器；主文件在不改变 DOM 契约的前提下 10,176 → 10,163 行。bridge identity/latest-callback
专项 2/2 与 React 全量 3,033/3,033 均通过。

第六批补齐 `useGridClipboard` React 薄桥，并把 IrisTable 的 TSV/CSV/HTML range 序列化与普通 bounded TSV paste 委托给
同一 Grid Core。clipboard feature 新增有效行投影、投影回写协调器、自定义值解析和 adapter transaction metadata 注入：
range 坐标继续对应排序/过滤/扁平树后的可见行，修改按原 row key 合回 rows feature 的原始行序；公式值无需物化进源行即可
参与复制，公式/locked/readonly 单元格继续拒绝粘贴。异步 Clipboard API、快捷键和成功闪烁仍属于适配器；`insertIfOverflow` 所需的建行/
主键策略通过后续显式 factory 注入，不进入 Core 默认路径。主文件按 arch-check 口径 10,163 → 10,075 行；bridge 2/2、排序投影/公式集成 3/3、clipboard 相关回归 121/121、
React 全量 3,038/3,038 均通过。

第七批新增 Vue `useGridRange` 薄桥，IrisTable 不再直接创建/订阅 `createCellRange()`，而是从与 selection/expansion
相同的实例级 Grid Core 取得 controller 与 `shallowRef` snapshot。Vue 的 cell pointer、Shift+方向键、range copy button、
公式值 materialization 和系统 clipboard I/O 继续留在 `table-keyboard.ts`，因此 DOM/快捷键契约未改变；bridge 2/2、
Table range/copy 定向回归 105/105、Vue 全量 1,602/1,602、typecheck/lint/build 均通过。主文件按 arch-check 口径
2,661 → 2,653 行，`vue/grid/index.ts` 只增加 re-export，bridge 实现拆在独立文件，未越过 500 行阈值。

第八批新增 Solid `useGridRange` 薄桥，以 `createSignal` store bridge 订阅 feature-owned controller，并用 memo 暴露标准化
矩形。IrisTable 从同一个 Grid Core 取得 range model；pointer、Shift+方向键、格式化 range copy 与系统 clipboard I/O 仍由
Solid 适配器接线。bridge 2/2、Table range/copy/formula/row-edit 定向回归 27/27、Solid 全量 1,031/1,031 + hydration
38/38、typecheck/lint/build 均通过；主文件按 arch-check 口径 2,338 → 2,324 行，低于既有 2,340 baseline。

第九批新增 Svelte `useGridRange` 薄桥，以 `toStore + derived` 暴露 feature-owned state 与标准化 range。IrisTable 删除本地
`$state + subscribe`，`table-keyboard.ts` 直接消费 bridge range，不再重复归一化矩形；未被调用的 legacy range helper 同步删除。
pointer、Shift+方向键、格式化 copy 和系统 clipboard I/O 保持 adapter-owned。bridge 1/1、Table range/copy/formula 定向回归
71/71、Svelte 全量 1,005/1,005 + hydration 35/35、svelte-check 0 error/0 warning、lint/build 均通过；主文件按 arch-check
口径 1,618 → 1,605 行。

第十批补齐 editing feature 的四框架反应式桥：`useGridEditing` 分别位于 React/Vue/Solid/Svelte 的
`grid` 子路径，统一订阅 `GridEditingModel`，并转发 `start/setDraft/cancel/commit/isEditing`。core 新增
`GridEditingValidation.commit` 标记和 `commitOptions` 透传：draft 输入校验与真正 commit 校验可以区分，单元格提交仍只经
`rows` 的一次 `reason: 'cell-edit'` 事务写回，并保留 adapter 的 audit/history/data-change 元数据。
React `IrisTable` 的 cell mode 已切到该 feature；editor DOM、焦点、Tab/异步校验导航和 legacy 事件仍由适配器接线，
row mode 继续保留每列一个 adapter-owned session，避免改变其多编辑器契约。cell-mode 的 dirty/autosave/
validationSummary/onCellEdit 仍由 bridge callback 汇入原有行为。
四端 bridge smoke 共 5/5，core 全量 1,642/1,642，React 全量 3,040/3,040；四适配器与 pro-table typecheck 已通过。

第十一批把 cell-mode 实际接入剩余三套 Table：Vue、Solid、Svelte 均通过各自的 `useGridEditing` 与
`useGridRows` 使用同一份编辑状态和 rows transaction source；编辑器 DOM、触发方式、焦点和异步校验仍由适配器掌握，
row mode 继续保留原有的多 session controller。提交时 `dataIndex`/列 key 的值读写、number coercion、unique/current-rows
校验和 legacy `onCellEdit` 回调均沿用原契约；Grid Core 对纯内置规则保留同步失败反馈，自定义 validator 仍可异步执行。
Vue 全量 1,603/1,603、Solid 全量 1,032/1,032 + hydration 38/38、Svelte 全量 1,006/1,006 + hydration 35/35，
三端 typecheck/lint/build 与四框架 cell-edit contract 均通过。至此四框架 Table 的 cell-mode 均已进入 Grid Core，
只有 row mode 的多编辑器会话仍明确留在 adapter-owned 层。

第十二批把排序状态接入剩余三套 Table：Vue、Solid、Svelte 现在均通过同一个实例级 `useGridCore` 安装
`useGridSorting`；单列/多列状态、三态循环、清空、受控静默 `sync` 和 change callback 由 Grid Core 统一拥有。
适配器只保留列 comparator、公式值读取、树子节点排序以及 remoteSort 的 query wiring；受控 prop 的反应式同步仍在
各框架桥接层完成，避免把框架响应式对象泄漏进 core。React 原有排序 bridge 保持不变，四框架现均复用同一
`createGridSortingFeature` 契约。
Vue/Solid/Svelte 的表格排序、multiSort、named views、tree 与远程排序回归共 110/101/88 通过；三套适配器全量
分别为 Vue 1,603/1,603、Solid 1,032/1,032 + hydration 38/38、Svelte 1,006/1,006 + hydration 35/35，
typecheck/lint/build 均通过（Vue lint 保留既有复杂度 warning，无 error）。
Solid 旧的 adapter-owned `useTableSort` 文件已删除；`pnpm arch-check:ratchet` 仍只命中 React/Vue/Svelte
主文件相对既有 baseline 的超限，未在本批调整 baseline。

第十三批把过滤状态接入剩余三套 Table：Vue、Solid、Svelte 均通过同一个实例级 `useGridCore` 安装
`useGridFiltering`；Core 统一拥有 text `filters` 与 checkbox `filterValues` 两条状态通道、受控静默
`sync`、set/clear methods 和 change callback。适配器只保留 `filterMethod`、列值读取、formConfig 的
draft/applied 合并、filter panel 的 open/draft UI 以及 remoteFilter 的 query wiring；本地行视图继续在适配器
中组合排序结果、表单值、过滤值和树 flatten。
Svelte 原有的 filter controller 现在只负责面板交互，已应用值从 Grid Core 读取；无受控 prop 时三端均支持
Core 内部状态，受控 prop 被拒绝更新时仍保持 prop authoritative。过滤、表单、proxy、公式和树回归定向为
Vue 104/104、Solid 50/50、Svelte 46/46；三套适配器全量仍为 Vue 1,603/1,603、Solid 1,032/1,032 +
hydration 38/38、Svelte 1,006/1,006 + hydration 35/35，typecheck/lint/build 均通过（Vue lint 仅有既有
复杂度 warning）。

export feature 现在支持 `getData()` 一次取得 rows + columns 原子快照，同时兼容原 `getRows/getColumns`；
`exportCsv/exportJson/exportExcelXml/exportHtml` 每次只派生一次数据，并统一触发 `export:complete`（format、
rowCount、columnCount）。`createProTableStore` 的四个 legacy 导出方法已不再直接调用四套序列器，而是创建
实例级 Grid Core、加载 export feature 后委托其 methods；feature 不加载时这些 methods 不存在。

`plugin-pro-table/src/core/grid*.test.ts` 覆盖 7 类能力，15/15 通过，插件四框架全量测试 87/87 通过；图表仍由已有的
`@iris-ui-kit/plugin-charts/core` 管理，Grid Core 只提供 rows/methods，不耦合图表 renderer。旧 ProTable/IrisTable API 暂不删除：
适配器仍可使用 legacy handle，新的 GridFeature API 作为显式可选组合入口，满足兼容优先和按需摇树。

### Phase 4 — rows mutation boundary（已完成）

`createGridRowsFeature` 继续收窄行数据写入边界：在保留 `getRows/setRows/transactRows/syncRows`
兼容方法的同时，新增 `getData/loadData/insert/remove/removeMany/update` model API 及对应的
`insertRow/removeRow/removeRows/updateRow` capability aliases。增删改操作统一经过同一条 rows transaction
通道，支持字段键和 `getRowKey` 计算键，批量删除只产生一次 `rows:change`；提交输入与事务快照均为独立数组，
避免调用方在提交后修改数组时污染 Grid 状态。Core standalone model 默认复制初始 seed；React `keepSource=false`
保留旧的 seed 引用语义，`keepSource=true` 仍在适配器入口先复制。React/Vue/Solid/Svelte `IrisTable` 暴露的 row-handle
读写操作已切换到该边界，审计、undo、`onDataChange` 等副作用仍由各适配器保留并按需注入；四端实际发生的
row-mode 单列写回均使用 rows `update`（React 也已切换，cell-mode 继续由 editing feature 驱动）；Vue/Solid/Svelte
的 row-drag 写回也经过 rows transaction（React 的 row-drag 继续遵守“父组件拥有数据”的 legacy 语义），但命中、
排序、拖拽取消等交互语义仍属于适配器层。row-mode 多编辑器会话继续留在适配器层，但 Vue/Solid/Svelte
proxy 页的单列提交也通过 rows `update` 写回；本地受控表仍不做内部写回。

本批同时收口了两个可选 rows 消费者：`createGridHistoryFeature` 在未传旧式
`getRows/setRows` 时直接读取 `getData` 并经 `setRows({ reason: 'history' })` 回放，旧注入参数仍可用于
适配器副作用；`createGridAuditFeature.getAuditEntries()` 返回独立的 rows/diff 数组与 Map 快照，调用方修改
返回值不会污染后续审计记录。四端 `useGridRows` bridge 也统一暴露 `cloneDefaultRows` 选项。

`plugin-pro-table` 的 client 模式（flat 与 tree）也消费同一 rows feature：inline edit、create、delete/bulk-delete
通过 `update/transact/removeMany` 写回，legacy `allRows` 仅作为稳定引用镜像给既有同步 data-source 与 export
选择器；树子节点的递归不可变 path update/remove 已下沉到 framework-neutral Grid Core rows feature，插件 bridge
只负责传入 `getChildren/setChildren` 并维护展开态与扁平 edit lookup。`tree.getChildren` 返回可枚举 children 数组时
可自动替换；自定义访问器可提供 `tree.setChildren`。因此 mutation lifecycle、分页和导出契约不变；server 模式仍保留
远程数据源所有权，暂不在本批引入本地 rows model。

本次续批把同一 tree accessor 契约带到四个 `useGridRows` 薄桥：`getChildren`/`setChildren` 只在调用方显式提供时
启用树路径，未配置时继续走 flat rows 快路径。四套 `IrisTable` 将静态 `getSubRows` 传入 Core rows feature，因此
`removeRows` 与 row-mode 的 `update` 可以直接寻址嵌套子节点，并保持一次 rows transaction、不可变根列表和父级
`onDataChange` 镜像；React 的 root-only 删除预检同步移除，避免静态树子节点被误判为缺失。lazyLoad 的缓存仍是
adapter-owned，待其缓存写回可以表达为稳定的 `setChildren` 事务后再接入，避免把异步缓存副作用泄漏进 Core。

本批继续收口 rows 的读取边界：Core rows model 新增 `find(key)`，并通过 `findRow` capability alias 暴露同一
cycle-safe 前序查找；flat rows 使用 resolved key 扫描，tree rows 复用 `getChildren` 路径并保护重复节点/循环引用。
`plugin-pro-table` 的 inline edit、delete 和 bulk-delete 现在优先从该 model 解析当前行，`allRowsForEdit` 仅继续承担
legacy 稳定镜像与 server fallback，不再作为 client tree 的唯一存在性来源。

树读路径再向 Core 收口：`collectTreeRows` 与 `findTreeRow` 共用 cycle/duplicate guard，按 pre-order 产出完整的
可达节点列表。`plugin-pro-table` 的编辑索引和 `expandAll` 改用该纯函数，保留原有 key 顺序与 tree accessor 契约；
lazy children cache 仍不进入 Core。

级联选择的 nested rows 投影也继续下沉：Core `flattenTreeSelectionNodes` 负责以全局 pre-order index 建立
`key`/`parentKey` 映射，并在同一纯函数内处理 disabled、重复节点与循环引用。Vue `IrisTable` 以及四个
`IrisTree` 适配器只保留既有的受控 selection rebasing、compact seed、lazy cache 与 action-local model，树遍历交由
Core；Table 的 fallback row-key 索引语义和 Tree 的稳定 id 语义均保持不变，避免适配器重复实现 parentage 投影。

本批继续收口 rows 的读路径：React/Vue/Solid row-mode 的当前行提交优先通过 Core rows model `find` 解析，React
的 `setCurrentRow`/`toggleRowExpand` 也支持静态树中的折叠或嵌套 key；Svelte row-mode controller 以可选 `findRow`
桥接同一能力。可见 body snapshot 仍作为 lazy/server 子节点和旧回调 index 的 fallback，Core 不接管异步 cache，
因此不会改变代理分页、rowExpandable 或事件参数语义。

本批继续收口 rows 的写路径：Core 新增 `reconcileTreeRows` 纯函数，将 clipboard/range 等可见投影产生的
keyed row replacement 不可变地写回根树，沿变更节点重建 ancestor path，未触及的 row 保持引用；与
`findTreeRow`/`collectTreeRows`/tree mutation 共用 cycle/duplicate guard，并支持非属性 children 的
`setChildren`。React Table 的 bounded paste、single-cell overflow、context clear/format、快捷键清空、range
fill/move/copy/clear、FNR replace 与 batch edit 统一通过该路径；静态树子行不再被 root-only `map` 丢弃，
lazy/proxy 子节点仍保留 adapter-owned fallback，compare merge 则继续遵守 root snapshot 契约。
Core `grid-rows`/range-clipboard 定向回归 20/20，React clipboard/range/drag/FNR/permission 定向回归
95/95；Core 全量 111/111 files、1,664/1,664 tests，React 全量 266/266 files、3,047/3,047 tests；
React typecheck/build、lint（仅既有复杂度 warning）、Prettier、manifest 与 `git diff --check` 通过。

本次续批把 Core editing 的写回也改成 path-aware：`createGridEditingFeature` 对根行保留 legacy
`setRows`，对静态树子行通过 rows model 的 `find`/`update` 生成一次 key-addressed transaction，提交不会再
落入 `rows[-1]`；嵌套结果保留 path 来源标记，适配器可用 `getRowIndex` 提供当前可见索引，但该索引只进入
事件契约，寻址始终走树路径；`reason: 'cell-edit'`、异步校验、no-op 与 adapter metadata 契约保持不变。`plugin-pro-table`
client tree bridge 在 rows commit 后同步 `treeRoots`、`allRows` 与 `allRowsForEdit`，后续折叠/展开 reload
不会从旧树源复活子行。React Table 的 cell editing、clipboard/range、FNR、batch 与 drag-copy 的字段写回
统一解析 `dataIndex ?? key`，并继续以 `reconcileTreeRows` 合并可见树投影；lazy/proxy 行仍使用适配器回退。
Core 全量 112/112 files、1,669/1,669 tests，React 全量 266/266 files、3,049/3,049 tests，
plugin-pro-table 主入口 74/74、Solid 13/13、Svelte 13/13；Core、React、plugin-pro-table 完整
`typecheck` 与 build 通过；Vue/Solid/Svelte 适配器 `typecheck` 与四框架 build 也通过（build 仅保留既有
未使用外部导入 warning），plugin lint、manifest 与 `git diff --check` 通过。

本次续批补齐树行拖拽的写回边界：Core 新增 `reorderTreeRows`，从扁平可见拖拽投影解析两个 key，在同一父级
sibling list 内执行 remove→insert，并只重建变更节点的 ancestor path；源树、子数组与未触及 row 保持引用。跨父级、
缺失 key、重复/循环节点或 computed children 无法通过 `setChildren` 写回时 fail-closed，绝不把扁平子行提交为根数组。
React/Vue/Solid/Svelte Table 的静态 `getSubRows` row-drag 统一提交该 canonical root tree；lazy children 仍保持
adapter-owned，flat 表格保留旧的可见列表排序与 callback 语义，React 仍由父组件拥有最终数据。
Core 全量 112/112 files、1,680/1,680 tests；React 268/268、3,051/3,051，Vue 170/170、1,609/1,609，
Solid 146/146、1,035/1,035 + hydration 38/38，Svelte 150/150、1,009/1,009 + hydration 35/35；四端新增
静态树 drag 回归通过，plugin-pro-table client tree mutation 75/75；四端 typecheck/build 与
`git diff --check` 通过（仅保留既有 warning）。删除树父节点时 Core 现在同时报告整棵可达子树的 key，
四端与插件可据此一次性清理已消失的 descendant selection/session 状态；replacement 缺少 children 字段时
也不会在 path reconciliation 中丢弃折叠子树。

本次续批把单格 `insertIfOverflow` 收口为 Core clipboard 的可选 `overflowRows` factory：Core 只在单格
paste 耗尽有效 body 后收集 split cells，factory 负责宿主行形状与锁定/只读策略，Core 负责按
`rowKeyField` 复用 `insertRowInList` 的 max+1（无 key 时从 1 起）以及与普通 paste 相同的一次 rows
transaction。未注入 factory 时仍保持 batch-O 丢弃语义，多格矩形永不触发；新增行同时计入
`changedRows/changedCells`，React 的 audit/history/onDataChange metadata 继续由既有 `commitOptions` 注入；本批 core 定向
10/10、React Grid/clipboard 定向 51/51 通过，四框架 typecheck 通过；`GridClipboardOverflowContext` 同步从
`@iris-ui-kit/core/grid` 公共 barrel 导出，便于宿主 factory 保持类型契约。

本次续批补齐 clipboard 的三端薄桥：Vue、Solid、Svelte 新增 `useGridClipboard`，与 React 共用同一个
`createGridClipboardFeature` model；三套 Table 的范围复制现在只把有效行/列投影和格式参数交给 Core，
`writeClipboardText`、快捷键、按钮和浏览器 clipboard I/O 继续留在各适配器。公式列仍通过不可变 shadow rows
复制计算值，CSV/HTML/TSV 格式、formatter/mask 与无 range 的 fail-closed 行为保持原契约；bridge 也暴露
`paste`，为后续三端粘贴接入保留同一方法边界。Vue/Solid/Svelte bridge + copy 定向回归分别为 4/4、5/5、4/4，
三端公式/主表回归分别为 94/94、73/73、71/71，四端 typecheck 与格式检查通过。

本次续批把 `clipConfig.paste` 接入 Vue、Solid、Svelte Table：适配器只负责读取异步系统剪贴板和快捷键的
preventDefault，Core `paste` 负责 TSV 行列解析、公式列拒写、`dataIndex` 字段写入，以及将排序/过滤/静态树的
有效投影按 key reconciliation 回原始 rows source；成功写回仍只产生一次 rows transaction，并由适配器触发
`onDataChange`。无剪贴板权限、禁用 paste、无 range 和全 formula 目标均 fail-closed；粘贴值保持原有 raw string
语义。三端新增 paste 回归各 2/2，连同既有公式/主表回归为 Vue 99/99、Solid 75/75、Svelte 73/73，四端
typecheck、lint、格式检查通过。

本次续批完成跨表公式 `formulaTables` 的四端契约：Core 已有的 `table!field`（读取命名表首行、未知表/空表/
未知字段 fail-closed）现在贯通 Vue、Solid、Svelte 的渲染、排序、过滤、摘要、范围复制与 CSV 导出；三端均保留
新对象身份更新语义和表间隔离，公式列仍为只读展示列。新增 Vue/Svelte SSR 回归并重跑 Solid SSR，生成
`IrisTableFormulaTables` 类型和 manifest/llms。交叉公式定向回归 Vue 7/7（含 SSR）、Solid 8/8（含 SSR）、
Svelte 7/7（含 SSR），React 既有契约 12/12；完整回归为 Vue 175 files/1,628 tests、Solid 151/1,054 + SSR
41、Svelte 155/1,029 + SSR 38。三端 typecheck、lint/build、React typecheck 与 `git diff --check` 通过；Vue
仅保留既有 Table complexity warning，未调整 arch ratchet baseline。

本次续批补齐 Vue Table 的撤销/重做薄桥：Core `createUndoStack` 继续持有有界的 post-change row-list
快照，Vue 只负责生命周期、`useGridRows` 事务桥、受控 selection pruning、工具栏按钮与窗口快捷键；编辑、粘贴、
拖拽、`loadData`/`removeRows` 均共享同一记录边界，undo/redo replay 通过正常 `onDataChange`/audit 写回且不会
自我入栈。快捷键默认只在表根内生效，编辑器/文本控件、卸载或关闭 `undo` 时 fail-closed；异步 clipboard read
在卸载或关闭 paste 后也不会提交。新增 Vue undo 单测 10/10（含 row-mode、proxy、selection、paste 与 pending
read）及 SSR 1/1、hydration 1/1，Vue typecheck/lint 通过（仅既有复杂度 warning），并重新生成 manifest/llms；现有 Vue 全量
回归保持 178 files/1,640 tests 通过。

本次续批将同一 undo/redo 契约接入 Solid：Core `createUndoStack` 仍只保存有界的 post-change row-list 快照，Solid
只桥接 `useGridRows` 事务、selection pruning、toolbar 与表根范围的快捷键；cell/row edit、粘贴、拖拽和 imperative
row operations 均从同一 rows transaction 记录，replay 使用 guarded commit 并通过 `onDataChange` 写回。row mode
的本地 live rows 延迟到会话关闭后同步，同时用 live snapshot 保持已提交值可见，避免 keyed DOM 替换打断剩余 editors；
外部 source 仅在历史 pristine 时重建 baseline，proxy 与本地表均保持一致。Solid 新增 undo 定向 11/11、row-edit 7/7、
undo SSR 1/1，现有 SSR/hydration 安全套件合计 44/44；默认全量 152 files/1,065 tests、typecheck/lint/build、
manifest 与格式检查通过。

本次续批继续接入 Svelte：Core `createUndoStack` 仍只保存有界的 post-change row-list 快照，Svelte 仅桥接
`useGridRows` 事务、selection pruning、toolbar 与表根范围的快捷键；cell/row edit、粘贴、拖拽和 imperative
row operations 均从同一 rows transaction 记录，replay 使用 guarded commit 并通过 `onDataChange` 写回。row
mode 的本地写回延迟到会话关闭后，live snapshot 让已提交值在剩余 editors 存活期间仍可见；外部 source 仅在
history pristine 时重建 baseline。新增 Svelte undo 定向 10/10、SSR 1/1，hydration 安全套件 41/41；默认全量
156 files/1,039 tests，typecheck 通过。

本次续批完成懒加载树的 rows 写回边界：Core 新增 `setTreeChildren` 纯函数以及 rows model 的
`setChildren/syncChildren`（分别对应可观察事务和静默同步），沿稳定 key 查找父节点、复制异步 children
数组、只重建变更节点的 ancestor path；普通 `children` 属性可自动写回，计算型 accessor 没有
`setChildren` 时 fail-closed。React/Vue/Solid 的既有 `lazyLoad` 回调不再维护 adapter-local children
cache，而是通过同一 rows transaction 写入 Core 的 `children` 槽；loading/epoch 仍留在适配器，因而
旧的 spinner、重试、刷新丢弃陈旧回调和 `getSubRows` fallback 语义不变。懒加载提交标记为非业务变更：
不会触发 `onDataChange`、undo 或 audit，但 Core 的 `find/update/remove` 随即可寻址已加载子节点；Svelte
后续补齐 `lazyLoad` 公共 prop，loading/epoch 仍由适配器拥有。Core rows 定向回归 20/20，React
懒树/row-edit 25/25、Vue 懒树 11/11、Solid 懒树 10/10；React/Vue/Solid typecheck 通过。

本次续批继续把已加载的 lazy children 接到所有树投影消费者：React 的 clipboard/range/FNR 等 keyed
reconciliation、React/Vue/Solid 的 row-drag 都通过同一 `readRowChildren` 和 `setChildren` 走 Core
canonical tree，React `expandAll` 也会递归 conventional `children`。树跨父级、隐藏 key、循环/重复节点以及
computed children 无 setter 仍 fail-closed；flat 表格与各端默认路径保持原契约。定向回归
为 Core rows 20/20、React lazy/row-edit/static-drag 41/41、React lazy clipboard 6/6、Vue lazy/static-tree
23/23、Solid lazy/static-tree 10/10；四端相关 typecheck/build/lint 通过。

本批继续收口 row-drag 的事务边界：Core `GridRowsModel` 新增 `reorder`，并以 `reorderRows` capability alias
暴露 flat/tree 同级移动、`before/after/auto` 位置语义与 rows transaction metadata。flat 路径按 resolved key
执行不可变 remove→insert；tree 路径复用 `reorderTreeRows`，跨父级、缺失/重复/循环节点以及 computed children
无 setter 继续 fail-closed，成功时只重建受影响的 ancestor path。Vue、Solid、Svelte 的拖拽桥优先调用该 model，
排序或 index-keyed 可见投影无法与 source row 身份对齐时才保留旧 projection fallback；React 仍由父组件拥有最终
数据，未改变 legacy `onReorder` 交付语义。Core rows 22/22、Vue row-drag 11/11、Solid 22/22、Svelte 5/5
定向回归通过；四端 typecheck/lint 与 manifest/git diff 检查通过。

本次补强 reorder 的坏树护栏：`reorderTreeRows` 找到拖拽两端后仍会扫描剩余可达节点，若发现重复 row/key 或循环引用
则整次操作保持原树并返回 `blocked`，不因目标恰好排在坏分支之前而产生部分写回。正常同级重排、跨父级拒绝和
computed children 无 setter 的语义不变；新增 Core 回归覆盖“有效目标之后出现 duplicate/cycle”的 fail-closed 路径。

本次续批将平面与树的 remove→insert 位置计算继续收敛到 `table-rows` 的 `reorderRowsInList` 纯函数。Core
`GridRowsModel` 与 `reorderTreeRows` 共用 `auto/before/after` 语义，computed key 仍按原 sibling index 解析，
未知/相同 key 保持原数组引用并跳过 rows transaction；新增回归覆盖双向位置、computed key 与 identity no-op。

2026-08-29：Grid Core data-source mutation boundary 续批将 outbox 的交付结果与队列并发边界收口：`createOutbox`
保留 `flush(): Promise<number>` 兼容 API，新增 `flushDetailed`/`subscribeFlush` 的 item-aware outcome；执行期间的
`enqueue/remove/clear` 按 live item identity 合并，不会被旧数组快照覆盖或复活。持久化路径新增显式
`OutboxCodec`/JSON-safe snapshot guard，DataSource 的 closure payload 在 durable storage 下 fail-closed，并支持带
`executor` 的 descriptor round-trip；`mutateResult`/`mutateRowResult` 区分 delivered/deferred/failed，旧 mutate API
不再把 queued 或 exhausted mutation 当作成功，optimistic rows、pendingRows、rowErrors 与 resilient cache 只在
真正 delivered 时进入成功/重载路径。Core 全量 **125 files / 1,789 tests**，outbox/data-source focused **60/60**，
typecheck/build、lint（0 errors；仅既有 `grid-tree-children`/`table-views` complexity warnings）、Prettier 与
`git diff --check` 通过；未修改架构 baseline 或生成 manifest。

2026-08-29：Grid Core reconnecting-source generation safety 续批为 `createReconnectingSource` 增加 transport generation、
幂等 teardown 与 reconnect token 护栏；过期 transport 的 message/open/error/close 回调、重复 close 与过期 timer 均
fail-closed，连接/断开同步异常经既有 `onError` 通道处理。Core `realtime` focused **19/19**，隔离 worktree Core
全量 **114 files / 1,705 tests**，typecheck/build/lint、定向 Prettier、`git diff --check` 与 runner acceptance gate
通过；close terminal、open active-idempotent 兼容语义不变，未改 manifest 或架构 baseline。

2026-08-29：Grid Core row-edit session 续批新增框架无关 `createTableRowEditModel`，统一多单元格 row-mode 的
begin/switch/open/draft/commit/cancel/dispose、同步/异步 `editRules` epoch 护栏、注入式 number coercion 与 source-row
identity；Svelte、Vue、Solid、React 仅保留各自 controller/renderer 外形、input refs/focus、DOM/render 和 rows/undo/audit
回调。Core 的 commit-validation hook 支持 React validationSummary，未增加第二写回路径。Core **1,841 tests**，Svelte
row-edit **8/8**、Vue focused **56/56**、Vue SSR **18/18**、Solid focused **33/33**、Solid full **1,133/1,133**、
SSR **50/50**、hydration **1/1**、React row/validation/formula **67/67**、React SSR/hydration **42/42**；四端
build/typecheck/lint、Core row-edit、Prettier、manifest check 与 `git diff --check` 通过，React 全量仅保留既有 Tree
update-depth failures，未提交。

2026-08-29：row-edit hardening follow-up 根据 adversarial review 收口：显式 `findRow` 缺失、源行 replacement、动态
不可编辑、重复 pending validation 与 stale blur 均 fail-closed；Vue nested-tree 使用 Core rows `update`，Vue Tab 有明确
commit/focus bridge；Core validation channel 区分 `editRules/custom/none`，detached async rule failure 只报告一次，unique
规则支持 dataIndex resolver。数值 select unmatched-option 保持原行为。Hardening focused、四端 typecheck/build/lint、manifest、
定向 Prettier 与 `git diff --check` 通过，read-only review **PASS**；full turbo/coverage/E2E/visual 未运行。

2026-08-29：Grid Core pagination lifecycle 续批将分页的 mode、取消和销毁安全收口至 Core：显式 `paged` 的 `loadMore`
替换页、`infinite` 追加，省略 mode 保持历史追加；页码/页大小非法值 fail-safe 归一化，AbortSignal 透传为可选第二参数，
request generation + `AbortController` 防止陈旧结果写回，cancel 后可重试。React/Vue/Solid/Svelte pagination bridge 暴露
`cancel` 并在卸载时取消；一参数 fetcher、默认页大小、SSR 无 AbortController 路径保持兼容。隔离 runner 已验证 Core focused/
full **20/20、1,706/1,706**，Core build/typecheck/lint；移植后当前 workspace 独立复验 React/Vue/Solid/Svelte
focused **6/6、7/7、4/4、4/4**，四端 typecheck/build/lint 通过；未提交。

2026-08-29：Grid Core remote-table mutation boundary 续批将现有 DataSource cancellation/resilience 能力贯通
`createRemoteTableSource`：query callback 以可选第二参数接收 `AbortSignal`，`resilient` 配置可透传 dedup/TTL/SWR、
breaker 与 rate-limit；React/Vue/Solid/Svelte proxy 类型与薄桥保持一参数 callback 兼容，params 对象、latest-wins、
destroy/SSR 与默认无 resilience 语义不变。Core/React/Vue/Solid/Svelte focused **22/22、14/14、18/18、24/24、20/20**，
五包 typecheck/build/lint、Core framework-import guard、定向 Prettier 与 `git diff --check` 通过；未改 manifest、llms 或
架构 baseline。

2026-08-29：表格 grouping body plan 继续下沉至 Core `buildTableGroupPlan`；React 的单列/多列分组、首见字符串 key、
`::` 层级 key、折叠子树、原始行索引/identity 与末级 summary rows 统一由纯函数投影，适配器保留 collapse state、
props resolution、渲染和事件。Core grouping **71/71**、React grouping **40/40**，Core/React build/typecheck/lint、
定向 Prettier、manifest check 与 `git diff --check` 通过，未改 manifest/llms 或架构 baseline。

2026-08-29：表格 row-key 的字段/索引纯投影继续下沉至 Core `resolveTableRowKey`；Vue、Solid、Svelte 删除相同的
`typeof`/index fallback，React 保留额外的 legacy `rowId` 与 tree-key 语义。字符串、数字（含空串、零、NaN、Infinity）、
null/缺失回退及源行 identity 均有 Core/三端回归；Core build、三端 focused/typecheck/build/lint、manifest check、
定向 Prettier 与 `git diff --check` 通过，未改 manifest/llms 或架构 baseline。

2026-08-27：Vue columns-state 续批接入既有 Grid Core，Vue 全量 **180 files / 1,652 tests** 通过，typecheck/build 通过，lint 0 errors（保留既有 1 条 complexity warning）；`git diff --check` 通过，`pnpm check:manifest` 确认 2 个生成文件无变化；未调整 ratchet baseline。

2026-08-27：Solid columns-state 续批 gate：client **153 files / 1,071 tests**、SSR/hydration **5 files / 45 tests** 通过；typecheck/lint/build、`pnpm check:manifest`（2 个生成文件无变化）与 `git diff --check` 通过。order/pinned-map channels deferred，未调整 ratchet baseline。

2026-08-27：Svelte columns-state gate：client **157 files / 1,048 tests**、SSR/hydration **4 files / 42 tests**（hydration 37）通过；typecheck 0 errors/0 warnings、lint/build、`pnpm check:manifest`（2 个生成文件无变化）与 `git diff --check` 通过。未调整 ratchet baseline，order/pinned-map channels deferred。

2026-08-27：Vue `columnFade` continuation accepted；default-off 不注入 fade CSS 或 `matchMedia` listener，focused **24/24**、Vue 全量 **183 files / 1,676 tests**，typecheck/build、lint（0 errors，既有 complexity warning）、iris-ui-spec（329 files / 0 violations）、manifest 与 `git diff --check` 通过；`scripts/arch-baseline.json` 未改。

2026-08-27：Solid `columnFade` continuation accepted；focused **15/15**、client **154 files / 1,086 tests**、SSR **6 files / 46 tests**、dedicated hydration **1/1** 通过；typecheck/lint/build、manifest 与 `git diff --check` 通过，默认关闭时不注入 fade stylesheet，未改 `scripts/arch-baseline.json`。

2026-08-27：Svelte `columnFade` continuation accepted；focused **19/19**、client **159 files / 1,067 tests**、SSR **5 files / 45 tests**、dedicated hydration **1/1** 通过；svelte-check 0 errors/0 warnings、lint/build、manifest 与 `git diff --check` 通过，默认关闭时不注入 fade stylesheet，未改 `scripts/arch-baseline.json`。

2026-08-27：Vue `columnOrder` continuation accepted；显式受控 order 才写入 Core，普通 `columnDrag` 保持父级 columns 所有权；全量 **184 files / 1,682 tests**、typecheck/build、spec audit **329 files / 0 violations**、lint（0 errors，既有 complexity warning）、manifest 与 `git diff --check` 通过，未改 `scripts/arch-baseline.json`。

2026-08-27：Solid `columnOrder` continuation accepted；显式受控 order 才写入 Core，普通 `columnDrag` 保持父级 columns 所有权；drag 落点矩形过滤 `__drag/__seq/__expand` 伪列头；全量 **155 files / 1,091 tests**、SSR/hydration **6 files / 47 tests**、typecheck/lint/build、spec audit（**312 files / 0 violations**）、manifest 与 `git diff --check` 通过；`arch-check --diff` 仍阻断：solid IrisTable.tsx **2667 行 > baseline 2340**（HEAD 已 2641 行，ratchet 在既有合并续批中已过期，react/svelte 另 3 个超限同在 HEAD），按命令未改 `scripts/arch-baseline.json`。

2026-08-28：Svelte `columnOrder` continuation accepted；order 与 React/Vue 同构经 `grid-columns` per-table channel（显式 `columnOrder` 才接管列序，`columnDrag` 所有权不变）；focused **5/5**、client **160 files / 1,072 tests**、SSR **5 files / 48 tests**（hydration-safety 39）通过；svelte-check 0 errors/0 warnings、lint/build、framework parity、manifest（155×4）与 `git diff --check` 通过，未改 `scripts/arch-baseline.json`（svelte `IrisTable.svelte` 净 +31，ratchet 限制同上）。

2026-08-27：Vue `pinnedColumns` continuation accepted；受控拖拽每次提案前静默重同步 Core，focused **8/8**、全量 **186 files / 1,687 tests**、typecheck/build、lint 0 errors（既有 complexity warning）、spec audit **1,594 files / 0 violations**、`pnpm check:manifest` 与 `git diff --check` 通过；`scripts/arch-baseline.json` 未改。`arch-check:ratchet` 仍受 HEAD 既有 oversized Vue/React/Solid/Svelte Table 文件限制，未调整 baseline。

2026-08-28：Solid `pinnedColumns` continuation accepted；受控 pin map、列声明 fallback、左右 sticky 投影、分组表/汇总与 pinned drag 均通过 focused **8/8**、client **156 files / 1,099 tests**、SSR **7 files / 48 tests**；typecheck/lint/build、spec audit **1,594 files / 0 violations**、manifest 与 `git diff --check` 通过，未改 `scripts/arch-baseline.json`；`arch-check:ratchet` 仍因既有 React/Vue/Solid/Svelte oversized Table 文件的 grandfathered baseline 限制报红，未调整 baseline。

2026-08-28：列顺序投影纯函数继续下沉至 Core `applyColumnOrder`，React/Vue/Solid/Svelte 移除重复的 adapter-local 实现；未知/重复 key、遗漏列的稳定顺序及空 order 的 identity 快路径保持不变。Core columns **10/10**、grid-columns **5/5**，四端列状态/列顺序定向回归 **39/39**，四端 typecheck 与 `git diff --check` 通过。

2026-08-28：列可见性投影继续下沉至 Core `applyColumnVisibility`，React/Vue/Solid/Svelte 的顶层 visibility 过滤统一复用该纯函数；空/未提供 map 保持 identity，分组列仍只在顶层过滤，fade 的 overlay 与 `visibleMethod` 语义不变。Core columns **12/12**、grid-columns **5/5**，列顺序/状态及三端 fade 定向回归 **105/105**，四端 typecheck/build/lint 与 `git diff --check` 通过。

2026-08-28：`pinnedColumns` map 通道继续对齐 Vue/Solid/Svelte，显式 `null` 覆盖静态 pin，缺失 key 保留静态声明；受控拖拽提案经 Grid Columns model 回调但不乐观改写，响应式/虚拟列和 SSR 均保持 pin 语义。Vue pin 回归 **8/8**、Solid/Svelte pin + SSR 回归各 **5/5**，三端 typecheck/lint/build 与 `git diff --check` 通过。

2026-08-28：自动列类型投影下沉至 Core `applyDetectedColumnDefaults`，四端统一递归填充缺失 alignment；React 通过选项继续填充缺失 `sortType`，Vue/Solid/Svelte 保持原有仅 alignment 语义。Core column-type **13/13**，四端 auto-detect 回归 **21/21**，typecheck 与格式检查通过。

## 8. 合并门

2026-08-28：窄屏响应式布局下沉至 Core `computeResponsiveColumnLayout`，统一 leading tracks 预算、分组 pinned descendant 保护和 fitted natural width overflow 判断；React/Vue/Solid/Svelte 删除重复 responsive wrapper 与自然宽度投影，原有 480px、floor、identity 和 fail-closed 语义保持不变。Core responsive **15/15**、四端 responsive 回归 **26/26**，四端 typecheck/build/lint 与 `git diff --check` 通过。

2026-08-28：固定列 sticky offset 计算下沉至 Core `computePinnedColumnOffsets`，四端统一左右边缘累积和 leading track 偏移，框架层仅保留 style 输出；新增 Core offset 回归 **2/2**，React/Vue/Solid/Svelte pinned 回归 **44/44**，typecheck/build/lint 与 `git diff --check` 通过。

2026-08-28：pinned-boundary 的连续左 pinned prefix 计算继续下沉至 Core `leftPinnedCount`，新增 effective `pinOf` resolver 参数；React/Vue/Solid/Svelte 删除各自重复 prefix loop，同时保留静态列 fallback 与受控 pin map 语义。Core pinned-drag **4/4**、四端 boundary 回归 **27/27**，typecheck/build/lint、manifest 与 `git diff --check` 通过。

2026-08-28：pinned-boundary 的 right block 定位与 boundary leaf 定位继续下沉至 Core `firstRightPinnedIndex` / `pinnedBoundaryIndex`，四端 adapter 仅保留受控提交和 DOM wiring；gapped pin、无右 pin、空 prefix 的边界语义保持不变。Core pinned-drag **4/4**、四端 boundary 回归 **27/27**，typecheck/build/lint 与 `git diff --check` 通过。

2026-08-28：列宽投影继续下沉至 Core `resolveInitialWidth` / `resolveColumnWidth` / `resolveColumnWidths` / `resolveColumnTrack(s)` / `isValidColumnWidth`；React/Solid/Svelte 移除重复的 px 解析、有限值校验和 CSS track 投影，Vue 保留既有 numeric grid-track 合同。Core column-width **4/4**，列宽/track 定向回归 React **42/42**、Vue **29/29**、Solid **20/20**、Svelte **22/22**，typecheck/build/lint 与 `git diff --check` 通过。

2026-08-28：横向列虚拟化窗口继续下沉至 Core `computeVisibleColumnIndices`，四端统一 overscan、pinned/transition 列 union 与非法宽度 fail-closed 语义；适配器仅提供响应式尺寸、列宽和 always-visible predicate。Core column-virtual **4/4**，四端 virtual/responsive 定向回归 React **130/130**、Vue **90/90**、Solid **83/83**、Svelte **78/78**，typecheck/build/lint 与 `git diff --check` 通过。

2026-08-28：列 track 位置投影继续下沉至 Core `countLeadingGridTracks` / `columnGridTrack`，四端移除重复的 leading utility count 与 1-based leaf track 公式；React/Vue/Solid/Svelte 的虚拟列、summary/footer、group header 对齐语义保持不变。Core grid-layout **2/2**，定向回归 React **110/110**、Vue **88/88**、Solid **81/81**、Svelte **76/76**，typecheck 与 `git diff --check` 通过。

2026-08-28：完整 CSS grid track 字符串投影继续下沉至 Core `resolveGridTemplateColumns`，统一 leading utility tracks、叶列 authored width、fade collapsed track 与 adapter-specific numeric track 覆盖；React/Vue/Solid/Svelte 删除重复的 track 拼接循环，Vue 保留原有 numeric grid-template 合同。Core grid-layout **5/5**，定向回归 React **70/70**、Vue **19/19**、Solid **21/21**、Svelte **23/23**；四端 typecheck/build/lint、Core 全量 **118 files / 1,725 tests**、manifest、Prettier 与 `git diff --check` 通过。

2026-08-28：grouped-header utility track 定位继续下沉至 Core `leadingGridTrack`，四端统一 rowDrag/sequence/detail/selection 的 1-based track 解析，保留 disabled utility 的 `null` fail-closed 语义；React/Vue/Solid/Svelte 删除 grouped-header 内联偏移公式。Core grid-layout **7/7**，grouped-header 定向回归 React **27/27**、Vue **26/26**、Solid **12/12**、Svelte **13/13**；四端 typecheck/build/lint、Prettier 与 `git diff --check` 通过。

2026-08-28：body cell span occupancy 继续下沉至 Core `resolveGridSpan` / `computeGridSpanPlan`，四端共用 row-major coverage、covered-cell skip 与 null/undefined 单格默认语义；React/Vue/Solid 保留各自 render-pass 与 column-virtualization 生命周期，Svelte 删除 adapter-local span plan。非法非有限 span 不再进入 occupancy 循环，避免 malformed callback 卡死。Core grid-span **4/4**，相关回归 React **38/38**、Vue **28/28**、Solid **3/3**、Svelte **40/40**，四端 typecheck 与 `git diff --check` 通过。

2026-08-28：列宽交互投影继续下沉至 Core `clampColumnWidth`、`DEFAULT_COLUMN_MIN_WIDTH` 与 `COLUMN_RESIZE_STEP`，四端统一有限宽度的 round/clamp 与键盘步长；Vue 显式保留既有 pointer fractional-width 合同（round=false），React/Solid/Svelte 保持整数 resize。`resolveInitialWidth` 同时对非法 numeric declaration/fallback fail-closed。Core column-width **5/5**，列宽回归 React **35/35**、Vue **88/88**、Solid **81/81**、Svelte **76/76**，四端 typecheck/build/lint 与 `git diff --check` 通过。

2026-08-28：本地过滤投影继续下沉至 Core `filterTableRows`，统一大小写不敏感 substring、`filterMethod`、checked-value 的集合内 OR / 多 map AND、typed `filterRules` 与未知 key fail-open；`mergeFilterValues` 同步收敛远程 query map 序列化，并保留空集合不覆盖既有 text filter 的语义。React/Vue/Solid/Svelte 删除重复过滤循环与 map merge，公式列仍由各适配器的 `getValue` bridge 负责。Core 全量 **120 files / 1,736 tests**，过滤相关回归 React **134/134**、Vue **112/112**、Solid **98/98**、Svelte **77/77**；四端 typecheck/build/lint、manifest、定向 Prettier 与 `git diff --check` 通过。

2026-08-28：表格排序投影继续下沉至 Core `createTableSortComparator` / `createTableMultiSortComparator` / `sortTableRows`，统一自定义 sorter、`sortType` coercion、方向链、未知 key 跳过与无有效 sort 的 identity；四端保留各自 formula/dataIndex value resolver，React query sort 与 Vue legacy pure helper 也改走 Core。Core table-sort **5/5**，排序/公式回归 React **49/49**、Vue **43/43**、Solid **62/62**、Svelte **59/59**；四端 typecheck 与定向测试通过。

2026-08-28：表格值读取与公式 shadow-row 投影继续下沉至 Core `resolveTableColumnValue` / `materializeTableFormulaValues`，统一 formula 优先于 `dataIndex`/`key`、cross-table snapshot 与不可变 materialization；React/Vue/Solid/Svelte 仅保留类型/作用域薄桥，未改变空公式、无公式 identity 和源行不变语义。Core table-values **6/6**，formula/serializer 回归 React **46/46**、Vue **113/113**、Solid **91/91**、Svelte **89/89**；四端 typecheck 与定向测试通过。

2026-08-28：公式列 edit-capability 判定继续下沉至 Core `isTableColumnEditable`，统一 `editable && !formula` 的只读公式语义；React/Vue/Solid/Svelte 仅保留 `isEditableColumn` 兼容别名，编辑入口、row mode 与 `data-editable` capability attr 继续共享同一 predicate。Core 全量 **122 files / 1,747 tests**，公式/序列化回归 React **40/40**、Vue **33/33**、Solid **79/79 + SSR 2/2**、Svelte **78/78 + SSR 3/3**；四端 typecheck/build/lint、manifest、定向 Prettier 与 `git diff --check` 通过。

2026-08-28：列可见性 fade 的纯投影继续下沉至 Core `startColumnFade` / `advanceColumnFade` / `commitColumnFade` / `expandColumnFadeToLeaves`，四端统一 sparse visibility、pending/run 阶段、反转重启、完成提交和 grouped leaf 展开；rAF/timer、reduced-motion、focus recovery 与 DOM 属性仍留在适配器。Core column-fade **7/7**，fade 回归 React **34/34**、Vue **24/24**、Solid **15/15**、Svelte **19/19**；四端 typecheck 与定向测试通过。

2026-08-28：表格范围与键盘投影继续收口至既有 Core `CellRangeController` / `nextGridCell`：四端 range bridge 统一由 Core 生成 normalized range，Shift+Arrow 的边界移动不再各自维护 row/column ternary，适配器仅保留 modifier、DOM focus 与 clipboard wiring。反向范围、无 anchor fallback、边界 no-op 与 Escape 清除语义保持不变；Core `cell-range` **10/10**、`roving` **17/17**，定向回归 React **87/87**、Vue **81/81**、Solid **57/57**、Svelte **54/54**；四端 typecheck 与 lint 通过。

2026-08-28：平面 row-drag 的 list reorder 继续统一复用 Core `resolveRowDragProjection`、`reorderRowsInList` / `reorderRowsInListAt`，四端删除 adapter-local 的重复可见索引解析与 `findIndex` + `splice`；React insertion-line 的 pre-removal `insertIndex` 合同由 `reorderRowsInListAt` 精确承接，树拖拽继续走 `reorderTreeRows`。非法/同 key 的 identity、源行 identity、原数组不变与默认 remove-then-insert 语义保持不变；Core `table-rows` **30/30**，adapter drag 回归 React **10/10**、Vue **11/11**、Solid **22/22**、Svelte **5/5**；四端 typecheck 与定向测试通过。

2026-08-28：平面 column-drag 的 list reorder 继续统一复用 Core `reorderColumnsInList` / `reorderColumnsInListAt`，React 的 frozen-zone clamp 仅保留 pin-zone 约束，四端删除重复 `findIndex` + `splice`；grouped leaf、controlled order proposal、no-op identity 与 columnPinMenu 的 drag-out pin 分支保持不变。Core `columns` **17/17**，adapter column-drag 回归 React **51/51**、Vue **16/16**、Solid **27/27**、Svelte **10/10**；四端 typecheck 与定向测试通过。

2026-08-28：有效表格投影的 clipboard/range 写回继续下沉至 Core `reconcileProjectedRows`，统一 sorted/filtered/flattened rows 的 identity-key 映射、source index fallback 与 tree ancestor reconciliation；Vue/Solid/Svelte 删除重复的 visible-key/patch/reconcile 实现，React 保留其 `rowPatchKey` 的特殊 index-key fail-closed 合同。Core `table-projection` **3/3**，Vue paste/undo **12/12**、Solid **13/13**、Svelte **12/12**，四端 typecheck 与定向测试通过。

2026-08-28：pinned-boundary 的 delta→左 pinned prefix 与目标列更新计划继续下沉至 Core `pinnedCountFromDelta` / `computePinnedCountPlan`，统一 gapped pin 的 prefix-width 起点、count clamp、非法 count fail-closed 与 changed-column identity；React/Vue/Solid/Svelte 仅保留响应式/controlled callback wiring。Core `pinned-drag` **6/6**，adapter 回归 React **17/17**、Vue **3/3**、Solid **3/3**、Svelte **4/4**；四端 typecheck 与定向测试通过。

2026-08-28：表头选择状态投影继续下沉至 Core `computeSelectionFlags`，统一 visible keys 的 all/some/empty 语义，并允许 Vue 树级联注入 selected/indeterminate predicate；React/Vue/Solid/Svelte 删除重复 header checkbox flag 计算，保留各端受控同步与 toggle callback。Core selection **25/25**，表格回归 React **102/102**、Vue **81/81**、Solid **76/76**、Svelte **76/76**；四端 typecheck 与定向测试通过。

2026-08-28：表头排序状态投影继续下沉至 Core `resolveTableSortInfo`，统一单列/多列 active、direction 与 zero-based sequence 解析；React/Vue/Solid/Svelte 删除重复 `findIndex`/state 解析，适配器仍负责 aria、图标 DOM 与 callback。Core table-sort **7/7**，排序/表头回归 React **114/114**、Vue **111/111**、Solid **88/88**、Svelte **93/93**；四端 typecheck 与 Core build、定向 Prettier、`git diff --check` 通过。

2026-08-30：命名视图 snapshot 通道扩展（Svelte 切片）：Core `TableViewSnapshot` 仅新增可选便携字段 `multiSort`/`filters`/`filterValues`/`columnWidths`/`pageSize`/`expandedRowKeys`（`sort` 保留既有 null-clear 语义，旧 sort-only snapshot 继续有效，Core 保持零 DOM/框架依赖）；Svelte 命名视图 save 经 `capture` 采集当前实际拥有的通道（multiSort 按 `multiSort` 模式门控，filters/filterValues/columnWidths/expansion/pageSize 按既有 persistState 恢复门控采集），select 对存在字段经既有 Core feature setter/callback 回放、缺席字段不动，受控 prop 保持权威；columnVisibility/columnOrder 维持 persist 桥的既定 inert 合同。存储仅复用 `readTableViews`/`writeTableViews`，persistState 恢复顺序与代理首载行为不变。Core table-views **6/6**（新增），Svelte views 回归 **8/8** + table 定向 **76/76** + SSR **52**；Svelte typecheck/build/lint、hydration、Core build、定向 Prettier 与 `git diff --check` 通过。

2026-08-30：命名视图 snapshot 通道扩展（Vue/Solid 切片）：两端 controller 对齐 Svelte 的 `capture`/`applySnapshot` hooks，save/select 通过现有 sorting、filtering、column-width、expansion 与 proxy page-size owners；sort-only legacy snapshot、可选字段缺席 no-op、controlled authority 与 storage/corrupt fail-closed 保持不变。`columnVisibility`/`columnOrder` 在无 named-view owner 时继续不采集、不回放，DOM/SSR 仅增加适配器 wiring。Vue named-view **8/8**、Solid named-view **8/8**，Core build、两端 typecheck 与 focused tests 通过，未改 manifest 或 arch baseline。

2026-08-30：汇总/footer 数值投影继续下沉至 Core `projectTableSummary` / `projectTableSummaryCell`，统一 summary op、null/zero/numeric-string、aggregateAccuracy、空数据门控；四端仍由适配器提供 formula/dataIndex value bridge，并保留 custom render callback、remote page rows、group/pinned placement 与 DOM/SSR。Core `table-summary` **5/5**，React/Vue/Solid/Svelte 定向 summary/formula/group/pinned 回归均通过；未改 manifest/llms 或 ratchet baseline。

2026-08-30：命令/MCP 执行边界继续收口：`runMcpTool` 在调用前校验 required/unknown、primitive type、finite number 与 enum，disabled/unknown/异常 command 返回稳定失败结果；`toMcpTools` 与 planner 对 sanitized-name collision 使用确定性唯一别名，保持非冲突名称兼容。Core commands **20/20**，Core 全量 **131 files / 1,881 tests**，build/typecheck 通过。

2026-08-30：表格 body row-view 组装继续下沉至 Core `projectTableBodyRows`，统一 flat/tree 的 rowIndex 与 tree metadata 入口；四端保留过滤/排序输入、展开状态、lazy loading、grouping、DOM、事件和响应式。Core tree **5/5**，React/Vue/Solid/Svelte focused **44/44、29/29、68/68、61/61**；Core build/typecheck、适配器 build/typecheck/lint 与 `git diff --check` 通过。keyless tree 不新增未经契约证明的稳定身份语义。

2026-08-30：修正分页 `hasMore()` 的 total 优先级：定义的 `total` 先于 short-page heuristic 参与 paged offset/infinite accumulated count 判断，unknown-total exhaustion 与取消、stale、dispose 语义不变。Pagination **22/22**，adversarial review PASS，Core build/typecheck 与定向 Prettier 通过。

2026-08-30：Core virtualizer finite-input hardening：`createVirtualizer` 对 count、estimate、viewport/scroll/buffer/fixedSize、index 与 measure 做有限值/非负归一化；超大 finite count 在分配 size tree 前 fail-closed，Fenwick aggregate size capped，避免 NaN/Infinity/overflow 污染窗口状态。有效输入、零尺寸、stable-key/index-key、SSR 与既有 adapter API 保持不变；负小数 index 不再变成 0，非有限 measurement 不写 cache/tree。Core virtualizer **34/34**，全量 **131 files / 1,915 tests**，typecheck/build 通过，lint 0 errors / 8 complexity warnings；未改 adapter、manifest 或 arch baseline。

2026-08-31：Core `query-cache` 的可选 `maxEntries` 已完成容量 hardening；finite capacity 会先做 floor/clamp 归一化，再进入有界 LRU，`get/fetch/set/invalidate` 刷新 recency；`undefined` 与非有限值保持无限容量，SWR/default 行为不变；被驱逐、移除或清空的 in-flight generation 会被 orphan，late settle 不会污染随后重建的同 key entry；`maxEntries: 0` 时 cache 不保留 settled entry，但仍会去重同 key 的 in-flight fetch。

2026-08-31：Core 公共 barrel、row-edit、remote-table test 分解后均低于现有 ratchet baselines；React/Vue/Solid/Svelte 的主 Table 实现与主 Table 测试分解后也都低于各自现有 ratchet baselines。本批不改 public API；Svelte 修复 `useDataSource` initial-load `onMount` 与 same-id stale-blur identity，React 的 isomorphic layout effect 现覆盖 Table、grid virtual、`IrisVirtualScroll` 与 Select，并收口 pagination/table helper warnings，Vue 修复 resizer lifecycle 与 conditional DataSource `onMounted`。

2026-08-31：`ResilientFetcherOptions.maxEntries` 为 additive option，并直接透传 `QueryCacheOptions.maxEntries`；`undefined`、`NaN`、`+Infinity` 与 `-Infinity` 继续保持无限容量。

2026-08-31：最终 verified totals 为 Core **133 files / 1,922 tests**；React **273 files / 3,072 tests**；Vue **195 files / 1,749 tests**；Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）；Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）。Core + 四适配器 full suites 合计 **9,099 tests**。Core 与四个适配器 full tests/typecheck/build/lint 全部通过（Svelte `svelte-check` **0 errors / 0 warnings**）；`pnpm check:manifest` 报告每框架 **155 components**、tokens **86**，Core framework-import guard、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 均通过。非阻断输出仅剩既有 lint complexity warnings（**10** total：Core **8**、React **1**、Vue **1**）、arch ratchet **301** non-blocking warnings 与预期的 jsdom navigation / localStorage stderr；keyless-tree identity 仍受现有 public API 限制，不臆造稳定 identity。

每个迁移批次必须同时满足：

- 默认不开启时 DOM、事件顺序和包体字节无回归；
- feature 逻辑只在 core/plugin core，框架 import 检查为零；
- 同一能力的 props/methods/events/lifecycle 在同一目录；
- 主适配器文件净减行，不能以新 helper + 原逻辑双存；
- 缺失 feature 有明确能力探测，不放空方法；
- test/typecheck/lint/build、SSR、manifest 与 arch ratchet 通过。

## 2026-08-31 Grid Core resilience follow-up（当前工作树，已验证）

`ResilientFetcherOptions.maxEntries` 已按 additive 方式接入，并直接透传 `QueryCacheOptions.maxEntries`；focused resilient-fetcher 回归 **11/11** 覆盖 forwarded LRU eviction，以及 `undefined`、`NaN`、`±Infinity` 保持无限容量的兼容路径。

最终 adversarial pass 额外修复了 `maxEntries: 0` 时“新建 fetch entry 在并发同 key 调用共享 in-flight promise 前被过早驱逐”的竞态；zero-capacity cache 现仍去重 in-flight 调用，但不保留任何 settled entry，并已补齐回归覆盖。

Post-fix Core preflight **23 files / 262 tests** 与 Core full **133 files / 1,922 tests** 通过。

## 2026-08-31 Grid Core realtime tuning hardening（当前工作树，已验证）

`createReconnectingSource` 对非有限、负值和 fractional backoff/max-retry tuning 做确定性归一化，确保 delay/retry counter 为 finite/non-negative；有效/default 参数、`maxRetries: 0`、`factor: 0` 与 `maxBackoffMs < backoffMs` 语义保持。连接 generation、terminal `close()`、active-idempotent `open()`、唯一 reconnect timer、同步 connect/handler/teardown 异常和 SSR 无 DOM 依赖保持；补齐 `onStatus` reconnect throw 仍装载 timer、同步 `onOpen` throw 不丢 teardown 的竞态修复。Realtime **25/25**，Core 当前全量 **133 files / 1,930 tests**，Core typecheck/build/lint 通过（8 complexity warnings），adversarial review PASS；未改 adapter、manifest 或 arch baseline。

## 2026-08-31 Grid Core zero-capacity cache and durable outbox follow-up（当前工作树，已验证）

`query-cache` 的 `maxEntries: 0` 现在在 fetch、set、invalidate 路径都不保留 settled/orphaned entry，但仍保留同 key in-flight 去重；新增回归覆盖 in-flight 被 `set` 或 `invalidate` 替换后的容量边界。Durable outbox 的 `remove`/`clear` 仅在 storage commit 成功后标记 in-flight removal，持久化失败时仍排队的执行不会被误报为显式移除。Core focused **102/102**（query-cache 22、resilient-fetcher 11、data-source-resilient 19、outbox 16、virtualizer 34），Core 全量 **133 files / 1,924 tests**、build/typecheck 通过，lint **0 errors / 8 warnings**；定向 Prettier 与 `git diff --check` 通过。未改 public API、manifest 或 arch baseline。

## 2026-08-31 React Grid projected-row reconciliation follow-up（当前工作树，已验证）

React `IrisTable` 的 row patch reconciliation 现统一委托 Core `reconcileProjectedRows`；适配器继续保留 legacy `rowPatchKey` 的 `rowKey` / `rowId` / tree identity 解析，以及 index-key write-back 的 fail-closed 合同，不再重复维护可见投影 patch 合并循环。Delete 与 context-menu clear 在 sorted keyless `rowId` 视图上的 focused 回归已补齐，确认清空写回继续遵守旧契约。

本批未修改任何 Core source 文件。最终 review 未再发现 concrete regression；当前 verification 口径更新为 Core **133 files / 1,924 tests**、React **273 files / 3,074 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 / 1,147**；SSR **8 / 50**）、Svelte **168 files / 1,159 tests**（client **163 / 1,107**；SSR **5 / 52**），Core + 四适配器 full suites 合计 **9,103 tests**。

Gates：Core / React `typecheck`、build、lint 与受影响适配器 smoke / full checks 通过；targeted Prettier 与 `git diff --check` 通过。非阻断输出仅剩既有 lint complexity warnings（**10** total：Core **8**、React **1**、Vue **1**）、`pnpm arch-check:ratchet` **301** 条 non-blocking warnings、预期的测试环境 stderr（Node `ExperimentalWarning` localStorage；React 既有 jsdom navigation / `act(...)` / DOM nesting / list-key / intentional provider error logging），以及 keyless-tree identity 的 public API limitation。

## 2026-09-01 Grid Core projected-row hardening（当前工作树，已验证）

Core `reconcileProjectedRows` 的 flat path 继续补强：true no-op 现在保留原始
`sourceRows` 的 source-array identity，与树路径的 no-op 合同一致；duplicate-key
rows 的写回不再按 key 扇出，而是按各自唯一的 source slot 合并；duplicate row-object
identity 则整体 fail-closed，不猜测来源。Core `table-projection` 覆盖同步补齐
keyless sorted flat reconciliation、duplicate keys 与 duplicate row objects。

React `IrisTable` 的 row patch reconciliation 在上一批已统一委托该 helper，因此本切片无任何
adapter source 变更；Vue/Solid/Svelte 继续消费同一 Core 写回边界。

Post-fix verification totals 更新为 Core **133 files / 1,936 tests**；React **273 files /
3,074 tests**；Vue **195 files / 1,749 tests**；Solid **170 files / 1,197 tests**（client
**162 files / 1,147 tests**；SSR **8 files / 50 tests**）；Svelte **168 files / 1,159 tests**
（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）；Core + 四适配器 full
suites 合计 **9,115 tests**。Core 与受影响适配器的 full tests/typecheck/build/lint、
targeted Prettier、`git diff --check`、Core framework-import guard 与
`pnpm check:manifest`（每框架 **155 components**、tokens **86**）均通过。

同时，`packages/react/src/primitives/table/Table.tsx` 已压回当前 ratchet baseline：arch count
**9,137** 与 baseline **9,137** 持平；但 `pnpm arch-check:ratchet` 当前仍保留且仅保留 1 个
无关阻断项——`packages/core/src/realtime.test.ts` **547** 行，来自独立的 non-Grid 工作，
因此本批不宣称 ratchet 全绿。非阻断输出仅剩既有 lint complexity warnings（**10** total：Core
**8**、React **1**、Vue **1**）、arch ratchet **301** 条 non-blocking warnings、预期测试环境
stderr（Node `ExperimentalWarning` localStorage；React 既有 jsdom navigation / `act(...)` /
DOM nesting / list-key / intentional provider error logging）；keyless-tree identity 仍受现有
public API 限制，不臆造稳定 identity。

## 2026-09-01 Grid Core MCP and test-boundary follow-up（当前工作树，已验证）

MCP command boundary 继续 fail-closed：无效/空 sanitized tool name 不暴露或执行，malformed parameter definition 返回稳定失败；LLM planner 对模型填充的 args 复用同一参数校验，invalid args 回退 deterministic planner。commands focused **23/23**，未加入授权、确认、限流或 durable outbox。

`packages/core/src/realtime.test.ts` 已拆为主生命周期测试、connect-error 测试与共享 support helper；保留全部 **25** 个 realtime tests，不改 `realtime.ts` 或运行时契约，两个测试文件分别 **306/213** 行，均低于 500 行门槛。当前 Core full **134 files / 1,936 tests**；Core typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 arch baseline、manifest 或禁止目录。

## 2026-09-02 React Grid column-state handoff follow-up（当前工作树，定向已验证）

React `useGridColumns` 的 widths handoff 继续补强：bridge 现在维护最近一次 uncontrolled/`defaultWidths` snapshot。受控 `widths` 移除时会立即渲染并静默同步回该快照，因此非受控 → 受控 → 非受控不会泄漏旧的 controlled width map；若初始即受控，snapshot 也会从 `defaultWidths` 而不是 `options.widths` 种下，所以撤掉控制后稳定回退默认宽度。

对抗式复核同时发现 React-only 的 pinned handoff 也需要同样精度：`pinnedColumns` 从 controlled 回到 uncontrolled 时不再 blanket reset 到 `EMPTY_PINNED`，而是恢复最近一次 uncontrolled/default pinned snapshot，并保留显式 `null` unpin。该修正完全位于 React bridge；Core `columns` / `column-state` 契约未改，**无任何 Core source change**。

Focused regressions 已补到 `packages/react/src/grid/useGridColumns.test.tsx`：覆盖 uncontrolled → controlled → uncontrolled widths restore、initially controlled width removal → `defaultWidths` restore，以及 pinned `null` snapshot restore。相关列状态验证同时重跑 Core `packages/core/src/grid-columns.test.ts`，以及 React `packages/react/src/primitives/table/auto-resize-columns.test.tsx`、`packages/react/src/primitives/table/reset-column-widths.test.tsx`、`packages/react/src/primitives/table/test/pin-column-menu.test.tsx`、`packages/react/src/primitives/table/test/pinned-drag-controlled-reset.test.tsx`；React `typecheck`/build/lint、targeted Prettier 与 `git diff --check` 通过。

当前 verification ledger 更新为：Core **134 files / 1,941 tests**（当前 worktree 另含独立 MCP hardening）、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）、Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）；Core + 四适配器 full suites 合计 **9,121 tests**。本切片不宣称重跑全部包 gate；已确认的新增通过项限于上述 React/Core column surface。

同时，本切片验证时 `pnpm arch-check:ratchet` 仍被独立的 non-Grid commands 文件阻断；该阻断随后由下一切片的模块拆分解决。keyless-tree identity 仍受现有 public API 限制，不臆造稳定 identity。

## 2026-09-02 Grid Core remote-table hardening（当前工作树，已验证）

framework-free `createRemoteTableSource` 继续收口 remote params 的可变边界：`sort` / `sorts` / `filters` 现在会在初始 params 摄取、`setParams` 摄取、派生 state 投影以及对外 `query(...)` 交接时统一 clone。调用方持有的入参对象与 query 内被修改的对象因此不再别名污染 live remote-table state，但值与既有 public API 行为保持不变；复核范围内的 DataSource / pagination 合同无需其他 source 改动。

params / lifecycle / data-source / pagination focused 回归 **92/92** 通过。Core 当前 full verification 为 **136 files / 1,943 tests**；Core typecheck/build/lint 通过，lint 仅保留 **8** 条既有 warnings；targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过。

当前 worktree ledger 更新为：Core **136 files / 1,943 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）、Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）；Core + 四适配器合计 **9,123 tests**。这些 adapter totals 仅作为当前 worktree ledger 记录；本切片不宣称重跑了全部 adapter full suites。

## 2026-09-02 Grid Core host reentrancy hardening（当前工作树，已验证）

framework-free `packages/core/src/grid.ts` 的 capability host 继续补强 Phase 0 运行时边界：feature `setup()` 内若发生 reentrant `core.use()` / `core.ready()` / `core.destroy()`，外层 `use()` 失败现在会回滚该轮新增的全部 feature install（含嵌套 install）；失败后若实例尚未 destroy，则恢复进入 `use()` 前的 `status`，不再残留 reentrant `ready()` 造成的错误状态。若 `setup()` 中途已 destroy，host 会中止 `setup()` 之后的 methods/features 注册；rollback 也会跳过已移除 record，避免 double cleanup。该批只收口宿主实现，不改 public API、feature ordering 或既有 Phase 0–4 决策，Core 继续保持 framework-free。

Focused regressions 新增 `packages/core/src/grid.reentrancy.test.ts`，共 **3** 个 tests，覆盖上述 host reentrancy 路径；现有 `packages/core/src/grid.test.ts` 因已处于 **500** 行 arch ratchet 上限而保持不动。

当前 Core full verification 更新为 **138 files / 1,951 tests**；Core `typecheck` / build / lint、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过，lint 仅保留既有 warnings。当前 worktree ledger 为：Core **138 files / 1,951 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）、Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）；Core + 四适配器合计 **9,131 tests**。这些 adapter totals 仅作当前 ledger 记录，不表示本切片重跑了全部 adapter full suites。

## 2026-09-02 Grid Core cell-edit stale-async hardening（当前工作树，Core 已验证）

framework-free `packages/core/src/cell-edit.ts` 继续收口 cell-mode 的异步提交边界：当前编辑会话在 `setDraft(...)` 真正更换草稿值时会递增内部 session generation，因此上一份 draft 上已发出的晚到 async validation/commit 在 settle 时若 generation 已过期，就会直接 fail-closed。这样旧 draft 不会再被 stale promise 写回，也不会错误关闭后来仍处于打开状态的同一 cell session；public API、row-key 语义、rows `reason: 'cell-edit'` 事务和既有 adapter metadata 均保持不变。

回归已补到 `packages/core/src/grid-editing.test.ts`，专门覆盖“pending async commit 期间 draft 改变后，旧结果不得落盘或关会话”的路径。当前切片实测通过：Core `cell-edit` + `grid-editing` focused **28/28**、React `useGridEditing` smoke **2/2**、Vue `useGridEditing` smoke **1/1**。Solid/Svelte 的 focused `useGridEditing` 在该 runner 因缺少环境依赖未能启动，因此这里只记录未运行，不宣称其通过。

Core 当前 full verification 已更新为 **138 files / 1,953 tests**；Core build、typecheck、lint（**0 errors / 8 existing warnings**）、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过。当前 worktree ledger 为：Core **138 files / 1,953 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**（client **162 files / 1,147 tests**；SSR **8 files / 50 tests**）、Svelte **168 files / 1,159 tests**（client **163 files / 1,107 tests**；SSR **5 files / 52 tests**）；Core + 四适配器合计 **9,133 tests**。这些 adapter totals 仅作当前 ledger context，**不表示**本切片已全量重跑它们。

## 2026-09-01 Grid Core command-module decomposition（当前工作树，已验证）

保留 `@iris-ui-kit/core/commands` public entrypoint，将 command registry、MCP boundary、LLM planner 分拆为 `commands-registry.ts`、`commands-mcp.ts`、`commands-llm.ts`；public barrel `commands.ts` 仅 **37** 行，行为、导出、顺序与 SSR/framework-free contract 保持。原 `commands.test.ts` 拆为 registry/MCP/LLM 三组测试，分别 **73/332/121** 行；commands focused **28/28**，不删除或弱化覆盖。

Core 当前 full **136 files / 1,941 tests**；Core typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 arch baseline、manifest 或禁止目录。

## 2026-09-01 Grid Core remote-table boundary hardening（当前工作树，已验证）

`createRemoteTableSource` 现在在初始参数、`setParams`、派生 state 与 `options.query` handoff 边界复制 `sort`/`sorts`/`filters`，调用方或 query callback 修改传入对象不会隐式改写 controller state；旧参数、分页、signal/abort、latest-wins、resilient cache、destroy 与 SSR 语义保持。Remote-table/DataSource/pagination focused **92/92**；Core 当前 full **136 files / 1,943 tests**，typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-01 Grid Core DataSource ownership hardening（当前工作树，已验证）

DataSource 在 setter/build/query 边界复制 sort、multiSort、filters、filterRules；fetch result rows、optimistic mutation rows 与 selectedKeys 也不再与调用方/内部 canonical state 共享可变容器，保留 `FilterRule.value` identity 及既有 fetch/mutation API。修复 fetcher/query 外部修改污染 live state、fetch-owned rows 后续修改反写 state，以及 in-place optimistic mutation 破坏 rollback canonical rows 的问题，并新增 ownership/rollback 回归。

DataSource/resilient/outbox focused 回归通过；Core 当前 full **137 files / 1,948 tests**，typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-01 Grid Core feature-host reentrancy hardening（当前工作树，已验证）

Core Grid feature host 现在对 `setup()` 内 reentrant `use()`、`ready()`、`destroy()` 做事务式保护：失败时回滚嵌套安装、恢复此前 status、避免 destroy 后继续注册 methods/features，并跳过已清理记录以防重复 dispose。保留 feature 依赖拓扑排序、生命周期顺序、ready/destroy 幂等与既有 public API；新增 `grid.reentrancy.test.ts`，未改变 framework-free/SSR contract。Grid focused tests、Core typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过；Core 当前 full **137 files / 1,951 tests**。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-02 Grid Core selection and expansion controller hardening（当前工作树，已验证）

Selection multi-mode 的 `NaN`/SameValueZero 删除语义已修复：`deselect(NaN)` 与 `toggle(NaN)` 不再因 `!==` 留下已选 key；默认/受控 mirror、顺序、onChange、store/index freshness 与 `computeSelectionFlags` 合同保持。Expansion model 现在在 direct `store.setState()`、batch 与 reentrant subscriber 写入后惰性重建 membership index，并从实际 post-notify state 同步 commit；single/multiple、NaN/Infinity key、顺序与既有 API 保持。

Selection、tree-selection、expansion、grid-expansion 相关 focused 回归及 Core full 验证通过；Core 当前 **138 files / 1,957 tests**，typecheck/build/lint、`pnpm arch-check:ratchet`（**0 blockers**，仅既有 warnings）、targeted Prettier 与 `git diff --check` 通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-04 Grid Core tree projection write-back hardening（当前工作树，定向已验证）

`packages/core/src/table-projection.ts` 现在在 canonical tree 存在 duplicate row keys 或 repeated row-object identities 时，对 tree projection write-back fail-closed，避免 ambiguous branch update；`packages/core/src/table-projection.test.ts` 新增对应 regression。本批为 additive hardening，不引入 keyless-tree identity，也不改变 public API。

Runner validations：Core build/typecheck passed；Core focused `table-projection` / grid rows / clipboard tests **41/41** passed；React focused tests/typecheck/build/lint passed；Vue bridge test/lint passed，但 broader Vue checks 因缺少 workspace theme dependencies 被阻断；Solid typecheck/lint passed，tests/build 因缺少 `vite-plugin-solid` / `tsup` 被阻断；Svelte lint passed，tests/typecheck/build 因缺少 Svelte tooling 被阻断。Targeted Prettier、framework-free import guard 与 `git diff --check` passed。本批不宣称 full adapter reruns。

## 2026-09-05 Grid Core virtualizer window hardening（当前工作树，已验证）

`packages/core/src/virtualizer.ts` 修正 fixed-size window calculation：部分可见的首行现在会被纳入窗口；例如 count 10、size 20、viewport 20、scroll 10 时，indices 为 **[0, 1]**。`packages/core/src/virtualizer.test.ts` 新增上述 regression，并补充 invalid/fractional controls、huge counts、non-finite sizes 与 aggregate overflow 的 edge-case coverage。

Pagination、sorting、filtering 与 range audit 未发现有证据支持的 defect（no evidence-backed defect）。本批不改变 public API 或 keyless-tree identity semantics。

验证：Core build/typecheck passed；Core focused **112** tests passed；本切片后 Core full suite **138 files / 1,958 tests** passed；React/Vue focused adapter tests passed；React/Solid typecheck passed；Prettier、framework-free import guard、`git diff --check` 与 `pnpm arch-check:ratchet` passed。Solid tests/build 因缺少 `vite-plugin-solid` 被阻断；Svelte tests/typecheck/build 因缺少 tooling 被阻断；Vue typecheck 因缺少 workspace theme/tokens/icons/skins declarations 被阻断。本批不宣称 full adapter reruns。

当前 ledger context：Core **138 files / 1,958 tests**、React **273 files / 3,075 tests**、Vue **195 files / 1,749 tests**、Solid **170 files / 1,197 tests**、Svelte **168 files / 1,159 tests**，total **9,138**；adapter totals 仅作 ledger context，不表示本切片已全量重跑。

## 2026-09-05 Grid Core roving-navigation finite-input hardening（当前工作树，已验证）

Core `roving` 导航数学现在对 NaN/Infinity/负值/fractional count 与 index fail-closed，避免全 disabled 或 infinite count 非终止；`nextGridCell` 的 invalid cell/pageSize 与 PageUp/PageDown disabled-target fallback 也保持确定性。保留 valid-input 的 loop/non-loop、Home/End、typeahead wrap/case/trim、same-row/column 与 public API 语义；无 DOM/框架依赖。

Roving focused **23**、Core keyboard/grid focused **136**、React table keyboard focused **90**；Core 当前 full **138 files / 1,965 tests**，typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core formula malformed-row hardening（当前工作树，已验证）

`packages/core/src/formula.ts` 现在安全拒绝 `null` 与非 object row；`evaluateFormula`（例如 `evaluateFormula("price", null)`）遇到 malformed row 时 fail-closed 返回 `null`，不再抛异常。`packages/core/src/formula.test.ts` 新增 malformed-row regression coverage。本批不改变 public API 或 keyless-tree identity semantics。

Core build passed；Core focused formula/table-value tests **75 passed**；React formula tests **27 passed**；targeted Prettier、framework-free import guard 与 `git diff --check` passed。Vue focused formula checks 因缺少 `@iris-ui-kit/theme` 被阻断；Solid focused formula checks 因缺少 `vite-plugin-solid` 被阻断；Svelte focused formula checks 因缺少 Vitest module 被阻断。共享 worktree 中观察到的当前 Core full run 为 **138 files / 1,965 tests**；该计数不表示全部属于本 formula slice，也不表示本批重跑了完整 adapter suites。

## 2026-09-05 React Grid column-state handoff hardening（当前工作树，定向已验证）

`packages/react/src/grid/useGridColumns.ts` 现在跟踪最近一次 uncontrolled order snapshot；移除受控 `order` 后，bridge 会恢复该 snapshot，而不是暴露被 Core 拒绝的 optimistic order。`packages/react/src/grid/useGridColumns.test.tsx` 新增对应 regression，并补充 width/order/pin handoff coverage。本切片未修改任何 Core source 文件，也未改变 public API 或 keyless-tree identity semantics。

验证：Core focused tests **47/47**、React column tests **45/45**、React typecheck、targeted Prettier、Core framework-free import guard 与 `git diff --check` 通过。Vue focused tests 因现有缺失依赖 `@iris-ui-kit/theme` 被阻断；Solid focused tests 因现有缺失依赖 `vite-plugin-solid` 被阻断；Svelte focused tests 因缺少 `vitest` module 被阻断。Full adapter suites 未重跑。

## 2026-09-05 Grid Core clipboard and sort/filter boundary hardening（当前工作树，已验证）

Clipboard Core 对 multi-cell overflow into empty grid、malformed `setValue`/`overflowRows`/`reconcileRows` 输出与 direct serializer coordinates fail-closed；HTML copy 增加 formula-injection safety，保留 TSV-only paste、adapter-owned I/O 与既有 API。Table sort/filter Core 现在对 NaN/Infinity、malformed sort/filter channels、异常 filter method 与 comparator result 做确定性 fail-closed；稳定 tie、多排序优先级、identity no-op、resolver contract 与有效输入行为保持。

Core 当前 full **138 files / 1,975 tests**；clipboard/range、sort/filter、typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core summary/aggregate finite-input hardening（当前工作树，已验证）

Summary/aggregate Core 对 malformed operation/column/spec/value callback/raw coercion 做 fail-closed；finite extreme values 的 avg 不再溢出，min/max 不再因超大输入触发 spread `RangeError`，fractional/non-finite `aggregateAccuracy` 不再误四舍五入。保留空数据默认值、count/null/zero/numeric-string 语义、排序与重复/未知列行为、adapter value resolver/custom render contract 及 framework-free/SSR 行为。

Summary/aggregate focused **62**、Core 当前 full **138 files / 1,984 tests**；typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core table-summary/aggregate hardening follow-up（当前工作树，已验证）

`packages/core/src/data-view/aggregate.ts` 与 `packages/core/src/table-summary.ts` 现在校验 malformed aggregate operations/specs/columns/callback inputs，safely coerce finite values，避免 average overflow 与 spread-based min/max `RangeError`，并拒绝 fractional/non-finite `aggregateAccuracy`。

`packages/core/src/table-summary.test.ts` 与 `packages/core/src/data-view-filterable.test.ts` 含有对应 regression coverage；valid empty/default、count、ordering、duplicate/unknown-column、callback-exception、no-mutation 与 adapter value-resolution semantics 保持不变。

验证：summary/aggregate focused **62** tests passed；当前 Core full run **1,984** tests passed；Core typecheck/build passed；lint passed with unrelated existing warnings；`git diff --check` 与 `pnpm arch-check:ratchet` passed。本切片不宣称 adapter tests 或 full adapter reruns；未修改 adapters、public API、keyless-tree identity semantics、manifests 或 prohibited files。

## 2026-09-05 Grid Core tree mutation hardening and ratchet split（当前工作树，定向已验证）

`packages/core/src/grid-tree-rows.ts` 与 `packages/core/src/grid-tree-children.ts` 现在在 keyed update/remove/child hydration 前 fail-closed：当可达树结构含 duplicate keys 或 repeated/cyclic row-object identity 时不写回；没有臆造 keyless identity。validation helper 仅为满足 arch ratchet、将 `grid-tree-rows.ts` 保持在 **478** 行而移至新文件 `packages/core/src/grid-tree-validation.ts`，public exports 与 runtime semantics unchanged。回归位于 `packages/core/src/grid-tree-rows.audit.test.ts`。

验证：Core build、focused tree tests（**2 files / 3 tests**）、Core typecheck、targeted Prettier、framework-free import guard、`git diff --check` 与 `pnpm arch-check:ratchet` 均通过；ratchet 仅有 non-blocking warnings。Vue/Solid/Svelte tree tests 因既有缺失 workspace dependencies 被阻断；本切片不宣称 full adapter reruns。

## 2026-09-05 Grid Core clipboard/range callback hardening（当前工作树，已验证）

Clipboard/range Core 现在截断 fractional coordinates、忽略 non-finite updates，避免 overflow auto-ID collision；callback row/snapshot、malformed `setValue`/`overflowRows`/`reconcileRows`、partial/empty range 与 serializer 输入均 fail-closed。HTML formula safety 保持，TSV-only paste 与 adapter-owned clipboard I/O 不变。保留 valid-input 的 range、editable/formula、transaction metadata、no-op identity 与 public API contract，并新增 focused hardening coverage。

Core 当前 full **140 files / 1,990 tests**；Core typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core keyboard/editing lifecycle hardening（当前工作树，定向已验证）

`packages/core/src/keyboard-nav.ts` 现在会归一化无效的 count/index，并在选中前拒绝越界或 disabled 的 `initialIndex`；对应回归已补到 `packages/core/src/keyboard-nav.test.ts`。`packages/core/src/grid-editing.ts` 现在会在 dispose 后抑制异步校验回调，`packages/core/src/grid-editing.test.ts` 新增 disposal coverage。既有 public API 与 keyless-tree identity semantics 保持不变。

验证：Core build/typecheck passed；Core focused keyboard/editing tests **95 passed**；React、Vue、Solid、Svelte bridge/table checks passed；targeted Prettier、framework-free import guard 与 `git diff --check` passed。React advanced suite 的 Vitest worker 出现 `onTaskUpdate` timeout，但 tests 已通过，focused React checks clean；本条不宣称 full adapter reruns。当前 shared-worktree context 中观察到 Core full run 为 **140 files / 1,993 tests**；该计数仅表示当前 shared-worktree context，并非可全部归因于本 slice。

## 2026-09-05 Grid Core tree-selection cascade hardening（当前工作树，已验证）

Tree selection 对 unknown/empty/disabled 操作现在 fail-closed，不再为 no-op 触发通知；disabled branch 从 ancestor cascade 排除，duplicate flat definitions 使用 first-definition-wins，nodes snapshot 不受调用方后续 mutation 影响。保留 branch checked/indeterminate 派生、leaf ordering、cycles/duplicate guards、NaN/Infinity/0 keys、reentrant store 与 framework-free/SSR contract，并新增 focused regression coverage。

Tree-selection focused **17**、Core grid/tree focused **25**、React/Vue/Solid/Svelte tree checks **47/41/38/32**；Core 当前 full **140 files / 2,000 tests**，typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-05 Grid Core selection/expansion lifecycle hardening（当前工作树，定向已验证）

`packages/core/src/selection.ts` 与 `packages/core/src/expansion.ts` 现在会在 store/callback 通知前检测有效的 SameValueZero no-op；`packages/core/src/grid-selection.ts` 与 `packages/core/src/grid-expansion.ts` 在 Core dispose 后抑制 callback。`packages/core/src/selection.test.ts`、`packages/core/src/expansion.test.ts` 与 `packages/core/src/grid.test.ts` 新增对应 regression。既有 public API 与 keyless-tree identity semantics 保持不变。

验证：Core build passed；Core focused tests **95 passed**；React bridge/lazy tests passed；Vue/Solid bridge tests passed；Solid/Svelte lazy tests passed；Core/React/Vue/Solid/Svelte typechecks passed；targeted ESLint/Prettier、framework-free import guard 与 `git diff --check` passed。Vue lazy-tree test 在 **120s** 超时；该 timeout 未产生 source changes。本批不宣称 full adapter reruns。

## 2026-09-05 Grid Core test ratchet split（当前工作树，已验证）

这是仅限测试的结构清理：`packages/core/src/grid.test.ts` 从 **521** 行拆为 **339** 行；新增 `packages/core/src/grid-selection-expansion.test.ts` **118** 行与 `packages/core/src/grid-sorting.test.ts` **69** 行。全部 **20** 个 Grid tests 均保留；3 个文件 / **20** 个 focused tests passed。未修改 `grid.ts`、feature source、public API 或 runtime behavior。

验证：Core full suite **142 files / 2,005 tests**；Core typecheck/build/lint（**0 errors / 9 existing warnings**）、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 均通过。本批不宣称 full adapter reruns。

## 2026-09-05 Grid Core resilience and test-boundary follow-up（当前工作树，已验证）

`circuit-breaker` 的 half-open 状态现在只允许一个 trial in flight，避免并发请求同时穿过半开门；query-cache/resilient-fetcher 的 TTL/SWR、LRU、generation、zero-capacity 与既有默认语义保持。Grid selection/expansion 对 SameValueZero no-op 与 Core dispose 后 callback 做保护；`grid.test.ts` 按 host、selection/expansion、sorting 拆分，原有 **20** 个 Grid tests 全部保留，文件均低于 500 行门槛。

当前 Core full **142 files / 2,005 tests**；resilience focused **78**、Grid focused **20**，Core typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet`（**0 blockers**）通过。未改 adapter、manifest、arch baseline 或禁止目录。

## 2026-09-06 Grid Core sort/filter bridge hardening（当前工作树，定向已验证）

`packages/core/src/grid-sorting.ts` 现在对语义等价的 fresh-object sort/multi-sort setters 抑制 callbacks/events 与不必要的 store writes；`packages/core/src/grid-filtering.ts` 增加等价的 no-op guards，并使 clear 保持 atomic，只通知实际发生变化的 channels。回归位于 `packages/core/src/grid-state.test.ts` 与 `packages/core/src/grid-sorting.test.ts`。未改变 keyless-tree identity 或 public API semantics。

验证：Core build passed；Core focused tests **30 passed**；React focused tests **38 passed**；React/Vue/Solid/Svelte typechecks passed；targeted Prettier、framework-free import guard 与 `git diff --check` passed。更广的 adapter filter-panel suites 存在既有 **5-second timeouts**；未修改 adapter source，也未运行 full adapter reruns。

## 2026-09-06 Grid Core range/clipboard hardening（当前工作树，已验证）

`packages/core/src/grid-clipboard.ts` 现在将 paste callback/event row snapshots 与 custom `setRows` bindings 隔离；`packages/core/src/range-stats.ts` 对 Symbol 等无法 coercion 的值按 non-numeric 处理，不再抛异常。回归覆盖位于 `packages/core/src/grid-range-clipboard.test.ts` 与 `packages/core/src/range-stats.test.ts`。

保留 shallow nested-row semantics；未修改 adapter、public API 或 keyless-tree identity semantics。

验证：Core build passed；Core focused tests **44 passed**；React/Vue/Solid/Svelte range/clipboard tests passed；React/Vue/Solid/Svelte SSR tests passed；targeted Prettier、framework-free import guard 与 `git diff --check` passed。本批不宣称 full adapter reruns。

## 2026-09-06 Grid Core flat row transaction hardening（当前工作树，已验证）

- `packages/core/src/grid-rows.ts` 现在将“同长度且所有 row 引用均未变化”的数组视为 `commit`/`loadData` no-op，避免 replacement store write/notification/transaction；`packages/core/src/grid-rows.test.ts` 新增 regression coverage。
- 未修改 adapter、public API 或 keyless-tree identity semantics。`packages/core/src/grid-rows-lazy.ts` 不存在；lazy behavior 仍位于现有 tree-child/adapter paths。
- 验证：Core build/typecheck passed；focused Core tests **54 passed**；React bridge **10 passed**、Vue bridge **3 passed**、Solid bridge **3 passed**、Svelte bridge **3 passed**；lazy tests React **14 passed**、Vue **7 passed**、Solid **10 passed**、Svelte **14 passed**；targeted Prettier、framework-free import guard 与 `git diff --check` passed。
- Vue parity file 有 **3** 个 unrelated filter-test timeouts，但 lazy tests passed；本条不宣称 full adapter reruns。

## 2026-09-06 Grid Core layout/span/responsive hardening（当前工作树，定向已验证）

`packages/core/src/responsive.ts` 现在在 responsive tail hiding 期间快照 pinned-column 结果，因此 malformed/re-entrant pin callbacks 不会被重复调用并抛错；`packages/core/src/grid-span.ts` 将 fractional spans 归一化为正的 CSS Grid 整数。回归位于 `packages/core/src/responsive.test.ts` 与 `packages/core/src/grid-span.test.ts`。

layout/width/column virtual/fade helpers 审计未发现其他有证据支持的 defect。未修改 adapter source、public API 或 keyless-tree identity semantics。

验证：Core build/typecheck passed；Core focused tests **47 passed**；React/Vue/Solid/Svelte layout、virtualization、span、pinned、responsive 与 SSR-focused tests passed；四个适配器 typechecks passed；Svelte check **0 errors / 0 warnings**；targeted Prettier、framework-free import guard 与 `git diff --check` passed。Full repository suite 与 dedicated RTL table tests 仍在本次 focused audit 范围之外；本批不宣称 full adapter reruns。

## 2026-09-06 Iris Core lifecycle, data-boundary, and pure utility hardening（当前工作树，已验证）

Core outbox 修复 `__proto__` payload、duplicate/malformed persisted metadata、reentrant subscriber ordering 与 storage-save-after-resolve bookkeeping；pagination、ResourceController、query parser、path、table export、column、i18n、nav、date/responsive utilities 完成对应的 malformed input、ownership、cycle、finite-value 与 lifecycle fail-closed hardening。保留 legacy closure/in-memory outbox、pagination omitted-mode append、现有 query grammar、path/date/local-time、export byte compatibility、Grid/adapter ownership 与 framework-free/SSR 语义；未引入 cursor pagination、授权或宽泛重构。

最近验证：outbox focused **39**、pagination **28**、resource/DataSource **79**、query-parser **49**、path **71**、table-export **37**、columns/column-type **36**、i18n **25**、nav **40**、date/responsive **35**（DST **17**）；Core full **142 files / 2,079 tests**，typecheck/build/lint、targeted Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过（仅既有 warnings）。Grid clipboard source ratchet split 后 `grid-clipboard.ts` **401** 行、helper **117** 行，public exports/behavior unchanged。未修改 adapters、manifest/llms、arch baseline 或禁止目录。

## 2026-09-06 Grid/Core form, plugin, and controller hardening（当前工作树，已验证）

Form Core 收口验证/提交的 reentrant lifecycle、snapshot ownership、prototype-sensitive fields、nested array planning、draft hydrate/serialize 与 fractional index/step；Undo stack 归一化 history limit，plugin runtime 修复 lazy/eager last-wins、partial install cleanup、duplicate dependency ordering 与 registry prototype safety。Grid Core 收口 rows transaction reentrancy/ownership、NaN key 与 index normalization、tree removal fail-closed、column-state no-op/width/pin validation、pagination no-op/disposal；layout/span/responsive 边界保持 framework-free。

最近验证：form focused **180**、undo/event-bus **39**、plugin **76**、Grid columns **13**、Grid pagination **22**、Grid rows/tree **64**；Core full **145 files / 2,131 tests**，typecheck/build/lint、Prettier、`git diff --check` 与 `pnpm arch-check:ratchet` 通过（仅既有 warnings）。未修改 adapters、manifest/llms、arch baseline 或禁止目录。

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

## 9. 明确不做

- 不引入依赖注入容器、装饰器或反射 metadata；
- 不支持 feature 修改其他 feature 的私有状态；
- 不引入全局 Grid module registry；
- 不把 render function 注册进框架无关 core；
- 不一次重写四个适配器；
- 不在完成迁移前删除 legacy props 和 `IrisTableHandle`。
