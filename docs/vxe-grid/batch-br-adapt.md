Done — batch BR complete. Working tree keeps only this batch's source/tests/docs changes (plus pre-existing pipeline state `DECISIONS.md`/`batch-bv-gate.md`/`batch-br-baseline.md`, untouched).

## Report

**Batch BR: 校验统计 `validationSummary`（iris 独有）** — implemented per baseline, zero drift.

### Files changed (4 source + tests + docs)

| File                                            | Change                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`  | +1 `validationSummary?: boolean` (single-line prop + JSDoc, after `freshness`, before `auditLog`)                                                                                                                                                                                                                                                   |
| `packages/react/src/primitives/table/Table.tsx` | module helper `hasEditRules` · destructure · state/refs/effect (`validationCounts`/`validationSummaryRef`/`validationIntentRef` + reset effect) · `commitWithSummaryIntent` + `bumpValidationCount` useCallbacks · cellEdit memo validate/onCommit wrappers · createRowSession validate/onCommit · 5 commit-intent sites · toolbar gate + stamp JSX |
| `packages/core/src/i18n.ts`                     | +1 `table.validationSummary` en `Passed {ok} · Failed {fail}` (after `table.freshness`)                                                                                                                                                                                                                                                             |
| `packages/plugin-locale-zh/src/core/index.ts`   | +1 zh `通过 {ok} · 失败 {fail}` (en→zh parity test gates it)                                                                                                                                                                                                                                                                                        |
| `test/validation-summary.test.tsx` (new)        | **12 tests, 324 lines** (≤500)                                                                                                                                                                                                                                                                                                                      |
| `packages/manifest/{manifest.json,llms.txt}`    | regenerated — **propCount 161→162**, eventCount 30 unchanged (as predicted)                                                                                                                                                                                                                                                                         |
| `docs/vxe-grid-comparison.md`                   | 3 places: iris 独有 table new row · 构建状态 append 批 BR · test counts 2320→2332                                                                                                                                                                                                                                                                   |
| `docs/vxe-grid/batch-br-adapt.md` (new)         | this report                                                                                                                                                                                                                                                                                                                                         |

### Implementation

- **Ledger semantics**: ok = a commit that passed `editRules` and LANDED (counted in the `onCommit` wrapper — cell mode via the `cellEdit` memo, row mode via `createRowSession`); fail = a commit attempt REJECTED by `editRules` (counted in the `validate` wrapper's Promise `.then`).
- **Commit-intent marker**: `commitWithSummaryIntent` wraps ALL 5 commit entry points (cell `commitEdit` wrapper, Tab's editRules branch, row-mode Enter / Tab / row-switch) and sets `validationIntentRef`; the `validate` wrapper consumes it SYNCHRONOUSLY on entry. This cleanly separates commit-time validation from `setDraft` typing validation and `startEdit` seeds — neither ever counts. The marker cannot leak: every validate invocation clears it, and an idle (no-op) `commitEdit` clears it via the `!ok` guard.
- **Scope**: module-level `hasEditRules` single throat — only `editRules.length > 0` columns count. Legacy `validate` columns, paste/fill/FNR/batch bypasses (commitRowList writes) and Escape cancels never count.
- **Async exactly-once**: for editRules columns core runs `validateDraft` twice per commit (sync check + commitAsync) — the FIRST call consumes the intent (its `.then` counts once); the second carries no intent. Later typing re-validations likewise never double-count.
- **Ref mirroring**: `validationSummaryRef` mirrors the prop (editAutosaveRef precedent) so the `[]`-dep memo closures never read a stale prop; `bumpValidationCount` is a stable `useCallback` reading the switch through the ref. Re-enabling the prop resets the ledger via a `[validationSummary]` effect.
- **Display**: toolbar muted stamp `data-iris-validation-summary` (freshness-identical token style — `--iris-font-size-xs` / `--iris-muted`), shown when the switch is on AND ≥1 outcome counted (the spec's「提交失败时」case is included: `Passed 0 · Failed 1`). Positioned after the perf trigger, before custom buttons; the toolbar gate list admits `validationSummary` (the prop alone opens the toolbar, like `freshness`).

### Tests added (12)

① spec fail count（提交拒绝 → stamp `Passed 0 · Failed 1` + commit 被阻） · ② spec ok count（提交落地 → `Passed 1 · Failed 0` + onCellEdit） · ③ 混合独立计数（两列独立累计） · ④ feature switch off（校验照跑但零计数零 stamp） · ⑤ 打字不计（setDraft 无 intent） · ⑥ legacy `validate` 列 scope（同步拒绝不计） · ⑦ 无 editRules 列（落地也不计 ok） · ⑧ 行模式逐列（每列 session 独立计数） · ⑨ 异步 validator 恰一次（拒绝一次 + 打字不重计 + 接受一次） · ⑩ Escape 取消 + paste 旁路（均不计） · ⑪ 显示契约（attr/token 样式/perf 后 custom 前/i18n 文本） · ⑫ 重新开启清零 + off 期提交 no-op

### Verification — all ✅

- core test **1517/1517** · react typecheck **clean** · react test **2332/2332** (+12) · react lint **0 errors** (1 pre-existing complexity warning)
- spec `--mode all` **0 violations** (1415 files)
- `gen:manifest` → propCount **161→162** (eventCount 30 unchanged) + `check:manifest` up-to-date · `gen:docs-reference` + `check:docs-reference` up-to-date (gitignored generated)
- prettier clean on all changed files

### Left

Runner's pending review/gate stage; vue/solid/svelte alignment deferred (react-only scope — zero core logic changes, purely additive react bridge).
