# 批 DQ Adapt — PASS

`rowDragBetween` 已接入行拖拽控制器：表内结构拖拽仍走原有重排，窗口级指针事件
在命中外部 `data-iris-drop-zone` 后调用对应目标一次；离开表格不会误取消外部拖放。

涉及：`Table.tsx`、`types/base.ts`、`props/editing.ts`、`batch-dl-dt.test.tsx`。
