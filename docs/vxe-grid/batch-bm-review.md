# 批 BM 审查判决 — **PASS** ✅

Verdict 已写入 `docs/vxe-grid/batch-bm-review.md`。审查对象为 commit `e17058ee`（7 文件，与 adapt 报告逐项一致）。

## 验证命令结果（全部执行）

| 命令                     | 结果                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------- |
| core test                | ✅ 1517 passed（零 core 改动）                                                          |
| react test               | ✅ 2219 passed（+13）；note-popover.test.tsx 13/13 绿                                   |
| react typecheck          | ✅ exit 0                                                                               |
| react lint               | ✅ 0 errors（1 条既有 IrisTable complexity warn，parent 实测同款 259→261）              |
| audit:security           | ✅ No known vulnerabilities                                                             |
| audit:tokens             | ⚠️ 5 个 warn **全部既有**（parent/HEAD 计数逐项相同）；BM 气泡只用规范 `--iris-*` token |
| check:manifest           | ✅ up to date（155×4，propCount 153→154）                                               |
| check:framework-parity   | ✅ parity                                                                               |
| core framework-free      | ✅ 零命中                                                                               |
| prettier / change-budget | ✅ 全绿（0 core lines）                                                                 |

## 规格核对结论

- **Prop**：`notePopover?: boolean` 位置、默认 off、off 字节等价 ✓
- **单咽喉**：`cellTitle` 唯一调用点（:5976）加第 6 参，仅注记分支变 `undefined`，compare/sparkline/tooltipConfig/编辑豁免零触碰 ✓
- **面板**：虚拟锚点（context-menu rect 快照形状逐字）、placement top/offset 8/flip+shift、useDismiss + capture 滚动关闭 + portal、`role="tooltip"`、`pre-wrap`、`pointerEvents:none`、无 seq token（已文档化）✓
- **零 i18n / 零 core / 零样式表 / vue·solid·svelte 零改动** ✓
- **测试**：13 个覆盖规格强制对先（渲染→关闭×4）及全部计划项 ✓

## 发现

1. **[LOW] 文档** — `batch-bm-baseline.md` 写 `propCount 152→153`，实际 BL 已先落 153，本次为 `153→154`（manifest 为真相源，正确）。纯基线文档算术错误，不影响门禁仲裁。
2. **[INFO]** IrisTable complexity warn 为既有类（parent 复现 259），非本次引入。
3. **[INFO]** token audit 5 个 warn 全部既有（逐项对比 parent 确认），非本次引入。

实现与基线逐字对齐，additive-only、react-only、manifest 已再生成。**PASS**（未修改任何源码文件）。
