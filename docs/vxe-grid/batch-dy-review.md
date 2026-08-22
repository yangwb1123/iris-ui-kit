Verdict written to `docs/vxe-grid/batch-dy-review.md`: **PASS**.

## Verification results (all against HEAD `01f9ab26`)

| Check               | Result                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------- |
| core test           | 106 files / 1641/1641 ✓                                                                       |
| react test          | 252 files / 2907/2907 (17 new batch-dy tests) ✓                                               |
| react typecheck     | exit 0 ✓                                                                                      |
| react lint          | 0 errors, 2 warnings — confirmed **pre-existing** via parent worktree run (IrisTable 348→351) |
| audit               | security clean · tokens clean (3 unrelated pre-existing flags) ✓                              |
| check:manifest      | up to date ✓ (manifest tests 69/69)                                                           |
| prettier            | clean on all 7 changed files ✓                                                                |
| core framework-free | grep empty ✓                                                                                  |

## Checklist

- **Spec correctness** — matches the baseline design: two-phase machine (diff vs. committed map, mount-hidden never animates, double-rAF flip, single 200ms commit), `effectiveColumnVisibility` overlay with no `useTableColumns` signature change, `fadeByLeaf` group expansion, `Wpx↔0px` track via the shared `gridTemplateColumns` memo, token-driven CSS + reduced-motion freeze gate, SSR/StrictMode fail-closed. Reversal semantics verified correct (diff against committed map, not overlay).
- **Additive only** — only deletion is the added memo dep; zero-fade path passes the _identical_ `columnVisibility` reference; core diff 0; `TableSummaryRow` is internal-only.
- **Manifest hygiene** — 203 props / 33 events; `columnFade` present only in the react contract (vue/solid/svelte untouched); `source: native`, unavailable 0.
- **CSS tokens** — only `var(--iris-duration-md, 200ms)`, no hardcoded values.

## Findings (all LOW/INFO, non-blocking)

1. **LOW** — totals container (`Table.tsx:8531`) lacks `role="row"`, so its grid-template transition doesn't fire; track jumps while cells fade.
2. **LOW** — footer-stack cells don't fade (documented fiat) but their track collapses → content squeeze.
3. **INFO** — sequential toggles extend earlier entries' commit window (visually inert at target).
4. **INFO** — machine-off mid-flight can paint one transient fade frame (layout-effect arms before passive effect clears).
5. **INFO** — skin `--iris-duration-md` > 200ms cut short at JS commit (documented fiat).
6. **INFO** — fade-out cells remain announceable/tabbable ~200ms without `aria-hidden`.

No files modified other than the review doc; the temporary parent-commit worktree and lint-check scratch file were removed.
