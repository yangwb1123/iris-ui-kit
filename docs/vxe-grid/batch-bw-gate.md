Gate stage complete for grid 批 BW（右键快捷操作，iris 独有）.

## Review verdict

**PASS** — 核对 `batch-bw-baseline.md` 全部锚点，逐项验实现：无条件内置（无新 prop）、插入点 = 用户项 → 分布? → 摘要? → 复制值 → 清空 → 批注?；复制走 `contextCellText`（mask→formatter→String，与 `cellTooltip` :6169 同源链）+ 既有三通道 `writeClipboardText`；清空 = `setCellValue`→`commitRowList`，与 Delete 快捷键（:5312-5315）逐字一致；locked/readonly no-op；onSelect 拦截 + 去重守卫；i18n +2 en/zh；4 源码文件（core 仅 i18n 键）、manifest 仅 description 变化（propCount 162/eventCount 30 不变）、vue/solid/svelte 零改动；core framework-free；4 个 findings 均非阻断（2 LOW + 2 INFO）。

## Gate results

- **Full repo gate** (`turbo run test typecheck lint build --concurrency=2`): **180/180 tasks successful** (54 cached)
- **Audit**: 0 vulnerabilities
- **Manifest**: `gen:manifest` regenerated → 155 components × 4 frameworks, 86 tokens; `check:manifest` up-to-date (no diff; propCount 162/eventCount 30)
- **Comparison doc**: already current at adapt commit `f1252651` — 右键快捷操作 iris 独有 table row (line 78), 构建状态 append 批 BW (line 292), test counts 2332→2344 (line 350); re-verified against the gate run

## Final test counts

- **core: 1517/1517** · **react: 2344/2344** (+12 context-quick-actions)
- vue 1531 · solid 974 + 34 hydration · svelte 916 + 31 hydration (unchanged)

## Commit

- **`a1177355`** — `feat(table): grid 批 BW——单元格右键快捷操作（iris 独有）` (gate-stage docs delta: DECISIONS stage entries + baseline/adapt/review/gate reports; source was already committed at `f1252651`)
- Working tree clean; `.vinxi` excluded per instruction.
