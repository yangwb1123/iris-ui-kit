## Gate: PASS

The historical review was FAIL; the gapped pinned-state fix was applied and
the full gate completed at **180/180** tasks.

## Summary

**Verdict**: `batch-cv-review.md` → **FAIL** — 1 medium spec violation (Finding 1) + 2 informational.

**Fix applied** (Finding 1): `Table.tsx` `resolvePinnedCount` summed _all_ left-pinned widths, but `commitPinnedCount`'s "current" is the leading _prefix_ count. In a reachable gapped state `[A(left), B(null), C(left)]`, a zero-dx click resolved 2 vs current 1 → pinned B, unpinned C, fired `onColumnPinnedChange` ×2 + `onPinnedCountChange(2)`, violating "no-op drags fire nothing". The budget now starts from the **prefix width only** (`i < leftPinnedCount(...)`), so `resolve(0) ≡ leftPinnedCount` in every state — non-gapped behavior byte-identical (17 existing tests untouched).

**Regression test**: T18 added in a new focused file `pinned-drag-gapped.test.tsx` (main file was at 493/500 lines — split per the filesize gate). **Proven discriminator**: reverting the fix → T18 fails (1 failed | 17 passed); with fix → 18/18.

## Full gate

| Gate                                                  | Result                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks** (125 cached)                                                                        |
| `pnpm audit`                                          | **0 vulnerabilities**                                                                                 |
| `gen:manifest` + `check:manifest`                     | up to date — 155×4 components, 86 tokens, IrisTable 182 props / 32 events (byte-identical, zero diff) |
| prettier / filesize                                   | clean — 493 + 68 lines, both ≤500                                                                     |

## Final test counts

- **core: 1559/1559** (framework-free, zero core changes)
- **react: 2636/2636** (2618 + 18)
- vue 1531 · solid 1008 · svelte 947 — **repo total 8684**, all green
- lint 0 errors (1 pre-existing complexity warning)

## Commit

**`ace9950c`** `feat(table): grid 批 CV——冻结边界拖拽（iris 独有）` — fix (Table.tsx, 12 lines) + T18 regression (new file, 68 lines) + bookkeeping: `DECISIONS.md` gate entry, amended `batch-cv-adapt.md`, `batch-cv-review.md`, carried `batch-cu-gate.md`, updated `docs/vxe-grid-comparison.md` (批 CV row: review fix + 18 tests + `react 2618→2636`). Working tree clean except the untracked `batch-cv-gate.md` report, written post-commit per convention for the next batch's gate stage.
