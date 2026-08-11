# vxe-grid 功能清单 vs iris-ui 现状与构建路线

> 来源：vxe-table@4.20.10 / vxe-pc-ui@4.16.27 类型定义与文档（2026-08 提取）
> 目标：用 iris-ui 逐步构建同等功能的可编辑 Table（四框架），并实现组合接口。

## vxe-grid 功能清单（VxeTableProps + VxeGridProps）

### 1. 编辑（editConfig / editRules / validConfig）

- **editConfig**：`trigger: 'click'|'dblclick'|'manual'`、`mode: 'cell'|'row'`、
  `autoFocus`、`autoClear`（切格自动清未提交）、`showStatus`（updated/inserted 状态图标）、
  `showAsterisk`（必填星号）、`showUpdateStatus`、`cache`
- **editRules**（列级规则集）：`required` / `min` / `max` / `type: number|string|array` /
  `pattern`（正则）/ `validator`（同步|异步）/ `message` / `trigger: blur|change|manual`
- **validConfig**：校验模式（type: 'one'|'all'、错误提示位置）、`showMessage`（false 时仍阻断提交 + 保留 aria-invalid，仅隐藏错误文案，批 F ✓ react）
- **undoRedoHistoryConfig**：编辑撤销/重做（core 已有 undo 可组合）

### 2. 选择

- checkboxConfig：多选（reserve 跨页保留、range 框选、checkMethod、showHeader）
- radioConfig：单选（row、checkMethod）
- 选择方法（批 F ✓ react）：`selectAll`（全选，遵守 checkMethod）/ `toggleRowSelection`（单行切换，绕过 checkMethod）/ `clearSelection`（清空）

### 3. 滚动 / 虚拟

- scrollX / scrollY（固定高度滚动）、**virtualXConfig / virtualYConfig**（虚拟滚动，
  含增强模式 vs 固定行高）

### 4. 列能力

- resizableConfig（列宽拖拽，minWidth/maxWidth）、columnDragConfig（列拖拽排序）、
  columnConfig（visible/fixed/formatter/width 等）、seqConfig（序号列）、
  mergeCells / spanMethod（合并单元格）、mergeHeaderCells（表头合并，批 P ✓ react）、
  customConfig（列自定义渲染 slots）

### 5. 行能力

- rowConfig（keyField/isHover/useKey）、rowDragConfig（行拖拽排序）、
  expandConfig（展开行；`expandAll` 一次性全展开，批 F ✓ react）、rowGroupConfig（行分组）

### 6. 排序 / 筛选

- sortConfig（多列、remote、sortMethod）、filterConfig（本地/远程筛选、
  resetMethod、筛选类型）、floatingFilterConfig（浮动筛选）
- multiSort（批 F ✓ react）：`multiSort` 多列排序（点击追加/原地升→降/移除，chronological 点击序，
  非主排序列序号徽标，链式稳定比较器，代理发 `sorts` 数组）

### 7. 数据代理（proxyConfig）

- query/insert/remove/save ajax 代理、响应解析、表单联动

### 8. 工具栏 / 表单 / 缩放

- toolbarConfig（内置按钮：refresh/import/export/zoom/custom）、formConfig（搜索表单）、
  zoomConfig（全屏）、layouts

### 9. 导入导出 / 打印

- exportConfig（csv/xls/xlsx/html/pdf）、importConfig（文件导入）、printConfig（打印）

### 10. 交互增强

- mouseConfig（鼠标选中/框选）、areaConfig（区域复制）、keyboardConfig（键盘导航）、
  fnrConfig（查找替换，批 O ✓ react）、menuConfig（右键菜单）、clipConfig（批 O ✓ react）、tooltipConfig（单元格，批 G ✓ react；表头/表尾提示，批 P ✓ react）、emptyText、
  loadingConfig、footerMethod（汇总）、currentRowConfig

## iris-ui 现状对比

