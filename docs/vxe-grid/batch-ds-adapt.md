# 批 DS Adapt — PASS

`widthHint` 已从 Table 传入 `ColumnResizeHandle`。拖拽状态记录宽度与指针坐标，
使用 token 驱动的固定提示层，结束/取消时清理；不开启时沿用原 resize 路径。

涉及：`column-layout.tsx`、`Table.tsx`、`props/layout.ts`、`batch-dl-dt.test.tsx`。
