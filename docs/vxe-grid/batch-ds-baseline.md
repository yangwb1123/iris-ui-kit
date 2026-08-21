# 批 DS Baseline — PASS

## 目标契约

增加 `widthHint?: boolean`，拖拽列宽时显示跟随指针的当前像素宽度提示；结束
拖拽或取消后提示消失，宽度值使用现有 token 样式。

## 实现边界

- React 适配层：`packages/react/src/primitives/table/column-layout.tsx`
- 传递层：`packages/react/src/primitives/table/Table.tsx`、`props/layout.ts`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`

## 验收标准

开启时拖拽开始/移动/结束分别显示、更新、清理提示；关闭时保持原有 resize
交互和 DOM，不能阻止列宽提交。
