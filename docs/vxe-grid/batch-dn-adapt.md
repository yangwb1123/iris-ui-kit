# 批 DN Adapt — PASS

`headerStats` 已接入平面及分组叶表头。统计从当前 body 数据计算，仅接纳有限
数字并显示 `n` 与两位小数平均值；默认关闭，且不改变普通表头结构。

涉及：`Table.tsx`、`props/advanced.ts`、`batch-dl-dt.test.tsx`。
