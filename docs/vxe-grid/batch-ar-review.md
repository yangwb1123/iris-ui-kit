## Verdict: **FAIL** — 1 functional defect (Medium)

Full verdict written to `docs/vxe-grid/batch-ar-review.md`. No source files modified; the temp repro test was removed.

### Gates (all run, all green)

| Gate                   | Result                                                      |
| ---------------------- | ----------------------------------------------------------- |
| core `test`            | ✅ 1364 passed (incl. 10 new `chart-data` tests)            |
| react `test`           | ✅ 1992 passed (incl. 12 new `chart-preview` tests)         |
| react `typecheck`      | ✅ clean                                                    |
| react `lint`           | ✅ 0 errors (1 pre-existing IrisTable complexity warning)   |
| `audit`                | ✅ no known vulnerabilities                                 |
| `check:manifest`       | ✅ up-to-date, `chartPreview` react-only, propCount 134→135 |
| `check:docs-reference` | ✅ up-to-date                                               |

### Checklist

1. **buildChartData** ✅ — null/undefined→gaps; non-finite dropped; negatives in domain; empty/all-gap→`{0,1}`; flat series padded by `Math.abs(min) || 1` (zero-span impossible, scaling-bounds test asserts `(v−min)/(max−min) ∈ [0,1]`); numeric strings coerced; zero framework imports, pure `{rows,key}` reader.
2. **Chart preview** ✅ except Finding 1 — gate admits `chartPreview`, trigger after zoom toggle, numeric-leaf select (`dataIndex ?? key` indirection tested), bar/line toggle, SVG **structured JSX only** (zero strings/innerHTML), rect/polyline/dot counts + null-gap line-break tested, 20-cap + `table.total` truncation note, Esc/outside/scroll dismiss, token colors only (32 `var(--iris-*)`, no hex).
3. **Additive / manifest / core-free / tokens / i18n** ✅ — only deleted line is the gate condition (expected replacement); manifest placement react-only; en+zh keys present.

### Findings

1. **[Medium] ChartPanel.tsx:126 + Table.tsx:5861 — trigger click never closes the panel.** The outside-`pointerdown` exclusion misses `[data-iris-chart-trigger]`, unlike the batch-edit precedent it cites (Table.tsx:5044-5049, which explicitly excludes its trigger "so clicking it toggles"). pointerdown closes, then click reopens against the flushed state → the panel remounts and **resets** the selected column + kind. **Reproduced** with a temp jsdom probe (removed). Fix: add `[data-iris-chart-trigger]` to the exclusion at ChartPanel.tsx:126 + a close-by-trigger test.
2. **[Low]** adapt.md/baseline claim 9 core tests; the file has 10. Doc count stale.
3. **[Info]** Commit-stat "−6" is only the gate-condition replacement; otherwise purely additive.

Ready for the gate stage once Finding 1 is fixed.
