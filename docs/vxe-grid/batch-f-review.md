**Verdict: PASS** — written to `docs/vxe-grid/batch-f-review.md`. No files were modified beyond the review document (my accidental `check:manifest` regeneration of manifest.json/llms.txt was reverted).

## Summary

**All 8 checklist items verified green:**

1. **Multi never breaks single** — every new path gated on `multiSort`; single-mode proxy query objects byte-identical (integration test asserts exact payload)
2. **Multi cycle** — append asc → desc in place → remove; click order = array order; seq badge = `multiIdx+1` on non-primary columns, placement/removal tested
3. **Comparator** — first non-zero wins, tie → next column, full tie → 0 (stable `[...data].sort()`); precedence + per-column desc flip tested
4. **Proxy** — multi sends `sorts` (sort nulled), single sends `sort` only; core dedupe is order-sensitive and `undefined`≡`[]`
5. **validConfig.showMessage=false** — commit blocked, `aria-invalid` retained, message + `aria-describedby` skipped; both branches tested
6. **Handle methods** — all three work; `selectAll` respects checkMethod, `toggleRowSelection` bypasses it
7. **expandAll** — ref-guarded one-shot, waits for first proxy page, deep-chain via `getSubRows`, unions with `defaultExpandedRowKeys`
8. **Additive/hygiene** — core framework-free grep = 0; CSS `--iris-*` only (token audit diff-identical to HEAD); manifest scanner extracts all additions (67/67); spec script 0 violations

**Findings (all LOW, non-blocking):**

- **F1** Table.tsx:886-895 — `selectAll` uses `set` (replace), dropping cross-page/ineligible selections; inconsistent with vxe's set-only semantics and the header `toggleAll` union. Fix: union.
- **F2** Table.tsx:967-993 — expandAll seed is burned even when the first page has no child-bearing rows; a later proxy page with parents never expands. Fix: only burn ref when `keys.length > 0`.
- **F3** Table.tsx:929-930 — multiSort mode sorts tree children with the single comparator (null → unsorted). Fix: use the multi comparator.

Plus 4 info notes (manifest staleness per batch D precedent, legacy TableRow.tsx, controlled-reject double query, ratchet magnitude growth).
