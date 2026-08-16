# Batch CH gate report

## Verdict: PASS (0 blocker / 0 major; 2 low / 1 info)

Review verdict was **PASS** (`docs/vxe-grid/batch-ch-review.md`). No implementation fixes required — all three findings are non-blocking:

1. **LOW (perf, optional)** — `Table.tsx:3945`: effect deps include `columnDrag` object identity → listener churn if parent re-renders mid-drag with an inline object; could depend on `[colDragCtrl, colDragActive]` + ref. Logged as optional, consistent with existing patterns, no behavior impact.
2. **LOW (informational)** — `Table.tsx:3922`: sub-threshold press + outside release leaves core `pending` until next press; identical to pre-CH vxe behavior, zero visible artifact, out of scope.
3. **INFO** — `resolveColDrag(x, _y)` keeps unused `_y` deliberately (documented, lint-clean).

No code changes made during this gate (code + tests + manifest were already committed at `4f07fd8a` during adapt; review re-verified all 13 spec-mapped tests passing).

## Gate results

| Step                                                                   | Result                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (2m04s; 125 cached)                                                                                                                                              |
| audit:security                                                         | **0 vulnerabilities** (No known vulnerabilities found)                                                                                                                                        |
| audit:tokens                                                           | exit 1 with **only pre-existing warnings** — 0 new from this batch (zero new CSS/tokens; pin styling reuses `pinnedStyle` with `var(--iris-background)`)                                      |
| gen:manifest + check:manifest                                          | regenerated, **up to date** — zero diff from committed state (155 components × 4, 86 tokens, **propCount 169 / eventCount 31**; `columnDrag` description text only, both generator locations) |
| comparison doc                                                         | `docs/vxe-grid-comparison.md` updated — iris 独有 section (columnDrag 拖出固定 row) + 构建状态 paragraph (批 CH entry)                                                                        |
| framework-free invariant                                               | core untouched — `grep "from '(vue\|react\|solid\|svelte)'" packages/core/src` = 0 (review re-verified)                                                                                       |

## Commit

- **`feat(table): grid 批 CH——列宽双栏拖拽（iris 独有）`** — gate commit folding the accumulated docs: comparison doc (2 entries) + DECISIONS.md (gate stage log) + batch-cg-gate.md (gate-stage re-format) + batch-ch-adapt.md (gate-stage re-format) + batch-ch-review.md (verdict) + batch-ch-gate.md (this report)
- Implementation (`Table.tsx` +78 / `props.ts` doc-only / `test/column-pin-drag.test.tsx` 13 tests / manifest description text) was committed earlier at **`4f07fd8a`** during adapt

## Final test counts

- **react: 2467/2467** (incl. 13 new column-pin-drag tests: 受控固定+回调不重排 / 非受控内部态 / 双 fail-closed / 已左 no-op / 右→左翻转 / 带内重排回归 / 同列 no-op / 窗口 pointerup stuck 修复 / tap 取消 / pointercancel / 受控无乐观翻转 / 分组头叶列)
- **core: 1533/1533** (unchanged — core framework-free, zero-touch)
- **manifest: 155 components × 4 frameworks, propCount 169 / eventCount 31**, check:manifest up to date
- **spec: 0 violations** (per review re-verification)
- audit: 0 vulnerabilities
