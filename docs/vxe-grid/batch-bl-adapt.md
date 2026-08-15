Batch BL complete and committed (`d1fdc657`). All gates green.

## Report — 性能面板 `perfStats`（iris 独有）

**Files changed** (4 new + 9 edits, per baseline file map):

| File                                                                    | Change                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/perf-stats.ts` (NEW)                                 | `createPerfStats()` latest-snapshot controller (audit mold 1:1: `latest()/push()/subscribe()/getVersion()`) + named `PerfSample`/`PerfStats` + `nowMs()` (`performance.now()` → `Date.now()` SSR/jsdom fallback)                                                                                                                                                                                                     |
| `packages/core/src/perf-stats.test.ts` (NEW, 175 ln)                    | **12 tests**: snapshot semantics, subscribe/version, nowMs fallbacks                                                                                                                                                                                                                                                                                                                                                 |
| `packages/react/src/primitives/table/PerfPanel.tsx` (NEW)               | `TablePerfPanel` — AuditPanel mold: useFloating + portal + Esc/outside/scroll close, **dual uSES subscription** (perf + audit) so `clearAuditLog()` refreshes changes in place; 4 stat rows `data-iris-perf-duration/-rows/-columns/-changes`, auditLog off → muted `—`, defensive empty state                                                                                                                       |
| `packages/react/src/primitives/table/perf-stats.test.tsx` (NEW, 310 ln) | **12 tests**: 面板渲染 (trigger/gate/open/sample format) · 计数正确 (rows + grouped leaf columns) · changes = audit depth · `—` when off · live-while-open · clearAuditLog 原地刷新 (dual-subscription proof) · **no-feedback-loop probe** (sample byte-stable after flush) · data-change re-sample · Esc/outside close · inert without prop · empty state · toggle                                                  |
| 9 edits                                                                 | core barrel + package.json `./perf-stats` subpath + tsup entry · i18n +6 en / +6 zh (locale parity guard locks both) · `props.ts` single-line `perfStats?: boolean` (after `auditLog`) · `Table.tsx` 9 touch points (render-top `nowMs()` mark + dependency-less `useLayoutEffect` push `{durationMs, rows, columns, changes}` — off = zero cost; toolbar gate + ⚡ trigger + panel render) · comparison doc 3 sites |

**Tests added**: 12 core + 12 react = **24**. **Counts**: core 1505→**1517** · react 2194→**2206** · manifest **155×4**, propCount 152→**153**, unavailable 0.

**Verification (all green)**:

- `core test` 1517/1517 ✓ (+ typecheck, lint 0 errors)
- `react typecheck` ✓ · `react test` 2206/2206 ✓ · `react lint` **0 errors** (1 pre-existing `IrisTable` complexity warning)
- `iris-ui-spec.py --mode all --json` → **0 violations**
- `gen:manifest` regenerated + committed (`check:manifest` up-to-date ✓) · Prettier clean ✓

**What's left**: nothing — review + gate stages are the next pipeline steps (gate per `batch-bl-review.md`). Pre-existing BJ-stage `M` entries (`DECISIONS.md`, `batch-bk-gate.md`) untouched; core `dist` rebuilt locally for react resolution (not committed).
