# 批 AG gate 报告

**Verdict**: review PASS（5 条 LOW/INFO 非阻断发现，均文档化在 adapt 报告；无 P1/P2 修复项）→ 全仓 gate 一次通过。

## Full repo gate — all green

- **turbo `test typecheck lint build`**: **180/180 tasks** (125 cached, 55 executed), 1m47s
- **audit**: `No known vulnerabilities found` — **0**
- **gen:manifest + check:manifest**: **155 components × 4 frameworks**, 86 tokens, `up to date (2 files)`, no diff
- review 实测复确认：`iris-ui-spec --mode all` 0 violations、prettier clean、文件 ≤500 行

## Final test counts

| Suite  | Tests                           |
| ------ | ------------------------------- |
| core   | **1255** (81 files)             |
| react  | **1850** (165 files, 批 AG +21) |
| vue    | 1531 (151 files)                |
| solid  | 974 + 34 hydration              |
| svelte | 916 + 31 hydration              |

react 1850/1850 由 gate 实测（`vitest run` 165 files / 1850 passed）；其余框架计数沿用 review 对同一 commit `7b4cd99d` 的实测。

## Review findings 处置（全部非阻断）

| #   | 级别 | 发现                                                                       | 处置                                                          |
| --- | ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | LOW  | persisted pageSize 绕过 `autoLoad: false`（`Table.tsx:926-929`）           | 已在 adapt 报告文档化；建议后续批按 `autoLoad !== false` 门控 |
| 2   | LOW  | pageSize 保存侧仅 proxy 存在性门控 vs 恢复侧要求 `onPageChange`，不对称    | 建议后续批对称门控                                            |
| 3   | INFO | StrictMode dev 双跑 restore（幂等，与既有 autoLoad 行为一致）              | 接受现状                                                      |
| 4   | INFO | 恢复的 filters/columnVisibility 弱形状校验（数组过 `typeof === 'object'`） | 接受现状                                                      |
| 5   | INFO | `lastWrittenRef` 未按 storage key 键控（极端边角）                         | 接受现状                                                      |

## Docs + commit

- `docs/vxe-grid-comparison.md`：「iris 独有」节与批 AG 行已随 adapt 提交；gate 补：构建状态标题加批 AG、测试计数行更新为 **react 1850**（批 AG +21）+ manifest 155×4 通过
- 新增 `docs/vxe-grid/batch-ag-gate.md` gate 报告 + DECISIONS.md gate 条目
- **Commit**: `539cfb99` — `feat(table): grid 批 AG——状态一键持久化 + 可变高度虚拟化（iris 独有）`（amend 后）；working tree clean
