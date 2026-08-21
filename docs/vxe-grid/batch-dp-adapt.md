# 批 DP Adapt — PASS

`scrollbarThumb` 已接入表格根节点和普通/虚拟滚动容器的 CSS。规则使用
`--iris-*` token，并提供标准 `scrollbar-color` 与 WebKit 回退；关闭时不输出
数据属性。

涉及：`Table.tsx`、`props/advanced.ts`、`table-css.ts`、`batch-dl-dt.test.tsx`。
