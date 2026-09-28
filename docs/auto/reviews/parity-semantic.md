## 基线

已阅读 `AGENTS.md`，并运行：

```text
pnpm check:parity:print
5 identical · 8 near · 139 divergent · mean 44% shared
prop declarations: React 1264、Vue 845、Solid 1173、Svelte 1205
```

以下按严重度排序；未将纯框架命名差异单独算作问题。

## 发现

### 1. **P0 — `IrisTable` 的 current-row 能力仅 React 可用**

- **证据：** React 声明并渲染 `currentRowKey`：`packages/react/src/primitives/table/props/layout.ts:48-62`、`packages/react/src/primitives/table/Table.tsx:6361-6369`；Vue 仅有 `rowClick`：`packages/vue/src/primitives/table/props.ts:186-187`，行渲染无 current 标记：`packages/vue/src/primitives/table/table-body-row.ts:414-419`；Solid：`packages/solid/src/primitives/table/props.ts:194-200`、`packages/solid/src/primitives/table/table-body-row.tsx:141-150`；Svelte：`packages/svelte/src/primitives/table/props.ts:184-189`、`packages/svelte/src/primitives/table/TableBodyRow.svelte:157-165`。
- **症状：** React 可受控高亮当前行并监听/否决变更，其他三端无法表达同一契约。
- **最小修复：** 四端统一 `currentRowKey`、`onCurrentRowChange`、`beforeCurrentRowChange`，并统一 `data-iris-row-current` 与样式。
- **测试：** 四端渲染两行，切换受控 key、点击回调、返回 `false` 阻止切换。

### 2. **P0 — React `IrisRadio` 不支持 standalone，其他三端支持**

- **证据：** React 无组直接抛错：`packages/react/src/primitives/radio/Radio.tsx:21-30`；Vue standalone 分支：`packages/vue/src/primitives/radio/Radio.ts:102-120`、`152-155`；Solid：`packages/solid/src/primitives/radio/IrisRadio.tsx:83-115`、`122-125`；Svelte：`packages/svelte/src/primitives/radio/IrisRadio.svelte:24-29`、`41-44`。
- **症状：** 同样的单选按钮在 React 必须包裹 `IrisRadioGroup`，否则运行时失败。
- **最小修复：** React 无 context 时走本地受控/非受控状态，并提供对应 `checked/defaultChecked/onChange` 契约。
- **测试：** React 不包裹 group，点击后验证状态和回调；同时保留 group 模式测试。

### 3. **P0 — Vue `IrisDragger` 的非受控拖动不会移动**

- **证据：** React 本地更新 `internal`：`packages/react/src/primitives/dragger/Dragger.tsx:51-53`、`78-84`；Vue 仅 emit `update:modelValue`：`packages/vue/src/primitives/dragger/Dragger.ts:23-37`、`54-67`；Solid 本地 signal：`packages/solid/src/primitives/dragger/IrisDragger.tsx:37-49`；Svelte 本地 state：`packages/svelte/src/primitives/dragger/IrisDragger.svelte:38-47`。
- **症状：** Vue 不绑定并回写 `v-model` 时，拖动事件触发但 transform 始终停在初始位置。
- **最小修复：** Vue 增加内部 position；有 `modelValue` 时受控，否则更新内部 ref。
- **测试：** 不回写 `update:modelValue` 的 Vue 拖动测试，验证 transform 改变。

### 4. **P0 — `IrisMenuItem` 的 keep-open 能力 Vue/Svelte 缺失**

- **证据：** React `keepOpen`：`packages/react/src/primitives/menu/MenuItem.tsx:6-10`、`26-30`；Vue 始终 `closeRoot()`：`packages/vue/src/primitives/menu/MenuItem.ts:25-29`；Solid 有反向命名 `closeOnSelect`：`packages/solid/src/primitives/menu/IrisMenuItem.tsx:5-23`；Svelte 无关闭控制且始终关闭：`packages/svelte/src/primitives/menu/IrisMenuItem.svelte:5-19`。
- **症状：** 子操作菜单在 React 可保持打开，Vue/Svelte 选择后必定关闭。
- **最小修复：** 统一一个 prop（建议 `closeOnSelect` 或 `keepOpen`），并统一 click/Enter/Space 行为。
- **测试：** 根菜单和嵌套菜单分别测试点击、键盘选择及保持打开。

### 5. **P0 — Solid `IrisTimeline` 缺少每项自定义渲染**

- **证据：** React `renderItem`：`packages/react/src/primitives/timeline/Timeline.tsx:18-23`、`105-107`；Vue `#item` slot：`packages/vue/src/primitives/timeline/Timeline.ts:103-111`；Solid props 无对应能力且始终渲染默认字段：`packages/solid/src/primitives/timeline/IrisTimeline.tsx:18-24`、`92-112`；Svelte 有 `itemSnippet`：`packages/svelte/src/primitives/timeline/IrisTimeline.svelte:15-22`、`58-64`。
- **症状：** Solid 无法为单个时间线项插入图标、按钮或富文本结构。
- **最小修复：** 增加 `renderItem(item, index)`，或统一为 Solid 可用的 item snippet。
- **测试：** 四端传入自定义节点，验证默认 time/title/description 被替换。

