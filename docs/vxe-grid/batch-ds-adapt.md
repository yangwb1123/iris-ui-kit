All verification complete. Full report:

## 批 DS：列宽提示（iris 独有）— 验证通过

### 状态判定

Baseline 已确认本功能在 HEAD `fedc213e` 完整提交（DL–DT 批次 `61ec5418` 内落地）。本次为验证 + 全部门禁复跑，**零源码改动**，逐行锚点全部核实：

| 锚点     | 位置                                                                                                                                                                                                                      | 状态 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| prop     | `props/layout.ts:163` `widthHint?: boolean`（带 doc，单行，`IrisTableLayoutProps` 具名接口内）                                                                                                                            | ✅   |
| 默认值   | `Table.tsx:311` `widthHint = false`（opt-in, additive）                                                                                                                                                                   | ✅   |
| 透传     | `Table.tsx:8753` → `ColumnResizeHandle`（resizableColumns 手柄载体上）                                                                                                                                                    | ✅   |
| 生命周期 | `column-layout.tsx:56-65` onStart 显示初始宽 → onDrag clamp 刷新 + 走 `onResize` → onEnd 清空（pointercancel 同回路）；`104-120` `position:fixed` 跟随指针、`pointerEvents:none`、全 `var(--iris-*)` token、`aria-hidden` | ✅   |
| 测试     | `test/batch-dl-dt.test.tsx:464-483`「DS shows and clears the live width hint」拖拽显示（`116px`）/隐藏两态断言                                                                                                            | ✅   |

### 验证结果（全部绿）

| 门禁                   | 结果                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| core test              | **1597/1597** (104 files)                                                        |
| react typecheck        | clean                                                                            |
| react test             | **2826/2826** (246 files)                                                        |
| react lint             | **0 errors**（2 条 Table.tsx 既有 complexity warning，非本次引入）               |
| 专项 batch-dl-dt       | **21/21**（含 DS 定向 case）                                                     |
| spec scan `--mode all` | **0 violations**（1535 files, token_scale 存在）                                 |
| `pnpm gen:manifest`    | 155 components × 4 框架，**manifest 已最新，无 diff** → 无可提交的 manifest 变更 |

### 文件变更

- **本次修改：无**（实现已在 HEAD 提交）。
- 工作区仅 3 个管道既有文档改动（`DECISIONS.md`、`batch-dr-gate.md`、`batch-ds-baseline.md`），按批处理约定留待 gate 阶段处理，未触碰、未提交。
- 约束合规：core 零改动（framework-free）✓、react-only ✓、additive ✓、无 dist/tgz/node_modules/manifest 手改 ✓、测试文件 492 行 ≤500 ✓、改动文件 ≤4 ✓、manifest hygiene（单行 props/具名接口）✓。

### What is left

- 无实现遗留。4 条 non-blocking 观察（键盘 resize 不显示 hint、pinned 边界列无负向测试、pointercancel/disabled 无断言、clamp/aria-hidden 无 a11y 基线断言）按 baseline 判定为非阻塞，均超出 spec 范围。
- 管道后续：gate 阶段将提交 docs（decision/gate/review 记录）。
