Gate complete. Summary:

## Verdict: PASS → full gate run ✅

Review (`batch-bc-review.md`) was **PASS** with 3 findings (1 medium, 2 low) — all **non-blocking**:

1. **Medium** — `buildRangeTsv` copy / `exportActiveRangeCsv` / FNR replaces read `getCellValue` at handler time against the render-scoped module slot; on multi-table pages these use the last-rendered table's tables. Disclosed as a baseline fiat (the fiat's dual-channel rationale covered only the two CSV handles); same 1-line explicit-arg pattern would fix, deferred per fiat disclosure.
2. **Low** — adapt doc claimed "working tree clean" while DECISIONS.md + adapt doc were dirty (review bookkeeping); included in this gate commit.
3. **Low** — committed baseline doc is a 15-line summary; the 6 fiats live in the adapt doc, not the baseline — gate arbitrability preserved via the adapt doc's fiat section.

No fixes applied (non-blocking); gate ran as-is.

## Gate results

| Check                                 | Result                                                    |
| ------------------------------------- | --------------------------------------------------------- |
| `turbo run test typecheck lint build` | **180/180 tasks successful** (4m59s, 55 cached)           |
| `pnpm audit`                          | **0 vulnerabilities**                                     |
| `gen:manifest` + `check:manifest`     | 155 components ×4 frameworks, 86 tokens — up to date      |
| `check:docs-reference`                | up to date (3 files)                                      |
| Prettier                              | formatted reviewer-produced docs (review/adapt/DECISIONS) |

## Commit

```
feat(table): grid 批 BC——跨表引用公式（iris 独有）
```

(includes review verdict + gate/adapt/DECISIONS bookkeeping)

## Final test counts

- **react: 2110 passed** (187 files) — batch BC +12 (`formula-tables`)
- **core: 1457 passed** (94 files) — batch BC +19 (`formula-tables`)
- Full gate also covered vue/solid/svelte, all 27 packages, and desktop shells (Electron/Tauri/Wails smoke).
