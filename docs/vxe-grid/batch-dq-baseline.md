# 批 DQ Baseline — PASS

## 目标契约

增加 `rowDragBetween` 外部拖放目标配置：表格行拖出后可命中带
`data-iris-drop-zone` 的外部目标，并以拖拽行调用对应 `onDrop`；未命中时继续
使用原有表内重排，不重复提交。

## 实现边界

- React 适配层：`packages/react/src/primitives/table/Table.tsx`
- 公共类型与 props：`packages/react/src/primitives/table/types/base.ts`、`props/editing.ts`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`

## 验收标准

外部目标命中、取消、离开窗口和普通表内拖拽均有明确路径；拖放目标回调只触发
一次，且不改变现有 `rowDrag.onReorder` 语义。