### 6. **P0 — Solid `IrisList` 不触发 item-level `onSelect`**

- **证据：** React 声明并调用：`packages/react/src/primitives/list/List.tsx:20-27`、`195-200`；Vue emit `select`：`packages/vue/src/primitives/list/List.ts:55-59`、`96-110`；Solid 明确排除 `onSelect` 且 `select()` 无 item 回调：`packages/solid/src/primitives/list/IrisList.tsx:13-25`、`97-102`；Svelte 声明并调用：`packages/svelte/src/primitives/list/IrisList.svelte:24-35`、`147-152`。
- **症状：** Solid 只能拿到值变更，无法直接获得被选中的完整 item。
- **最小修复：** Solid 增加 `onSelect(item)`，在鼠标和键盘选择路径统一调用。
- **测试：** 点击和 Enter/Space 均回调 item；disabled item 不回调。

### 7. **P1 — Vue Popover 无法关闭自动聚焦/恢复焦点**

- **证据：** React 提供并判断两个开关：`packages/react/src/primitives/popover/PopoverContent.tsx:12-18`、`70-83`；Vue props 只有 `teleport` 且无条件 focus：`packages/vue/src/primitives/popover/PopoverContent.ts:28-34`、`68-78`；Solid：`packages/solid/src/primitives/popover/IrisPopoverContent.tsx:9-15`、`51-58`；Svelte：`packages/svelte/src/primitives/popover/IrisPopoverContent.svelte:9-14`、`33-40`。
- **症状：** Vue 用户无法表达 `autoFocus=false` 或 `restoreFocus=false`。
- **最小修复：** Vue 添加两个 Boolean props，并在 focus watcher 中加条件。
- **测试：** 分别验证关闭两个选项后打开/关闭不会抢焦点或恢复焦点。

### 8. **P1 — Breadcrumb 最后一项的 current 语义不一致**

- **证据：** React 自动 clone 最后一项：`packages/react/src/primitives/breadcrumb/Breadcrumb.tsx:46-52`；Vue 同样注入 `isCurrent`：`packages/vue/src/primitives/breadcrumb/Breadcrumb.ts:48-63`；Solid 明确要求手动 `current`：`packages/solid/src/primitives/breadcrumb/Breadcrumb.tsx:14-18`、`packages/solid/src/primitives/breadcrumb/BreadcrumbItem.tsx:5-32`；Svelte 也只消费显式 `current`：`packages/svelte/src/primitives/breadcrumb/Breadcrumb.svelte:24-25`、`packages/svelte/src/primitives/breadcrumb/BreadcrumbItem.svelte:5-25`。
- **症状：** 相同的最后一个带 `href` crumb，React/Vue 变成普通文本并带 `aria-current`，Solid/Svelte 仍是链接。
- **最小修复：** 四端统一自动标记，或统一要求显式 `current` 并移除 React/Vue 的隐式行为。
- **测试：** 最后一项带 `href` 时四端 DOM 类型、`aria-current` 一致。

### 9. **P1 — `IrisEmptyState.children` 的位置语义四端不同**

- **证据：** React children 作为 description fallback：`packages/react/src/primitives/empty-state/EmptyState.tsx:5-12`、`69-79`；Vue 只消费 named slots，不消费 default slot：`packages/vue/src/primitives/empty-state/EmptyState.ts:15-20`；Solid children 被渲染成 title：`packages/solid/src/primitives/empty-state/IrisEmptyState.tsx:63-69`；Svelte children 被追加到 action 后：`packages/svelte/src/primitives/empty-state/IrisEmptyState.svelte:49-66`。
- **症状：** 同样传入 children，在 Vue 消失、React 成 description、Solid 成 title、Svelte 成额外尾部内容。
- **最小修复：** 明确定义 children 的统一语义（建议作为 description fallback），或从三端公开类型移除 children，统一使用 `title/description/action`。
- **测试：** 只传 children，断言四端均落在同一个 `data-iris-empty-state-*` 区域。

### 10. **P1 — Tour 步骤指示器未统一走 i18n**

- **证据：** React：`packages/react/src/primitives/tour/Tour.tsx:201-205`；Vue：`packages/vue/src/primitives/tour/Tour.ts:209-214`；Solid 直接输出 `1 / n`：`packages/solid/src/primitives/tour/IrisTour.tsx:232-237`；Svelte 同样硬编码：`packages/svelte/src/primitives/tour/IrisTour.svelte:155-160`。
- **症状：** React/Vue 显示本地化的 “Step 1 of 3”，Solid/Svelte 始终显示英文格式 `1 / 3`。
- **最小修复：** Solid/Svelte 使用 `t('tour.step', { current, total })`。
- **测试：** 切换默认语言和 `zh-CN`，验证 indicator 文案一致。

