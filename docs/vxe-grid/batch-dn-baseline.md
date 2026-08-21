# 批 DN Baseline — PASS

## 目标契约

增加 `headerStats?: boolean`。开启时在表头显示当前可见数据的有限数值统计
（数量和平均值）；非数值、非有限值和空列不应制造虚假统计。

## 实现边界

- React 适配层：`packages/react/src/primitives/table/Table.tsx`
- 公共 props：`packages/react/src/primitives/table/props/advanced.ts`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`

## 验收标准

平面表头和分组叶表头均能展示统计，统计只使用当前 body 数据并保留两位小数；
默认关闭且不改变既有表头 DOM。
