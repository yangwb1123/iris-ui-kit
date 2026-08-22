Gate complete — **PASS → committed**.

## Review verdict: PASS（LOW #1 已修）

### 修复（LOW #1：doc/behavior mismatch）

`advanced.ts`/`Table.tsx` JSDoc「live-only fields survive」与实测不符——core `diffRows.diffRowCells` 把 **before-only 键**（live 独有、快照缺席）当作一次变更（`newValue = undefined`），merge 会把该键重置为 `undefined`（幂等所需：合并后 live ≡ 快照、二次点击 no-op；测试 `batch-ed.test.tsx`「Snapshot version wins (live-only `note` field is not part of it)」已钉死该掉落）。两处注释改按实测措辞（comment-only，零行为变化），`gen:manifest` 后描述同步刷新。

### 全门禁

| 门禁                                                  | 结果                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **184/184**（54 cached，~4m17s）                                                  |
| `audit:security`                                      | ✅ 0 vulnerabilities                                                                 |
| `audit:tokens`                                        | ✅ clean                                                                             |
| `gen:manifest` + `check:manifest`                     | ✅ up to date，nil diff（**208 props / 33 events / 155×4 / 86 tokens**，react-only） |
| vxe parity / 其他适配器                               | ✅ vue/solid/svelte 零改动（additive-only）                                          |

### 最终测试计数（`--force` 现跑）

- **react**: 257 files — **3012/3012**（batch-ed **22/22**：门控 5/合并结果 9/通道 5/契约 3）
- **core**: 106 files — **1641/1641**（framework-free；core 仅 audit-log 类型成员 + i18n 键）
- **manifest**: 6 files — **69/69**
- lint 0 errors（2 条既有 complexity warning 同 base HEAD）· typecheck ✓

### 提交

- **`<hash>`** — `feat(table): grid 批 ED——对比一键合并（iris 独有）`（impl + LOW 修复 + comparison 批 ED 行 + baseline/adapt/review/gate 文档，13 files）

⚠️ **Deviation（DV/DW/DX/DY/DZ/EA/EB/EC 先例）**：未跑字面 `git add -A`——并行 grid-refactor 管线工作树改动（core `data-grid`、plugin-pro-table `grid`、SPRINT/ADR、check-size/arch-baseline、aero-platform-console、pipeline yamls、既有批次文档改写）全部原样未动；提交仅含 ED 批次自身文件。
