# 批 DT Baseline — PASS

## 目标契约

增加 `IrisTableHandle.exportRowsCsv(keys)`，按当前 body 行顺序导出指定 row key
集合，沿用当前视图的列选择、公式物化、掩码和 CSV 序列化管线；未知 key 或
无匹配行返回空字符串。

## 实现边界

- Handle 类型：`packages/react/src/primitives/table/types/handle.ts`
- React 适配层：`packages/react/src/primitives/table/Table.tsx`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`

## 验收标准

导出顺序稳定、列头和转义规则与既有导出一致；不改变筛选视图导出、选区导出、
公式列、隐藏列和空集合行为。
