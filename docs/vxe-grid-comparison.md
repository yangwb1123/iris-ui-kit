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
  mergeCells / spanMethod（合并单元格）、mergeHeaderCells（表头合并）、
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
  fnrConfig（查找替换）、menuConfig（右键菜单）、clipConfig、tooltipConfig、emptyText、
  loadingConfig、footerMethod（汇总）、currentRowConfig

## iris-ui 现状对比

| 类别       | vxe-grid                    | iris-ui IrisTable                                                                    | 差距                                       |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| 编辑       | editConfig+editRules 规则集 | editable 列 + validate 回调 + validConfig.showMessage（批 F）                        | 缺规则集/click 激活/row 模式/状态图标      |
| 选择       | checkbox/radio              | selectable multi ✓ + 方法 selectAll/toggleRowSelection/clearSelection（批 F，react） | 缺 radio 单列                              |
| 虚拟       | virtualX/virtualY           | virtualScroll ✓                                                                      | 基本对齐                                   |
| 列宽       | resizableConfig             | resizableColumns ✓                                                                   | 对齐                                       |
| 列拖拽     | columnDragConfig            | —                                                                                    | 缺                                         |
| 行拖拽     | rowDragConfig               | IrisSortable（外部）                                                                 | 可组合                                     |
| 序号列     | seqConfig                   | —                                                                                    | 缺                                         |
| 合并单元格 | spanMethod                  | —                                                                                    | 缺                                         |
| 排序       | sortConfig 多列             | sort 单列 + multiSort 多列 ✓（批 F，react）                                          | 对齐（react；点击序/原地切换/代理 sorts）  |
| 筛选       | filterConfig                | —                                                                                    | 缺                                         |
| 展开行     | expandConfig                | expandable ✓ + expandAll ✓（批 F，react）                                            | 对齐（react；一次首屏数据种子）            |
| 树形       | treeConfig                  | tree ✓                                                                               | 对齐                                       |
| 汇总       | footerMethod                | summary ✓                                                                            | 对齐                                       |
| 撤销       | undoRedoHistory             | core undo（外部）                                                                    | 可组合                                     |
| 工具栏     | toolbarConfig               | —                                                                                    | 缺                                         |
| 搜索表单   | formConfig                  | 外部组件                                                                             | 可组合                                     |
| 数据代理   | proxyConfig                 | proxyConfig ✓（批 C，react）                                                         | 对齐（react，core 控制器）                 |
| 搜索表单   | formConfig                  | formConfig ✓（批 D，react）                                                          | 对齐（react；远程合并 filters + 本地过滤） |
| 行操作     | insertRow/removeRow/setRow  | tableRef ✓（批 E，react）                                                            | 对齐（react；core table-rows 纯函数）      |
| 勾选条件   | checkboxConfig.checkMethod  | checkMethod ✓（批 E，react）                                                         | 对齐（react；全选跳过禁用行）              |
| 分页配置   | pagerConfig.pageSizes       | pagerConfig ✓（批 E，react）                                                         | 对齐（react；切换重置页码）                |
| 单元格提示 | tooltipConfig               | tooltipConfig ✓（批 G，react）                                                       | 对齐（react；title 轻量模式）              |
| 范围勾选   | checkboxConfig.isShiftKey   | shift 范围勾选 ✓（批 G，react）                                                      | 对齐（react；尊重 checkMethod）            |
| 导入导出   | export/import               | exportCsv/Excel ✓                                                                    | 缺导入                                     |
| 打印       | printConfig                 | —                                                                                    | 缺                                         |

## 构建状态（2026-08 完成，react only）

| 批   | 内容                                                                                                              | 状态      |
| ---- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| 批 1 | editRules 规则集 + editConfig（required/min/max/type/pattern/validator）                                          | ✅ 四框架 |
| 批 2 | rowDrag（createSortable 组合）+ useTableUndo（createUndoStack 组合）                                              | ✅ react  |
| 批 3 | seq 序号列 + spanMethod 合并 + columnDrag 列拖拽                                                                  | ✅ react  |
| 批 4 | columnVisibility 列显隐 + filters 筛选（core filterSort）+ toolbar                                                | ✅ react  |
| 批 5 | parseCsv 导入（工具栏按钮）+ printable 打印样式                                                                   | ✅ react  |
| 批 C | proxyConfig 服务端数据源（remoteSort/remoteFilter/分页/autoLoad/编辑回写）                                        | ✅ react  |
| 批 F | multiSort 多列排序 + validConfig.showMessage + 选择方法（selectAll/toggleRowSelection/clearSelection）+ expandAll | ✅ react  |

react 1559 tests · core 1245 tests · 180/180 turbo · 审计 0

## 组合接口说明

- **外部能力**（resizable/movable/sortable/clickOutside/hotkey）→ `IrisCompose` 拼接
- **内部能力**（virtual/multiple/rowDrag/columnDrag/undo/编辑）→ Table prop / hook 组合
  （均基于 core 控制器：createVirtualizer/createSelectionModel/createSortable/
  createUndoStack/createCellEdit/createEditRules）

## 决策

- 逻辑下沉 core（规则引擎/拖拽/撤销）；适配器薄桥
- additive API（新配置默认关闭，零破坏）
- 组合接口优先：能用 IrisCompose / core 控制器组合的，不重复造轮子