### 11. **P1 — `IrisList` 的 SWR 状态策略仅 Vue 生效**

- **证据：** React 未传 `hasContent`：`packages/react/src/primitives/list/List.tsx:133-137`；Vue 传入 `hasContent`：`packages/vue/src/primitives/list/List.ts:61-68`；Solid 未传：`packages/solid/src/primitives/list/IrisList.tsx:61-65`；Svelte 手动计算状态且无 SWR 分支：`packages/svelte/src/primitives/list/IrisList.svelte:103-108`。
- **症状：** 已有 items 时进入 loading，Vue 保留内容进行后台刷新，其他三端切换成 loading 状态。
- **最小修复：** 四端统一向 core `resolveDataState` 传入 `hasContent: items.length > 0`，或移除 Vue 的特殊策略。
- **测试：** 非空列表从 content 切换 loading/error，验证四端是否都保留或都替换内容。

### 12. **P1 — Menu content 的 DOM 标记跨端不同**

- **证据：** React：`packages/react/src/primitives/menu/MenuContent.tsx:116-124` 使用 `data-iris-menu`；Vue：`packages/vue/src/primitives/menu/MenuContent.ts:104-114` 同样使用 `data-iris-menu`；Solid：`packages/solid/src/primitives/menu/IrisMenuContent.tsx:86-94` 使用 `data-iris-menu-content`；Svelte：`packages/svelte/src/primitives/menu/IrisMenuContent.svelte:94-102` 使用 `data-iris-menu-content`。
- **症状：** 跨框架测试、自动化或外部选择器使用其中一个标记时，另一半适配器找不到菜单。
- **最小修复：** 统一 canonical marker，或短期同时输出两个兼容标记。
- **测试：** 四端分别查询两个 selector，确认兼容策略一致。

## 核对后可接受的高 asymmetry

- **`IrisToggleGroupItem`（asymmetry 5）**：React 依赖原生 button attributes，Vue/Solid/Svelte 显式声明 props；但四端均完成注册、选中态、禁用态、ARIA 和键盘导航。证据：`packages/react/src/primitives/toggle-group/ToggleGroupItem.tsx:17-28,77-85`、`packages/vue/src/primitives/toggle-group/ToggleGroupItem.ts:39-60,75-95`、`packages/solid/src/primitives/toggle-group/IrisToggleGroup.tsx:185-211,239-262`、`packages/svelte/src/primitives/toggle-group/IrisToggleGroupItem.svelte:4-16,43-83`。
- **图表族 `IrisMultiLineChart` / `IrisStackedBarChart` / `IrisDonutChart`**：asymmetry 主要来自 React/Solid 的 `MultiChartBaseProps` 继承与 Vue/Svelte 的显式列举；四端均使用同一 core geometry、SVG datum、ARIA 和 focus tooltip。证据：`packages/plugin-charts/src/react/multi.tsx:51-94,165-193,252-273`、`packages/plugin-charts/src/vue/multi.ts:64-87,192-214,276-304`、`packages/plugin-charts/src/solid/multi.tsx:265-277,311-325,361-372`、`packages/plugin-charts/src/svelte/IrisMultiLineChart.svelte:6-44`。
- **`IrisAspectRatio`（asymmetry 4）**：Vue 只把 `ratio` 作为显式 prop，其余通过 attrs；四端输出相同的 ratio wrapper 和 content layer。证据：`packages/react/src/primitives/aspect-ratio/AspectRatio.tsx:18-38`、`packages/vue/src/primitives/aspect-ratio/AspectRatio.ts:11-37`、`packages/solid/src/primitives/aspect-ratio/IrisAspectRatio.tsx:13-34`、`packages/svelte/src/primitives/aspect-ratio/IrisAspectRatio.svelte:7-25`。
- **`IrisProTable`（asymmetry 3.5）**：Vue 显式列举 `ProTableViewOptions`，其他端通过类型继承；四端均以同一个 `ProTableStore` 驱动排序、选择、编辑、虚拟化和分页。证据：`packages/plugin-pro-table/src/react/index.tsx:20-41`、`packages/plugin-pro-table/src/vue/index.ts:18-32`、`packages/plugin-pro-table/src/solid/index.tsx:17-25`、`packages/plugin-pro-table/src/svelte/IrisProTable.svelte:17-30`。
- **`IrisMenuTrigger`（asymmetry 4）**：`asChild` 在四端只是 React clone、Vue VNode merge、Solid Slot、Svelte child snippet 的框架适配差异；点击、键盘打开、ARIA 和 trigger ref 语义一致。证据：`packages/react/src/primitives/menu/MenuTrigger.tsx:43-71`、`packages/vue/src/primitives/menu/MenuTrigger.ts:5-21`、`packages/solid/src/primitives/menu/IrisMenuTrigger.tsx:20-58`、`packages/svelte/src/primitives/menu/IrisMenuTrigger.svelte:22-64`。

本次审查未修改文件。
