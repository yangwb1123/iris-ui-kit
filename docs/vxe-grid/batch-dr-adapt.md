# 批 DR Adapt — PASS

`editKeys` 已接入根键盘事件：F2 默认可选，Enter/Space 按声明启用；焦点、可编辑
性、锁定状态和 `keyboardNavigation` 均在启动前校验，并保留既有导航处理顺序。

涉及：`Table.tsx`、`props/editing.ts`、`batch-dl-dt.test.tsx`。
