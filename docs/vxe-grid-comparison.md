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
- **validConfig**：校验模式（type: 'one'|'all'、错误提示位置）
- **undoRedoHistoryConfig**：编辑撤销/重做（core 已有 undo 可组合）

### 2. 选择

- checkboxConfig：多选（reserve 跨页保留、range 框选、checkMethod、showHeader）
- radioConfig：单选（row、checkMethod）

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
  expandConfig（展开行）、rowGroupConfig（行分组）

### 6. 排序 / 筛选

- sortConfig（多列、remote、sortMethod）、filterConfig（本地/远程筛选、
  resetMethod、筛选类型）、floatingFilterConfig（浮动筛选）

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

| 类别       | vxe-grid                    | iris-ui IrisTable           | 差距                                  |
| ---------- | --------------------------- | --------------------------- | ------------------------------------- |
| 编辑       | editConfig+editRules 规则集 | editable 列 + validate 回调 | 缺规则集/click 激活/row 模式/状态图标 |
| 选择       | checkbox/radio              | selectable multi ✓          | 缺 radio 单列                         |
| 虚拟       | virtualX/virtualY           | virtualScroll ✓             | 基本对齐                              |
| 列宽       | resizableConfig             | resizableColumns ✓          | 对齐                                  |
| 列拖拽     | columnDragConfig            | —                           | 缺                                    |
| 行拖拽     | rowDragConfig               | IrisSortable（外部）        | 可组合                                |
| 序号列     | seqConfig                   | —                           | 缺                                    |
| 合并单元格 | spanMethod                  | —                           | 缺                                    |
| 排序       | sortConfig 多列             | sort 单列                   | 多列可扩展                            |
| 筛选       | filterConfig                | —                           | 缺                                    |
| 展开行     | expandConfig                | expandable ✓                | 对齐                                  |
| 树形       | treeConfig                  | tree ✓                      | 对齐                                  |
| 汇总       | footerMethod                | summary ✓                   | 对齐                                  |
| 撤销       | undoRedoHistory             | core undo（外部）           | 可组合                                |
| 工具栏     | toolbarConfig               | —                           | 缺                                    |
| 搜索表单   | formConfig                  | 外部组件                    | 可组合                                |
| 数据代理   | proxyConfig                 | createDataSource ✓          | 对齐（core）                          |
| 导入导出   | export/import               | exportCsv/Excel ✓           | 缺导入                                |
| 打印       | printConfig                 | —                           | 缺                                    |

## 构建状态（2026-08 完成，react only）

| 批   | 内容                                                                     | 状态      |
| ---- | ------------------------------------------------------------------------ | --------- |
| 批 1 | editRules 规则集 + editConfig（required/min/max/type/pattern/validator） | ✅ 四框架 |
| 批 2 | rowDrag（createSortable 组合）+ useTableUndo（createUndoStack 组合）     | ✅ react  |
| 批 3 | seq 序号列 + spanMethod 合并 + columnDrag 列拖拽                         | ✅ react  |
| 批 4 | columnVisibility 列显隐 + filters 筛选（core filterSort）+ toolbar       | ✅ react  |
| 批 5 | parseCsv 导入（工具栏按钮）+ printable 打印样式                          | ✅ react  |

react 1502 tests · core 1199 tests · 180/180 turbo · 审计 0

## 组合接口说明

- **外部能力**（resizable/movable/sortable/clickOutside/hotkey）→ `IrisCompose` 拼接
- **内部能力**（virtual/multiple/rowDrag/columnDrag/undo/编辑）→ Table prop / hook 组合
  （均基于 core 控制器：createVirtualizer/createSelectionModel/createSortable/
  createUndoStack/createCellEdit/createEditRules）

## 决策

- 逻辑下沉 core（规则引擎/拖拽/撤销）；适配器薄桥
- additive API（新配置默认关闭，零破坏）
- 组合接口优先：能用 IrisCompose / core 控制器组合的，不重复造轮子
