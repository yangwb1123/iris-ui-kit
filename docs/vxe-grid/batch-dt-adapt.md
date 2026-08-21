# 批 DT Adapt — PASS

`exportRowsCsv` 已加入 React handle，按 body 行顺序筛选指定 key，并复用公式物化
与 `exportCsv`。空集合、未知 key 返回空字符串；handle 类型与 manifest 已同步。

涉及：`types/handle.ts`、`Table.tsx`、`batch-dl-dt.test.tsx`、manifest 生成物。
