# 批 DQ Gate — PASS

Gate stage complete for 批 DQ（行拖拽跨表）. Verdict was **PASS**（2 × P3 + 1 × INFO，无阻断）.

## 执行结果

| 门禁项                                                                 | 结果                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Review verdict                                                         | **PASS**（2 × P3 + 1 × INFO，无阻断）                 |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks** (125 cached, 1m59s)                 |
| `pnpm audit:security` (audit-level low)                                | **No known vulnerabilities found**（0 漏洞）          |
| `gen:manifest` + `check:manifest`                                      | **up to date** — 155×4 / 86 tokens，重新生成后零 diff |
| `git diff --check`                                                     | clean                                                 |

## 最终测试计数

| Suite                                           | Files | Tests       |
| ----------------------------------------------- | ----- | ----------- |
| react（含 DQ `batch-dl-dt.test.tsx` **17/17**） | 246   | **2822**    |
| core（零变更）                                  | 104   | **1597**    |
| turbo                                           | —     | **180/180** |

## 文档更新（`docs/vxe-grid-comparison.md` iris 独有 节）

- 新增 **批 DQ 行**：`rowDragBetween` 拖拽跨表（`props/editing.ts:84-86` opt-in、`types/base.ts:118-124` 类型逐字对 spec）——`externalRowDropAt`（Table.tsx:2413-2423）elementFromPoint→closest→attribute 匹配链、每事件最新 prop 解析 onDrop；leave 豁免（:8136）+ 窗口监听接管（:2563-2581）；命中清线（:2447）；释放分流恰一次 onDrop 不落 onReorder（:2514-2550）；adapt 闭合 +3 测试（key 不匹配 / 组合断言 / elementFromPoint 缺失）；`batch-dl-dt` 17/17 · react 2822 · core 1597 · manifest 155×4/86 tokens 零 diff
- 构建状态段追加 批 DQ 摘要
- `batch-dq-gate.md` 重写为真实 gate 报告；`DECISIONS.md` 追加 gate 记录

## Commit

commit 为 `feat(table): grid 批 DQ——行拖拽跨表（iris 独有）`——含 gate 报告 + 比较文档 + 流水线 adapt/review 票据文档。源码已由 `7f2ed0cb`（adapt 交付 commit）携带，本 commit 为纯文档 gate 收尾。
