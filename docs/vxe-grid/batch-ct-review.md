Verdict written to `docs/vxe-grid/batch-ct-review.md` — **PASS**（0 MAJOR / 0 MEDIUM，4 条 P4 提示）。

## 审核摘要

**验证（全部在 HEAD `4dbdb9bc` 上复跑）**

- core test **1559/1559**（core 零改动，框架无关不变式 intact）
- react typecheck clean · test **2604/2604**（2594+10）· lint 0 errors（1 条 pre-existing complexity warning）
- `check:manifest` up to date（180 props / 31 events / 155×4 / 86 tokens）
- `pnpm audit` 无漏洞；`audit:tokens` 5 条 unknown-token warning 全为 pre-existing（父提交已含），本批零新增非规范 token
- core framework-free grep 为空

**逐项检查**

- **Spec**：`tableTabs?: IrisTableTab[]` 在 `onActiveViewChange` 后（props.ts:571）、propCount 179→180；`role=tablist` 条在工具栏上方、独立于工具栏门（`toolbar:'hidden'` 仍渲染）；点击按序走**同一** `selectView`（未知名 fail-inert / 后赢 / 下拉镜像，测试 3/4/7 固定）；dup key 保首、空 views inert、无 views inert、首点前无活动态；工具栏顶角半径 fail-closed 条件移交（无标签路径字节等价，测试 2 固定）；打印 CSS 隐藏；零 i18n/事件/core/其他框架改动，`tableTabs` 全仓零碰撞
- **Additive only**：既有代码唯一改动 = 工具栏半径条件（fail-closed）+ 打印 CSS 新选择器，其余全为新增
- **Manifest 卫生**：manifest.json/llms.txt 同步（prop 两处、type 列表、180）
- **CSS tokens**：全 `var(--iris-*)` 规范 token，无 hex/Tailwind/Emotion/innerHTML
- **测试**：10 测试 325 行 ≤500，fully-controlled harness，覆盖全部 9 条 fail-closed 规则

**4 条 P4（不阻塞）**：① tablist 无方向键导航/`aria-controls`（spec-literal，可降级按钮组）② tablist 无 `aria-label` ③ form+tabs 共存时圆角从第二层开始（form 条 pre-existing 方角）④ 活动态样式全内联无 CSS 钩子。

工作树干净（仅前序 `batch-cs-gate.md` 与阶段簿记），无 dist/tgz/node_modules 产物。
