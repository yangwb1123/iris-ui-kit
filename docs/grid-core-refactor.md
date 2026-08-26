# Grid Core + Feature 重构设计

> 状态：Phase 0–3 已实现（2026-08-24，含四框架 cell-mode、排序与过滤续批）。本文是后续 Grid 重构的真相源；
> `docs/vxe-grid-comparison.md` 继续记录功能覆盖，不再作为架构设计文档。

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

### Phase 4 — rows mutation boundary（进行中）

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
10/10、React Grid/clipboard 定向 51/51 通过，四框架 typecheck 通过。

## 8. 合并门

每个迁移批次必须同时满足：

- 默认不开启时 DOM、事件顺序和包体字节无回归；
- feature 逻辑只在 core/plugin core，框架 import 检查为零；
- 同一能力的 props/methods/events/lifecycle 在同一目录；
- 主适配器文件净减行，不能以新 helper + 原逻辑双存；
- 缺失 feature 有明确能力探测，不放空方法；
- test/typecheck/lint/build、SSR、manifest 与 arch ratchet 通过。

## 9. 明确不做

- 不引入依赖注入容器、装饰器或反射 metadata；
- 不支持 feature 修改其他 feature 的私有状态；
- 不引入全局 Grid module registry；
- 不把 render function 注册进框架无关 core；
- 不一次重写四个适配器；
- 不在完成迁移前删除 legacy props 和 `IrisTableHandle`。
