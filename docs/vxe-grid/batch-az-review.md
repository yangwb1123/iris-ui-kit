Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-az-review.md` — **PASS** (5 findings, no functional defects).

## Verification results

| Command                                               | Result                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| react table tests (`vitest run src/primitives/table`) | 750 passed / 56 files, incl. 8 new annotation tests                                                  |
| react typecheck                                       | clean                                                                                                |
| react lint                                            | 0 errors; 1 complexity warning **verified pre-existing** (worktree lint of `b8c8dfb9` → same 241/70) |
| `audit:security`                                      | no vulnerabilities                                                                                   |
| `audit:tokens`                                        | exit 1 but **pre-existing only** (same exit at HEAD~1; zero AZ entries)                              |
| `check:manifest`                                      | up to date; react-only propCount 141→143                                                             |

## Checklist findings

1. **Key format/precedence/title — PASS**: lookup `annotations[\`${k}::${col.key}\`]`(Table.tsx:357) uses the exact`cellId` delimiter (`${rowIdent}::${colKey}`, Table.tsx:2037) with the same `k`; `cellNoteOf`gives dynamic > static > none;`cellTitle` = editing → note → compare → tooltip (note beats tooltipConfig, tested).
2. **Badge — PASS**: zero nodes when un-noted; `position: relative` only in the note case and spread **before** `pinnedStyle` (Table.tsx:5055→5077), so pinned sticky cells keep stickiness and the badge anchors to the sticky box; `var(--iris-warning, var(--iris-primary))` token-only; real span (no `::after` collision with dirty dot).
3. **Additive/manifest/core-free/tokens — PASS**: purely additive diff, react-only, manifest regenerated (141→143, single-line props), core untouched, no new token-audit warnings.

## Findings

- **P2** `batch-az-baseline.md`: committed file is 19 lines but claims "62 lines" and "13 fiats F1–F13 included for gate arbitration" — the full spec/fiats referenced for gate arbitration are **not in the repo** (lost when the adapt commit truncated the baseline). Should be restored before the gate runs.
- **P3** `vxe-grid-comparison.md:54`: propCount "140→142" is off-by-one; actual 141→143.
- **P4** Static `''` annotation yields a vestigial `title=""` (only dynamic path filters `''`; static branch uses `?? null`) — violates the documented "null/'' renders nothing".
- **P4** Note-vs-compare resolved note-wins (flagged F4) but is undocumented in the comparison doc and untested with `compareWith`.
- **P5** Attribute naming deviates from baseline's locked `data-iris-cell-note` span (cell carries it; span is `data-iris-cell-note-badge`) — internally consistent, cosmetic only.
