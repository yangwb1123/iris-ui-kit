# 批 DO Baseline — PASS

## 目标契约

右键菜单支持可选的格式化快捷操作：对选区或点击单元格执行字符串大写与数值
保留两位小数。操作必须复用现有编辑提交漏斗，跳过公式、锁定和只读单元格。

## 实现边界

- React 适配层：`packages/react/src/primitives/table/Table.tsx`
- 既有开关：`contextMenu.formatActions`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`、`context-menu-select.test.tsx`

## 验收标准

`formatActions` 开启时菜单出现格式化项并能提交选区；未开启时菜单保持兼容；
格式化不绕过权限、公式保护、撤销和数据变更回调。
