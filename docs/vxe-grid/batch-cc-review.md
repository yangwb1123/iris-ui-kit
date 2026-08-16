Verdict written to `docs/vxe-grid/batch-cc-review.md`.

## Verdict: **PASS** (0 blocker / 0 major; 2 low + 4 info)

**Verification (all green, on HEAD `1ce53cbf`):**

- Core test 1533/1533 · React test 2409/2409 (10 new) · typecheck clean · lint 0 errors (IrisTable complexity warning confirmed identical at parent via worktree run)
- `audit:security` 0 vulns · `check:manifest` up to date (propCount 167→168) · spec script 0 violations (1415 files) · framework-parity/docs-reference/build/prettier clean
- Core framework-free (0 framework imports, unchanged) · additive only (7 files; types.ts/styles.ts/core/vue/solid/svelte untouched; default-off DOM byte-identical, locked by `filter-panel.test.tsx:168` + new test) · CSS tokens clean (zero new token usage; `audit:tokens` 5 warnings all pre-existing)

**Spec conformance:** onInput→scrollHeight→pure `autoHeightSize`→inline height/maxHeight/overflowY ✓, 6-row cap ✓, bidirectional shrink ✓, mount-measure for pre-filled drafts ✓, row+cell modes both wired ✓, mandatory grow/cap tests mapped T1+T7/T2+T8 ✓.

**Key findings:**

1. **[Low]** Real-browser cap boundary off by the textarea's 8px vertical padding — `scrollHeight` includes padding but `maxHeight = 6×lineHeight` doesn't, so "exactly 6 rows no scrollbar" (baseline item 3, test T3) only holds at zero padding; jsdom can't catch it (stubbed scrollHeight). `Table.tsx:969-973, :875`.
2. **[Low]** Line-height cache is page-lifetime despite "per session" comment — a later column with different font-size sizes against a stale line-height. `Table.tsx:978-995`.
   3–6. Info: `rows=1` a11y nuance; F6 fixed-rowHeight clipping matches documented fiat; `autoHeightSize` doesn't leak through the barrel; no-op `onInput` when off is byte-identical.

No source files were modified during review.