| 类别          | vxe-grid                                  | iris-ui IrisTable                                                                                                                                                                                                                | 差距                                                                                                            |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 编辑          | editConfig+editRules 规则集               | editable 列 + validate 回调 + validConfig.showMessage（批 F）+ editConfig.mode='row'（批 K，react）                                                                                                                              | 缺规则集/click 激活/状态图标                                                                                    |
| 编辑脏标记    | editDirtyConfig                           | editDirtyConfig ✓（批 Q，react；commitValue 单一漏斗记录首次提交原值，`data-iris-cell-dirty` 圆点 + `indicator:false` 抑制 + `className:true` 加 `iris-table-cell-dirty` 类，提交回原值自动清除，removeRow/removeRows 剪枝脏键） | 对齐（react；vxe keep-fields 语义 vs 差异标记）                                                                 |
| 选择          | checkbox/radio                            | selectable multi ✓ + 方法 selectAll/toggleRowSelection/clearSelection（批 F，react）                                                                                                                                             | 缺 radio 单列                                                                                                   |
| 虚拟          | virtualX/virtualY                         | virtualScroll ✓                                                                                                                                                                                                                  | 基本对齐                                                                                                        |
| 固定高度      | scrollX/scrollY（固定高度）               | height/minHeight/maxHeight ✓（批 N，react）                                                                                                                                                                                      | 对齐（react；root 滚动容器 + sticky 表头）                                                                      |
| 自适应高度    | autoResize                                | autoResize ✓（批 Q，react；RO 测量仅门控 fixedHeight 滚动机制，无显式 height 时 root `height: 100%` 填充并持续追踪父容器）                                                                                                       | 对齐（react）                                                                                                   |
| 滚动条配置    | scrollbarConfig                           | scrollbarConfig ✓（批 Q，react；theme:'thin' → `data-iris-scrollbar-thin`：6px webkit 滚动条 + FF `scrollbar-width: thin`，覆盖 root 与虚拟滚动子容器）                                                                          | 对齐（react；vxe 自绘滚动条 vs 原生 thin）                                                                      |
| 列宽          | resizableConfig                           | resizableColumns ✓ + width:'auto' 自适应（批 M，react）                                                                                                                                                                          | 对齐                                                                                                            |
| 列拖拽        | columnDragConfig                          | —                                                                                                                                                                                                                                | 缺                                                                                                              |
| 行拖拽        | rowDragConfig                             | IrisSortable（外部）                                                                                                                                                                                                             | 可组合                                                                                                          |
| 序号列        | seqConfig                                 | seq ✓ + proxy 累计序号（批 L，react）                                                                                                                                                                                            | 缺                                                                                                              |
| 合并单元格    | spanMethod                                | —                                                                                                                                                                                                                                | 缺                                                                                                              |
| 排序          | sortConfig 多列                           | sort 单列 + multiSort 多列 ✓（批 F，react）                                                                                                                                                                                      | 对齐（react；点击序/原地切换/代理 sorts）                                                                       |
| 筛选          | filterConfig                              | —                                                                                                                                                                                                                                | 缺                                                                                                              |
| 展开行        | expandConfig                              | expandable ✓ + expandAll ✓（批 F，react）                                                                                                                                                                                        | 对齐（react；一次首屏数据种子）                                                                                 |
| 树形          | treeConfig                                | tree ✓ + lazyLoad ✓（批 J+K，react）                                                                                                                                                                                             | 对齐（react；仅无子行 caret、加载后展开缓存、刷新清缓存+epoch 防陈旧回填）                                      |
| 汇总          | footerMethod                              | summary ✓ + footerMethod ✓（批 N，react）+ 分组汇总（批 M，react；groupBy 组内汇总 + 全局 footer 同 aggregate ops，footerMethod 替换全局 summary 行）                                                                            | 对齐                                                                                                            |
| 表尾合并      | footerSpanMethod                          | footerSpanMethod ✓（批 P，react；footerMethod 行→summary 行→footerData 行栈式 rowIndex，colspan 覆盖跳过 + gridColumnEnd，rowspan 惰性——每行独立 grid 容器）                                                                     | 对齐                                                                                                            |
| 撤销          | undoRedoHistory                           | core undo（外部）                                                                                                                                                                                                                | 可组合                                                                                                          |
| 工具栏        | toolbarConfig                             | refresh/import/export/custom ✓（批 L）+ toolbar.batch 批量按钮（批 M，react）                                                                                                                                                    | 缺                                                                                                              |
| 搜索表单      | formConfig                                | 外部组件                                                                                                                                                                                                                         | 可组合                                                                                                          |
| 数据代理      | proxyConfig                               | proxyConfig ✓（批 C，react）                                                                                                                                                                                                     | 对齐（react，core 控制器）                                                                                      |
| 搜索表单      | formConfig                                | formConfig ✓（批 D，react）                                                                                                                                                                                                      | 对齐（react；远程合并 filters + 本地过滤）                                                                      |
| 行操作        | insertRow/removeRow/setRow                | tableRef ✓（批 E，react）                                                                                                                                                                                                        | 对齐（react；core table-rows 纯函数）                                                                           |
| 批量删除      | removeRows（多行）                        | removeRows ✓（批 J，react）                                                                                                                                                                                                      | 对齐（react；单次 onDataChange + 选择剪枝）                                                                     |
| 勾选条件      | checkboxConfig.checkMethod                | checkMethod ✓（批 E，react）                                                                                                                                                                                                     | 对齐（react；全选跳过禁用行）                                                                                   |
| 分页配置      | pagerConfig.pageSizes                     | pagerConfig ✓（批 E，react）                                                                                                                                                                                                     | 对齐（react；切换重置页码）                                                                                     |
| 单元格提示    | tooltipConfig                             | tooltipConfig ✓（批 G，react）                                                                                                                                                                                                   | 对齐（react；title 轻量模式）                                                                                   |
| 表头/表尾提示 | headerTooltipConfig / footerTooltipConfig | headerTooltipConfig/footerTooltipConfig ✓（批 P，react；title 原生提示，空内容丢弃，覆盖扁平/分组表头 + summary/footerMethod/footerData 单元格）                                                                                 | 对齐（react）                                                                                                   |
| 单元格链接    | —（自定义渲染/插槽实现）                  | column.link ✓（批 L，react）                                                                                                                                                                                                     | 对齐（react；render > html > link > formatter > raw，_blank→rel=noreferrer）                                    |
| 分组统计      | group 行小计                              | groupBy ✓（批 M，react）                                                                                                                                                                                                         | 对齐（react；core groupRows + 组内合计）                                                                        |
| 批量操作      | 工具栏批量按钮                            | toolbar.batch ✓（批 M，react）                                                                                                                                                                                                   | 对齐（react；选择非空时显示）                                                                                   |
| 列宽自适应    | width: 'auto'                             | auto ✓（批 M，react）                                                                                                                                                                                                            | 对齐（react；minmax(max-content)）                                                                              |
| 虚拟树        | 树 + 虚拟滚动                             | 内建 ✓（批 M 验证）                                                                                                                                                                                                              | 对齐（react；flatTree 扁平 + treeMeta）                                                                         |
| 表格方法      | getTableData/getCheckbox                  | getData/getSelection ✓（批 M）                                                                                                                                                                                                   | 对齐（react；handle 快照 + 副本）                                                                               |
| 范围勾选      | checkboxConfig.isShiftKey                 | shift 范围勾选 ✓（批 G，react）                                                                                                                                                                                                  | 对齐（react；尊重 checkMethod）                                                                                 |
| 下拉编辑      | edit-render: select                       | editor: 'select' ✓（批 H，react）                                                                                                                                                                                                | 对齐（react；editOptions 原生 select）                                                                          |
| 右键菜单      | @context-menu                             | contextMenu ✓（批 H，react）                                                                                                                                                                                                     | 对齐（react；虚拟锚点浮层 + 坐标定位）                                                                          |
| 范围复制      | clipConfig                                | clipConfig ✓（批 O，react）                                                                                                                                                                                                      | 对齐（react；Ctrl/Cmd+C 选中范围导出 TSV，Ctrl/Cmd+V 粘贴回写，公式中和，溢出忽略，行键映射排序/筛选/代理安全） |
| 查找替换      | fnrConfig                                 | fnr ✓（批 O，react）                                                                                                                                                                                                             | 对齐（react；Ctrl+F 查找条 + 高亮 + Enter/Shift+Enter 步进 + 替换/全部替换单次提交，Esc 关闭）                  |
| 跨页选择      | checkboxConfig.reserve                    | 默认保留 ✓（批 H，react）                                                                                                                                                                                                        | 对齐（react；selection 独立于分页）                                                                             |
| 筛选面板      | filter 面板多选                           | filterValues ✓（批 I，react）                                                                                                                                                                                                    | 对齐（react；checkbox 面板 + OR 匹配）                                                                          |
| 多行编辑      | edit-render: textarea                     | editor: 'textarea' ✓（批 I，react）                                                                                                                                                                                              | 对齐（react；Shift+Enter 换行）                                                                                 |
| 列格式化      | formatter                                 | formatter ✓（批 I，react）                                                                                                                                                                                                       | 对齐（react；仅显示层，排序/编辑不受影响）                                                                      |
| 表头/表尾对齐 | headerAlign / footerAlign                 | headerAlign/footerAlign ✓（批 N，react）                                                                                                                                                                                         | 对齐（react；prop > col.align > 默认，数字右对齐保留）                                                          |
| 表头合并      | mergeHeaderCells                          | mergeHeaderCells ✓（批 P，react；扁平表头 row 0、leaf 索引，colspan 覆盖跳过 + gridColumnEnd，rowspan 惰性，columnVirtualization 下 fail-closed）                                                                                | 对齐（react；分组表头不合并）                                                                                   |
| 圆角/内边距   | round / padding                           | round ✓ + padding ✓（批 P，react；round 仅 bordered 时 lg 圆角，padding 走 --iris-cell-pad 变量链）                                                                                                                              | 对齐（react；padding 字符串 vs vxe boolean）                                                                    |
| 合计精度      | aggregateAccuracyConfig                   | aggregateAccuracy ✓（批 P，react；全局+分组汇总唯一舍入点，toFixed 0–100 越界忽略，renderSummary 见舍入值）                                                                                                                      | 对齐（react）                                                                                                   |
| 悬停高亮      | highlightHoverRow                         | highlightHoverRow ✓（批 N，react）                                                                                                                                                                                               | 对齐（react；默认开，false 关闭悬停规则）                                                                       |
| Tab 编辑导航  | keyboardConfig                            | Tab/Shift+Tab 编辑导航 ✓（批 J+K，react；异步校验延期落焦）                                                                                                                                                                      | 对齐（react；提交后移动，跳过不可编辑列，异步校验成功落焦/失败停留/Escape 取消）                                |
| 行编辑模式    | editConfig.mode: row                      | editConfig.mode='row' ✓（批 K，react）                                                                                                                                                                                           | 对齐（react；点击整行开编辑、逐列 Enter/blur 提交、Escape 整行取消、行切换先提交）                              |
| 导入导出      | export/import                             | exportCsv/Excel ✓                                                                                                                                                                                                                | 缺导入                                                                                                          |
| 打印          | printConfig                               | —                                                                                                                                                                                                                                | 缺                                                                                                              |

