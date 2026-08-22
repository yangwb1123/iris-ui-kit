Baseline written — 批 DL（`patternFill` 别名）已落地于 `docs/vxe-grid/batch-dl-baseline.md`，只改这一处文档，未触碰任何源码。

**核验事实（read-only ground truth）**：

- **设计**：`patternFill?: boolean`（props/editing.ts:147，紧随 `pattern` 之后）是 batch DH `pattern` 的独立开关别名——`const patternEdit = (pattern || patternFill) && editingTarget !== null`（Table.tsx:1813-1814）。编辑 draft 时同列 RAW 匹配值轻高亮：`data-iris-input-hint="true"`（L6219）+ `--iris-input-hint` token 背景长写 background-image（`PATTERN_HINT_BG`，clipboard-display-helpers.tsx:219），匹配口径 `String(raw) === String(draft)`，空 draft fail-closed，row 模式不参与（fiat）。
- **文件地图**：props/editing.ts（+1 prop）· Table.tsx（解构 L333 + 门控 L1813-1814，其余属性/spread 由 DH 共享管线继承）· clipboard-display-helpers.tsx（helper 复用）· 回归 `test/batch-dl-dt.test.tsx`（L47）· 行为契约 `pattern-fill.test.tsx`（12 用例）；types/core/i18n 零改动，Svelte parity 已有同契约镜像（L121/L1330/L1398）。
- **测试计划**：别名回归（patternFill → 编辑 Paris 单元格 → row2 高亮、row3 无）+ DH 继承套件（逐键实时/raw 匹配/fail-closed/共存/commit 清空）+ 不变量回归；命令 `pnpm --filter @iris-ui-kit/react test` 或定向 vitest run 两文件。

`git status` 确认工作区仅有该 baseline 文档被修改。
