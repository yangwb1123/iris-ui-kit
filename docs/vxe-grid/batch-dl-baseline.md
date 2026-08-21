# 批 DL Baseline — PASS

## 目标契约

为表格增加 `patternFill?: boolean` 别名。开启时沿用既有
`rangeFill` 的模式提示与填充入口；未开启时保持原有渲染和交互字节不变。

## 实现边界

- React 适配层：`packages/react/src/primitives/table/Table.tsx`
- 公共 props：`packages/react/src/primitives/table/props/editing.ts`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`

## 验收标准

开启 `patternFill` 可看到既有模式填充行为，关闭或省略时无额外提示；不改变
公式、选择、编辑和导出路径。