## 构建状态（2026-08 完成，react only）

| 批   | 内容                                                                                                                                                                         | 状态      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 批 1 | editRules 规则集 + editConfig（required/min/max/type/pattern/validator）                                                                                                     | ✅ 四框架 |
| 批 2 | rowDrag（createSortable 组合）+ useTableUndo（createUndoStack 组合）                                                                                                         | ✅ react  |
| 批 3 | seq 序号列 + spanMethod 合并 + columnDrag 列拖拽                                                                                                                             | ✅ react  |
| 批 4 | columnVisibility 列显隐 + filters 筛选（core filterSort）+ toolbar                                                                                                           | ✅ react  |
| 批 5 | parseCsv 导入（工具栏按钮）+ printable 打印样式                                                                                                                              | ✅ react  |
| 批 C | proxyConfig 服务端数据源（remoteSort/remoteFilter/分页/autoLoad/编辑回写）                                                                                                   | ✅ react  |
| 批 F | multiSort 多列排序 + validConfig.showMessage + 选择方法（selectAll/toggleRowSelection/clearSelection）+ expandAll                                                            | ✅ react  |
| 批 J | 树形懒加载（lazyLoad）+ removeRows 批量删除 + Tab 编辑导航                                                                                                                   | ✅ react  |
| 批 K | editConfig.mode='row' 行编辑模式 + Tab 异步校验修复 + 懒加载缓存刷新修复                                                                                                     | ✅ react  |
| 批 L | proxy 累计序号 + 工具栏导出按钮 + 列 link 单元格链接                                                                                                                         | ✅ react  |
| 批 M | 行分组（groupBy 组头 + 组内汇总）+ 工具栏批量按钮 + 列宽 auto 自适应                                                                                                         | ✅ react  |
| 批 N | 表格高度（height/minHeight/maxHeight + sticky 表头）+ 表头/表尾对齐 + footerMethod 汇总方法 + 悬停高亮                                                                       | ✅ react  |
| 批 O | 范围复制（clipConfig，Ctrl+C/V TSV 导出/粘贴回写）+ 查找替换（fnr，Ctrl+F 查找条 + 高亮 + 替换）                                                                             | ✅ react  |
| 批 P | mergeHeaderCells 表头合并 + footerSpanMethod 表尾合并 + round/padding 圆角内边距 + aggregateAccuracy 合计精度 + header/footer 表头表尾提示                                   | ✅ react  |
| 批 Q | autoResize 自适应高度 + scrollbarConfig 滚动条配置 + editDirtyConfig 编辑脏标记（review 修复：height:100% 追踪父容器、脏键 `::` 分隔 + 移除剪枝、逻辑属性 inset-inline-end） | ✅ react  |

react 1722 tests · core 1249 tests · 7298 total · 180/180 turbo · 审计 0

## 组合接口说明

- **外部能力**（resizable/movable/sortable/clickOutside/hotkey）→ `IrisCompose` 拼接
- **内部能力**（virtual/multiple/rowDrag/columnDrag/undo/编辑）→ Table prop / hook 组合
  （均基于 core 控制器：createVirtualizer/createSelectionModel/createSortable/
  createUndoStack/createCellEdit/createEditRules）

## 决策

- 逻辑下沉 core（规则引擎/拖拽/撤销）；适配器薄桥
- additive API（新配置默认关闭，零破坏）
- 组合接口优先：能用 IrisCompose / core 控制器组合的，不重复造轮子
