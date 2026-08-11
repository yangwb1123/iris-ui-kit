Verdict written to `docs/vxe-grid/batch-x-review.md`.

## Verdict: **PASS** (1 medium finding recommended before merge)

**Gates (all on committed state):** vue typecheck ✓ · test **1496/1496** ✓ · lint 0/0 ✓ · `check:manifest` zero drift (6 new props, `source: native`) ✓ · `iris-ui-spec.py` 0 violations ✓ · framework-parity ✓ · core framework-free (0 vue/react/solid/svelte imports) ✓ · audit:security ✓ · token hygiene ✓ (only `var(--iris-*)`, no hex in new code; `audit:tokens` warnings all pre-existing, none from Table.ts).

**Scope findings (numbered in the review):**

1. **MEDIUM — controlled sort sync gap** (`Table.ts:487-519` vs React `Table.tsx:998-1011`): React pushes controlled `sort`/`multiSortState` prop changes into the proxy via effects (even React-tested in `proxy-config.test.tsx:271`); Vue only pushes on internal state change. A parent driving `v-model:sort` with `remoteSort` re-queries in React but not Vue — header indicator and server rows diverge. Fix: two `watch`es guarded by `remoteSort` (+ `multiSort` split), core dedupe prevents double-requests.
2. **LOW — SSR query on server**: the `immediate` presence watch fires `ctrl.request()` during `renderToString` (React defers to effect, never runs server-side). Wasted/erroneous server fetch; loading row renders deterministically so no hydration mismatch. Fix: `typeof document !== 'undefined'` guard or `onMounted` kick.
3. **LOW — proxy+local-filter divergence**: Vue filters the loaded page by `formApplied` when proxy present but `remoteFilter` off; React filters only by the `filters` prop there (baseline's open question). Both push to server, so divergence only shows when the server ignores filters.
4. **INFO — docs drift**: `batch-x-adapt.md`/`DECISIONS.md` have uncommitted rewrites contradicting the "working tree clean" claim.
5. **INFO — `audit:tokens` red repo-wide** on pre-existing warnings, not batch-X.

All four baseline surfaces (proxy lifecycle/state/pager/write-back, form draft-applied/reset/local, multiSort array semantics + pure comparator + single-mode untouched, toolbar render/fire/batch gating) verified correct against the React reference, including the core `createRemoteTableSource` page-reset/dedupe contract.
