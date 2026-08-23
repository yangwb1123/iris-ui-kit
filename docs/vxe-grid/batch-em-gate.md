Gate 批 EM 完成 ✅

## 报告

**Verdict**: `batch-em-review.md` = **PASS** — 全仓库门禁执行通过并已提交。

**Commit**: `91df199731fd5d6fcc524f3335b918c5772a765d`
`feat(table): grid 批 EM——svelte 同步：公式列（四框架对齐）`（6 files, +125/−58；lint-staged prettier 已过）

## 门禁结果

| Check                                                 | Result                                                    |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **184/184**（142 cached + 42 实跑，1m39.8s，无 flake） |
| `audit:security`                                      | ✅ **0 vulnerabilities**                                  |
| `audit:tokens`                                        | ✅ clean（exit 0）                                        |
| `gen:manifest` + `check:manifest`                     | ✅ **nil diff** — 155×4、86 tokens、unavailable=0         |
| format:check（涉改 6 份文档）                         | ✅ prettier clean                                         |

## 最终测试计数（逐包直跑实测）

- **svelte** 147 files / **1003**（+15 批 EM formula.test.ts）+ hydration **35/35**
- **core** 104 files / **1597**（formula 24/24 不动）· **solid** 143 files / **1028** + hydration **38/38**
- **react** 257 files / **3012** · **vue** 166 files / **1588**

## 文档更新（iris 独有四框架对齐节）

- `comparison.md` 批 EM 行：「验证（批 EM）」→「**gate 实测（批 EM）**」全仓库块（turbo/per-package/audit/manifest nil diff），review LOWs 收入
- **Review LOW 闭合**：行数 **1614→1613** / 净 +8→**+7** 在 comparison.md 与 batch-em-adapt.md 两处修正（arch-check 三条 exit-1 为 HEAD 既有：IrisTable.svelte 1606 vs baseline 1493，本批不改变 pre-existing 状态）
- `batch-em-gate.md` 新报告；DECISIONS.md（EM baseline/adapt/review 条目）+ pipeline 紧凑重写文档随批入库

按 DV→EK 先例，并行工作流的 `apps/aero-platform-console/*` 与 `pnpm-lock.yaml` 未卷入提交（`apps/ssr-solidstart/.vinxi` 亦排除）。
