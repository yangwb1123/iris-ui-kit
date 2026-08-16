Gate stage complete. Working tree clean.

## Summary

**Review verdict: PASS** (`docs/vxe-grid/batch-ci-review.md` — 0 MAJOR / 0 MEDIUM; 2 LOW, both documentation-only nits, fixed in this gate: adapt report's react-test line count corrected 203 → 226, and the pre-existing `audit:tokens` exit-1 state now documented there).

**Gate results:**

| Step                                                                   | Result                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (4m39s, 65 cached)                                                                                            |
| `audit:security`                                                       | **0 vulnerabilities** (No known vulnerabilities found)                                                                                     |
| `audit:tokens`                                                         | exit 1 with **only pre-existing warnings** — 0 new from this batch (batch CI added zero CSS/tokens)                                        |
| `gen:manifest` + `check:manifest`                                      | up to date, **zero diff** — 155 components × 4 frameworks, 86 tokens, **propCount 169 / eventCount 31** (unchanged, as baseline predicted) |
| Comparison doc                                                         | `docs/vxe-grid-comparison.md` updated — iris 独有 section (new `行克隆 cloneRow` row) + 构建状态 paragraph (批 CI entry)                   |
| Framework-free invariant                                               | core untouched (0 framework imports), re-verified by review                                                                                |

**Final test counts:**

- **react: 2481/2481** (14 new clone-row tests, 2467→2481 — re-verified standalone)
- **core: 1542/1542** (9 new `cloneRowInList` tests, 1533→1542)
- manifest propCount 169 / eventCount 31 · spec 0 violations · audit 0

**Commit:** gate commit folds the accumulated docs: comparison doc (2 entries) + DECISIONS.md (gate stage log) + batch-ci-adapt.md (gate-stage fix of the 2 LOW nits) + batch-ci-review.md (verdict) + batch-ci-gate.md (this report). Implementation (`table-rows.ts` +9 tests / `Table.tsx` +6 / `types.ts` +1 / `clone-row.test.tsx` 14 tests / core barrel export) was committed earlier at **`c82e02c9`** during adapt.

## Implementation recap (from `c82e02c9`)

`IrisTableHandle.cloneRow(key, index?)` — vxe has no clone-row API (only insert/remove buttons + methods). core `cloneRowInList(rows, rowKeyField, key, index?)` pure function (same contract as insert/remove/update trio: immutable, missing key → original reference, silent no-op): clone = `{ ...source, [rowKeyField]: max+1 }` — shallow-copies all fields onto a fresh key via `nextAutoId`; default insert right after source (sourceIndex+1); explicit index clamped `[0, length]`. React wiring: `next !== rows` → `commitRowList(next, 'insert')` — one funnel (onDataChange once, undoable, audit `type:'insert'`, not selected). Additive only: 6 files, zero props/i18n/styles/events/audit-enum changes, vue/solid/svelte untouched.
