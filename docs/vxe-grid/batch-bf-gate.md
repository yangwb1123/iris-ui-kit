Gate stage complete — verdict **PASS**, no fixes needed.

## Results

**Gate** (all run fresh): `turbo run test typecheck lint build` → **180/180 tasks successful** · `pnpm audit` → **0 vulnerabilities** · `gen:manifest` + `check:manifest` → up to date, byte-identical (155 components × 4; handle method manifest-invisible, `restoreVersion`/`exportSelectionCsv` precedent).

**Final test counts**: core **1457** · react **2140** (190 files; +8 `export-version-csv` suite) · vue 1531 · solid 974 + 34 hydration · svelte 916 + 31 hydration.

**Doc**: `docs/vxe-grid-comparison.md` updated — new「iris 独有」row `数据导出时间线 exportVersionCsv` (row-source divergence vs filtered live view documented per review LOW, post-restore byte-equality scoped to unfiltered/unsorted), batch-table row 批 BF, 构建状态 paragraph, test-count summary 2132 → 2140. Also wrote `docs/vxe-grid/batch-bf-gate.md` per batch pattern.

**Commit**:

```
1797337ac8752b79b58c4763e00b005fbba48017
feat(table): grid 批 BF——数据导出时间线（iris 独有）
```

10 files, +345/−3, working tree clean (`.vinxi` excluded).
