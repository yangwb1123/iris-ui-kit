Gate complete — **PASS**.

## 批 DS Gate 最终报告

| 门禁项                                                                 | 结果                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Review verdict                                                         | **PASS**（2 × P3 non-blocking，无阻断）                                       |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks**（174 cached）                                               |
| `pnpm audit`                                                           | **0 known vulnerabilities**                                                   |
| `gen:manifest` + `check:manifest`                                      | **up to date**（155×4 / 86 tokens，重新生成零 diff）                          |
| `git diff --check`                                                     | clean · 纯文档收尾（DS 源码已由 `61ec5418` DL–DT 批次携带，零工作树源码改动） |

## 最终测试计数

| Suite                                                                                     | Files | Tests       |
| ----------------------------------------------------------------------------------------- | ----- | ----------- |
| core（零变更）                                                                            | 104   | **1597**    |
| react（含 `batch-dl-dt.test.tsx` 21/21，DS 定向 case :464-483 拖拽显示 `116px`/隐藏两态） | 246   | **2826**    |
| turbo                                                                                     | —     | **180/180** |

## 文档更新（`docs/vxe-grid-comparison.md` iris 独有 节）

- 新增 **批 DS 行**：`widthHint?: boolean` 列宽拖拽像素提示——`props/layout.ts:163` 具名 `IrisTableLayoutProps` 单行 prop（经 `props.ts:5,84` 交叉出口）、`Table.tsx:311` 默认 off、仅 resizable 非 pinned 边界手柄透传（`Table.tsx:8753`）；生命周期 `column-layout.tsx:56-65`（onStart 钳制初始宽 → onDrag clamp 刷新 + 既有 `onResize` → onEnd 清空，pointercancel 同 useDrag 回路）；渲染 `104-120` `data-iris-width-hint` + `position:fixed` 指针跟随（+8/-32）+ `pointerEvents:none` + `aria-hidden` + 全 `--iris-*` token + `{hint.width}px`；零 core/三框架/i18n/styles 改动
- 构建状态段追加 批 DS 摘要
- `batch-ds-gate.md` 重写为真实 gate 报告（替代 review 阶段占位）；`DECISIONS.md` 追加 gate 记录

## Commit

`feat(table): grid 批 DS——列宽提示（iris 独有）` — 纯文档收尾（DS 源码与测试已由 `61ec5418` adapt commit 携带；工作树既有 5 个管道 doc 改动随本 commit 一并落盘）。
