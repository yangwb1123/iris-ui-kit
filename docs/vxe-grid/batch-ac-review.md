Verdict written to `docs/vxe-grid/batch-ac-review.md` — **PASS** (2 low + 3 info). Worktree is clean: no source files modified (probes were run from temp files and removed).

## Review summary

**Verification (all green):**

- svelte typecheck 0 errors (5 warnings pre-existing in untouched `IrisCompose.svelte`) · test 125 files/916 tests + 31 hydration pass (17 new `parity-ac`) · lint 0 · prettier clean · `audit:security` clean · `audit:tokens` no new findings · `check:manifest` up to date (155 × 4 aligned, svelte contract extracts natively, no bogus props) · `check-framework` parity · core framework-free grep empty

**Checklist results:**

1. **columnVisibility** — every render path (header flat/grouped, body, summary, grid template) consumes `displayColumns`/`leafColumns`; `!== false` semantics match react; probe-verified reactive hide/re-show after mount. No `onColumnVisibilityChange` event (react's fires only from the batch-U settings panel — in-contract deferral; LOW finding).
2. **filters** — substring, case-insensitive, `''` stripped at both local filter and core proxy normalization (probe confirmed `{name:''}` doesn't re-query, `{name:'Al'}` does); `filterMethod` override identical to react.
3. **seq/spanMethod** — `seqValue` chain identical to react (probe verified cumulative proxy seq `1,2 → 3,4`); `buildSpanPlan` implements the same occupied-set semantics as react's render-time ref, as a pure plan that's correct across virtual windows.
4. **proxyConfig** — presence-keyed `$effect` controller (inline identity never recreates; cleanup destroys on absent/unmount), loading/error from controller state, mutually-exclusive sort/sorts channels, remoteFilter merges formApplied, pager = svelte `IrisPagination` props, edit write-back survives until the next data reference.
5. **multiSort** — click-order append/cycle/remove, chained comparator, badges, aria-sort all react-identical; single mode untouched; controlled probe confirmed no optimistic flip on parent rejection.
6. **formConfig** — draft/applied, signature-keyed re-seed, submit → merged filters + page 1, reset → defaults + forced refetch on no-op.
7. **toolbar** — title/refresh/export/buttons/batch match react markup + gating + `[...displaySelection]` keys.
8. **Svelte rules** — `proxyState` naming (no `state` collision), core untouched, additive-only diffs, zero hardcoded hex (all `var(--iris-*)`), manifest regenerated cleanly.

Findings are all LOW/INFO: missing `onColumnVisibilityChange` (deferred surface), `grouped` computed from `displayColumns` vs react's `safeColumns` (matches solid/vue — edge-case only), 3 untested behaviors (proxy cumulative seq, seqMethod, span×virtual) plus an overclaiming test name, a truncated `filters` docstring in llms.txt, and two cosmetic grid deltas (seq track in summary, colspan origin styling) where svelte is strictly better aligned.
