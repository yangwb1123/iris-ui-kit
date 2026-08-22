Gate complete — **PASS**, committed.

## 结果

**Review verdict:** PASS （2 × P3 non-blocking，无阻断；DS 实现已在 `61ec5418` DL–DT 批次携带，本次零源码改动）

**Full repo gate:** `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks** 成功（174 cached，12.5s）

**audit:** `pnpm audit` → **0 known vulnerabilities**

**Manifest:** `gen:manifest` + `check:manifest` → **155 components × 4 框架 / 86 tokens，up to date（重新生成零 diff）**

**最终测试计数:**

| Suite                                                                    | Files | Tests    |
| ------------------------------------------------------------------------ | ----- | -------- |
| core                                                                     | 104   | **1597** |
| react（含 `batch-dl-dt.test.tsx` 21/21，DS 定向 case 显示 `116px`/隐藏） | 246   | **2826** |
| turbo                                                                    | —     | 180/180  |

**文档更新（iris 独有 section）:**

- 新增 **批 DS 行**: `widthHint?: boolean` 列宽拖拽像素提示 — `props/layout.ts:163` 具名接口单行 prop（经 `props.ts:5,84` 交叉出口）、`Table.tsx:311` 默认 off、仅 resizable 非 pinned 边界手柄透传（`:8753`）；生命周期 `column-layout.tsx:56-65`（onStart 钳制初始宽 → onDrag clamp 刷新 + 既有 `onResize` → onEnd 清空，pointercancel 同 useDrag 回路）；渲染 `104-120` `data-iris-width-hint` + `position:fixed` 指针跟随 + `pointerEvents:none` + `aria-hidden` + 全 `--iris-*` token + `{hint.width}px`；零 core/三框架/i18n/styles 改动
- 构建状态段追加 批 DS 摘要
- `batch-ds-gate.md` 重写为真实 gate 报告；`DECISIONS.md` 追加 gate 记录

**Commit:** `28d5fcf5` `feat(table): grid 批 DS——列宽提示（iris 独有）` — 7 files, +142/−47（纯文档收尾）。工作树干净。
