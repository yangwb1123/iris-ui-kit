Gate stage complete for 批 DQ（行拖拽跨表）— **PASS**.

## 执行结果

| 门禁项                                                                 | 结果                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| Review verdict                                                         | **PASS**（2 × P3 + 1 × INFO，无阻断）              |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks**（125 cached，1m59s）             |
| `pnpm audit:security`                                                  | **No known vulnerabilities found**（0）            |
| `gen:manifest` + `check:manifest`                                      | **up to date**——155×4 / 86 tokens，重新生成零 diff |
| `git diff --check` + hooks                                             | clean · change budget 5 files / 0 core lines ✓     |

## 最终测试计数

| Suite                                           | Files | Tests       |
| ----------------------------------------------- | ----- | ----------- |
| react（含 DQ `batch-dl-dt.test.tsx` **17/17**） | 246   | **2822**    |
| core（零变更）                                  | 104   | **1597**    |
| turbo                                           | —     | **180/180** |

## 文档更新（`docs/vxe-grid-comparison.md` iris 独有 节）

- 新增 **批 DQ 行**：`rowDragBetween` 拖拽跨表——`externalRowDropAt` 命中链（elementFromPoint→closest→attribute 匹配、每事件最新 prop）、leave 豁免 + 窗口监听接管、命中清线、释放分流恰一次 `onDrop(row)` 不落 `onReorder`、zone 高亮归 parent fiat
- 构建状态段追加 批 DQ 摘要
- `batch-dq-gate.md` 重写为真实 gate 报告；`DECISIONS.md` 追加 gate 记录

## Commit

**`2a413bdd`** `feat(table): grid 批 DQ——行拖拽跨表（iris 独有）` — 5 files, +83/−51（纯文档收尾；源码已由 `7f2ed0cb` adapt commit 携带）。工作树干净（0 未跟踪/未暂存）。
