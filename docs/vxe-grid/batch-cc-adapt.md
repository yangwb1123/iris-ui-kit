Batch CC complete — all gates green on the committed state.

## Report

**Commits** (2, per CB/CA convention):

- `0c8b31e9` — `feat(table): grid 批 CC——编辑自动换行（iris 独有）` (7 files, +319/−6)
- `1ce53cbf` — `docs(table): batch CC adapt report`

**Files changed** (≤4 changed files + tests):

| File                                                         | Change                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/props.ts`               | `editAutoHeight?: boolean` after `onAutosave` (single-line prop)                                                                                                                                                                                                                           |
| `packages/react/src/primitives/table/Table.tsx`              | destructure + `EditorSurfaceProps` + textarea branch (`rows` 3→1, `onInput` → pure `autoHeightSize` → inline `height/maxHeight/overflowY`, mount-measure effect) + module helpers (`EDITOR_AUTO_MAX_ROWS=6`, session line-height cache, fallback 16px) + both call sites (row + cell mode) |
| `packages/react/src/primitives/table/edit-autowrap.test.tsx` | **NEW** — 10 tests                                                                                                                                                                                                                                                                         |
| `packages/manifest/{manifest.json,llms.txt}`                 | regenerated via `gen:manifest` (ALWAYS)                                                                                                                                                                                                                                                    |
| `docs/vxe-grid-comparison.md`                                | 2 处 (persistState row + 构建状态 line)                                                                                                                                                                                                                                                    |

**Tests added**: 10 — pure `autoHeightSize` 5 (增长 40→40 / 上限 300→120+auto / 边界 120→hidden / 收缩 / 单行下限) + integration 5 (默认 off 回归锁批 I `rows=3` / 增长接线 / 上限接线 96px+auto / 交互不变量 / row-mode 共享). jsdom 无布局 → scrollHeight mock (F9), 数学全在纯函数.

**Counts**: react 2399→**2409** · manifest propCount 167→**168** · eventCount 31 unchanged · core 1533 unchanged · spec 0 violations (1415 files).

**Verification** (all ✅): core test 1533/1533 · react typecheck clean · react test 2409/2409 · react lint 0 errors (1 pre-existing IrisTable complexity warning) · `iris-ui-spec.py --mode all` 0 violations · `gen:manifest` regenerated + committed (`check:manifest`/`check:framework-parity`/`check:docs-reference` green) · react build + prettier clean.

**What is left**: runner's review/gate stage; `DECISIONS.md`/`batch-cb-gate.md` in working tree are prior-stage leftovers (untouched, per CB precedent); baseline open questions deferred — O1 rows=1 起步 (per spec「单行起步」), O2 per-column control deferred, O3 cap 可配置 deferred (spec fixes 6); F6 documented — fixed rowHeight 时编辑器在自身 maxHeight 内滚动 (预期).
