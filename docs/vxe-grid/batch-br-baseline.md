Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-br-baseline.md`** written (11 lines, the only new file — `DECISIONS.md`/`batch-bv-gate.md` are pre-existing pipeline state; **zero source files touched**).

## 核验摘要

**设计** — 新表级 prop `validationSummary?: boolean`（props.ts `freshness` 后单行 prop）：**editRules 列提交结局账本**——成功 = 提交经 `editRules` 校验通过并落地（`onCommit` 包装器计数，cell/row 两模式）；失败 = 提交尝试被校验拒绝（`validate` 包装器 Promise `.then` 计数）。**commit-intent 标记**（包装 `commitEdit` 置位 + validate 同步消费）区分提交时刻与 setDraft 打字瞬时校验；只计 `editRules.length > 0` 的列（legacy `validate` 列、paste/fill/FNR/批量面板旁路、Escape 取消均不计）；计数 bump 经 `validationSummaryRef` ref 镜像门控（memo 闭包不读陈旧 prop，`editAutosaveRef` 先例），重新开启清零。工具栏 muted stamp `data-iris-validation-summary`（freshness 同款样式），i18n `table.validationSummary` en `Passed {ok} · Failed {fail}` / zh `通过 {ok} · 失败 {fail}`，显示条件 = 开启且 ≥1 个结局已计（spec「提交失败时」场景被包含，fiat #3）；位置在 perf 钮后、custom buttons 前，工具栏门控列表加 `validationSummary`。

**文件地图** — props.ts +1 · Table.tsx 8 触点（destructure :1850、模块 helper :1208、state/refs/effect 于 :2989 前、cellEdit memo :2989 三处+包装、createRowSession :3061 同款、门控 :7327、stamp JSX :8012）· core i18n +1（:115）· zh plugin +1（:51）· NEW `test/validation-summary.test.tsx` · comparison doc（新行 + react 2320→**2332**）· manifest propCount 161→**162**（eventCount 30 不变）· 零改动：types.ts / styles.ts / core 逻辑 / 三框架。

**测试计划** — 12 用例，规格两项打头（失败计数、成功计数），另覆盖混合独立计数/feature switch/打字不计/legacy 列 scope/无 editRules 列/行模式逐列/异步 validator 恰一次/Escape+旁路/显示契约/重置+no-op。

**12 条 fiats** 覆盖 gate 仲裁面；全部锚点已逐一对当前代码核验（cellEdit :2989、createRowSession :3061、commitEdit 包装 :3890、moveEditOnTab :3930、门控 :7327、custom buttons :8012、freshness stamp :7367、props :655、i18n :115、zh :51、manifest 161/30）。
