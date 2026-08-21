# 批 DM Adapt — PASS

`autoSaveState` 已接入快照恢复与定时写入：支持自定义 key/storage，过滤
`multiSortState`，对非法间隔、禁用 storage、JSON 和存储异常保持惰性处理。

涉及：`Table.tsx`、`types/base.ts`、`props/editing.ts`、`batch-dl-dt.test.tsx`。
