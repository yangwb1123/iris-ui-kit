# 批 DR Baseline — PASS

## 目标契约

增加 `editKeys` 配置，允许声明 F2、Enter、Space 作为单元格编辑启动键；仅在
键盘导航开启、表格聚焦且单元格可编辑时生效，默认保持现有 F2 行为。

## 实现边界

- React 适配层：`packages/react/src/primitives/table/Table.tsx`
- 公共 props：`packages/react/src/primitives/table/props/editing.ts`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`

## 验收标准

配置键可以启动编辑并阻止浏览器默认动作；失焦、只读/锁定单元格、未开启键盘
导航时不启动编辑，原有箭头、Tab 和 Escape 路径不回归。
