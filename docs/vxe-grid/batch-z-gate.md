Gate complete — batch Z merged.

## 批 Z Gate — PASS ✅（commit `71fd9289`）

**Review verdict: PASS**（findings: 1 Low + 观察项）→ Low 修复已落地：

1. **LOW — 初始代理 params 的 filters 逗号合并门控错误**：`Table.ts` 初始 `filters` 以 `remoteSort` 门控而非 `remoteFilter`，且丢弃文本 `filters` prop（React 用 `remoteFilter` 且合并两者）。已修复：`filters: remoteFilter ? mergeFilterValues(filters ?? {}, filterValues ?? {}) : {}`（`UseTableProxyOptions` 新增 `filters` 种子选项，调用点传入 `props.filters`）；被立即执行的 `remoteFilter` watch 掩盖，但 `remoteSort: true, remoteFilter: false` 时语义错误。
2. **LOW（观察）— 行编辑模式 Tab 导航**：既有缺口（vue cell 模式从未有），非本批引入，不阻塞。
3. **观察项 — local-mode 写回 / onTreeExpandChange / filterMethod**：既有 react-parity 缺口，非本批引入。

## 全仓门结果

| 门                                                    | 结果                                                      |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks**（1m38s，125 cached）                    |
| Vue tests                                             | **1531/1531**（151 files，+21 batch Z）                   |
| React tests                                           | **1823/1823**                                             |
| Core tests                                            | **1249/1249**                                             |
| typecheck / lint                                      | ✅ 全包通过，lint 0 错误                                  |
| `pnpm audit`                                          | **0 known vulnerabilities**                               |
| `gen:manifest` + `check:manifest`                     | **155 组件 × 4 框架**（4×155 aligned），零漂移 up-to-date |
| prettier（本次变更 5 文件）                           | ✅ clean（Table.ts + 4 docs）                             |

> 注：仓库级 `format:check` 有 3 个 svelte 文件与 `arch-check:ratchet` 的既有失败（HEAD 即存在、非本批引入，未触碰 solid/svelte）；本次变更文件全部 prettier-clean。

## 文档

- `docs/vxe-grid-comparison.md`：批 Z 四行标记 **✅ vue**——行编辑模式（editConfig.mode='row'）/右键菜单（contextMenu）/筛选面板（filterValues）/懒加载树（lazyLoad）；批 Y 七项（columnVisibility/filters/seq/spanMethod/columnDrag/rowDrag/expose 代理方法）同步补标；构建状态表新增批 Y + 批 Z 行；「vue 剩余缺口」清单刷新（移除 Y/Z 已完成项，注明 solid/svelte 对齐为下一轮）；测试计数 vue 1500 → **1531**
- Gate 报告 `docs/vxe-grid/batch-z-gate.md`；DECISIONS.md/adapt/review 报告随本提交落地

## Commit

**`71fd9289`** — `feat(table): vxe-grid 批 Z——vue 适配器对齐三（行编辑模式/右键菜单/筛选面板/懒加载树）`（5 files, +134/−96；工作树干净）
