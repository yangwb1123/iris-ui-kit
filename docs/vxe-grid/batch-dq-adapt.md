Working tree clean of source churn beyond DQ scope, DQ test suite 17/17 post-hardening, manifest regenerated and stable.

## 批 DQ：行拖拽跨表（iris 独有）— 完成报告

### 结论

Baseline 锚定逐项验证在位：spec 全部行为已于 `61ec5418` adapter 对齐提交交付（类型 `types/base.ts:119-124` · 解构 `props/editing.ts:86` · 命中 `Table.tsx:2413-2423` · 拖出不取消 `8136` + 窗口级接管 `2563-2581` · 命中清线 `2445-2451` · 释放分流 `2513-2554`），命中路径测试已在 baseline 批次随行（batch-dl-dt 14/14）。本批次补齐 baseline 观察② 的三条缺失测试（key 不匹配负向、命中 zone 不触发 onReorder 组合、elementFromPoint 缺失防御分支），并按 manifest 扫描器卫生要求收敛 DQ 新增类型/属性的机器可读记录（观察③）。

### Files changed（本批次）

| 文件                                                            | 变更                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props/editing.ts`          | `rowDragBetween` JSDoc 由跨行块注释收敛为单行（`/** ... */`）——扫描器 `parsePropsBody` 对"首行带文 + 末行文与 `*/` 同行"的块注释不累计，单行化后 manifest 两条记录均可提取 description（双记录：组件 props + react 契约） |
| `packages/react/src/primitives/table/index.ts`                  | 显式类型出口补 `type IrisTableRowDragBetweenTarget`（barrel 已有 `types.ts → types/index → base.ts` 的 `export *` 链，`publicTypes` 仅认 `export type { … }` 显式列表，缺此则 llms types 清单漏类型）                     |
| `packages/react/src/primitives/table/test/batch-dl-dt.test.tsx` | +3 DQ 用例（见下），文件 322 → 374 行 ≤500 ✓                                                                                                                                                                              |
| `packages/manifest/manifest.json` / `llms.txt`                  | `gen:manifest` 重新生成：`rowDragBetween` 两记录补 description、react `IrisTable` publicTypes 增 `IrisTableRowDragBetweenTarget`；155×4 / 86 tokens 与组件/类型计数零漂移                                                 |
| `docs/vxe-grid/batch-dq-adapt.md` / `DECISIONS.md`              | 本报告 + 批记录追加                                                                                                                                                                                                       |

### Tests added（batch-dl-dt.test.tsx，+3）

| 用例                                                                   | 断言                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `DQ ignores a zone whose key does not match any rowDragBetween target` | zone `data-iris-drop-zone="trash"` 与配置 key `archive` 不匹配 → `onDrop` 不触发、`onReorder` 不触发（回退表内路径不越权）     |
| `DQ fires onDrop exactly once and never reorders through onReorder`    | 命中匹配 zone → `onDrop` 恰一次且携带 `rows[0]`、`onReorder` 零次（提前 return 不落重排的组合断言）                            |
| `DQ stays table-internal when elementFromPoint is unavailable`         | `document.elementFromPoint` stub 为 undefined → 防御分支 `if (!elementFromPoint) return null` 生效，拖拽全程无异常、无越权回调 |

### Verification counts

- **core test**: 104 files / **1597** pass ✓（core 零变更，框架无关铁律未触及）
- **react typecheck**: clean ✓；**react test**: 246 files / **2822** pass（batch-dl-dt **17/17**，14 既有 + 3 新增）✓
- **react lint**: **0 errors**（2 条 Table.tsx 既有 complexity warning，非 DQ 引入）✓
- **iris-ui-spec.py --mode all**: **0 violations**（exit 0）✓
- **gen:manifest**: 155×4 / 86 tokens 重新生成，差异仅限 DQ 两条 description + 一个 publicTypes 类型；`check:manifest` 复检 up to date ✓

### Constraints check

- Core framework-free ✓（未触碰 core）；react only ✓；additive only ✓（1 行 JSDoc 收敛 + 1 行显式出口 + 新用例，零行为删除）
- 无 dist/tgz/node_modules 改动；manifest 仅 `gen:manifest` 工具生成，无 hand-edit ✓
- `--iris-*` token only ✓（本批次零样式变更）
- MANIFEST SCANNER HYGIENE：rowDragBetween 单行函数 prop ✓、`IrisTableRowDragBetweenTarget` 命名导出 interface ✓、显式 barrel 出口 ✓、manifest 记录含 description + types 条目 ✓

### What is left

- **zone 高亮归 parent**（baseline 观察①）：表格只读属性，拖拽态信号为行级 `data-iris-row-drag-active` 可作 parent CSS 锚点；无表格侧高亮断言——保持表格零侵入，属既有设计取舍，不追加
- 表内 moveOver 物理路径（baseline 观察②）在 jsdom 下 rect=0 天然不产生重排，两条负向用例以"两回调皆零调用 + 无异常"为准，未虚构鼠标物理；真实浏览器行为由 `row-drag-indicator` 套件既有 10 用例覆盖
- 后续若改 `rowDragBetween` 语义（如多 zone 命中优先级），需同步 `externalRowDropAt` 的 `find` 首配策略与本文档
