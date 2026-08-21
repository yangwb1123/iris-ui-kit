# 批 DP Baseline — PASS

## 目标契约

增加 `scrollbarThumb?: boolean`，在表格根节点启用 token 驱动的滚动条拇指样式，
覆盖普通和虚拟滚动容器；默认不添加样式标记。

## 实现边界

- React 适配层：`packages/react/src/primitives/table/Table.tsx`
- 样式：`packages/react/src/primitives/table/table-css.ts`
- 公共 props：`packages/react/src/primitives/table/props/advanced.ts`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`

## 验收标准

开启后根节点带确定性数据属性，CSS 仅引用 Iris token 并保留浏览器原生回退；
关闭时无额外规则或 DOM 影响。
