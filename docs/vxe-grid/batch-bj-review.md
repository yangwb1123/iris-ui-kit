Verdict written to `docs/vxe-grid/batch-bj-review.md` — **PASS** with 3 findings.

## Review summary

**Verification (all re-run fresh):**

- core test 1475/1475 (working tree; BJ itself touches zero core files)
- react test **2193/2193 on the committed state** (via temp worktree at `a60ad3b6`) — the docs/adapt-report claim of 2194 is inflated by an _uncommitted_ BI leftover test
- react typecheck ✓ · lint 0 errors (1 pre-existing complexity warning, line shifted 1412→1462) · audit 0 vulns · `check:manifest` up to date (155×4, column field manifest-invisible — BE/BI precedent) · Prettier clean

**Spec correctness:** prop anchored exactly (types.ts after `locked`, before `preset`); module-level `isCellReadonly` beside `isCellLocked`; all **15 guard sites** present as mechanical `||` additions (beginRowEdit/Tab×2/pendingNav/beginEdit/F2/Delete/paste×2/fill/range clear/FNR×2/batch); `cellPermissionRender` — locked wins on double-set; dotted 8pt `radial-gradient(var(--iris-muted-subtle)…)` (real token in both themes) vs locked stripes; inline background-image re-asserted last; dynamic re-eval proven by row-data flip test; reads fail-inert (`data-editable`/FNR-find survive); zero-commit guards reused for all-readonly batch/paste/fill/clear. 17 tests, 484 lines ≤ 500.

**Findings:**

1. **MEDIUM** — `Table.tsx:548-558`: BJ commit smuggles an out-of-scope `sparklineSeries` `Number`-coercion hunk (behavior change to the committed BI feature, aligned with BI-review LOW #1 but covered by **no committed test** — the only test lives in the uncommitted BI worktree). Violates the baseline's additive-only file map.
2. **LOW** — `docs/vxe-grid-comparison.md:336`: claims 2194 react tests; committed state runs 2193 (2176 pre-BJ + 17).
3. **INFO** — adapt report's "pre-BJ 2177" counting includes uncommitted BI leftovers.

No files modified beyond the verdict document; working tree state untouched.
