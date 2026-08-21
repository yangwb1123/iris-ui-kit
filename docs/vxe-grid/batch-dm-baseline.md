# 批 DM Baseline — PASS

## 目标契约

增加 `autoSaveState` 配置，按正数 `intervalMs` 将当前可持久化视图快照写入
可配置 `storage` 和 `key`；默认使用 `iris-table-auto-state`，显式
`storage: false` 时关闭。读取或写入异常必须 fail-inert。

## 实现边界

- React 适配层：`packages/react/src/primitives/table/Table.tsx`
- 公共类型与 props：`packages/react/src/primitives/table/types/base.ts`、`props/editing.ts`
- 回归：`packages/react/src/primitives/table/test/batch-dl-dt.test.tsx`

## 验收标准

挂载时恢复合法快照，定时器写出最新快照，敏感的临时排序字段不进入自动保存；
无配置、非法间隔、禁用存储和存储异常均不影响表格。
