# 批 DO Adapt — PASS

右键格式化操作已接入既有 `contextMenu.formatActions` 可选开关。字符串转大写、
数字转两位小数，格式化通过统一行提交路径执行，并跳过公式、只读和锁定单元格。

涉及：`Table.tsx`、`context-menu-select.test.tsx`、`batch-dl-dt.test.tsx`。
