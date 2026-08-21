# Batch Y (vue parity round 2) — Adversarial Review Verdict

> The original verdict below is retained as historical evidence. The follow-up
> re-review at the end of this file is the current status.

**Commit reviewed:** `6ef3dc36` · **Date:** 2026-08-11 · **Reviewer:** adversarial pass

## Verdict: **FAIL**

One High-severity regression (SSR invariant violation + duplicate mount query) plus one
Medium (size gate left red) block the batch. All other checked semantics are correct and
match the React reference; deviations are the documented ones.

---

## Gates run (all from a clean tree)

| Gate                                        | Result                                   |
| ------------------------------------------- | ---------------------------------------- |
| `pnpm --filter @iris-ui-kit/vue typecheck`  | ✅ 0 errors                              |
| `pnpm --filter @iris-ui-kit/vue test`       | ✅ 1510/1510 (10 new parity-y)           |
| `pnpm --filter @iris-ui-kit/vue lint`       | ✅ 0 errors                              |
| `pnpm audit --audit-level low`              | ✅ 0 known vulnerabilities               |
| `node scripts/check-generated.mjs manifest` | ✅ up to date (155 components × 4)       |
| `node scripts/check-generated.mjs docs`     | ✅ up to date                            |
| `iris-ui-spec.py --mode all --json`         | ✅ 0 violations                          |
| `prettier --check` (4 changed files)        | ✅                                       |
| `node scripts/check-size.mjs`               | ❌ **vue 97.3KB / 88KB budget** (see F2) |
| core framework-free grep (`from 'vue'       | 'react'                                  | 'solid-js' | 'svelte'`in`packages/core/src`) | ✅ empty; `git diff` vs parent shows **zero core changes** |

---

## Findings

### F1 — HIGH — remoteFilter + non-empty `filters` prop fires a query during setup/SSR and double-fires on mount

**File:** `packages/vue/src/primitives/table/Table.ts:713–722`

```ts
watch(
  [formApplied, () => props.filters], // ← batch Y added `() => props.filters` to the sources
  () => {
    if (proxyCtrl.proxy.value && remoteFilter.value) {
      proxyCtrl.setParams({ filters: mergeFormFilters(props.filters ?? {}, formApplied.value) })
    }
  },
  { immediate: true },
)
```

`setParams` → core `applyParams` → `loadClamped()` fires a real request whenever the merged
map differs from the controller's params. With `proxyConfig.remoteFilter: true` and a
non-empty `filters` prop, the **immediate** flush runs during `setup()`:

- **SSR:** the user `query` executes inside `renderToString` and the server HTML renders
  `data-iris-table-row="loading"` — directly violating the invariant locked down in
  `Table.ssr.test.ts` ("never fires the proxy query during renderToString", "server HTML
  stays on the INITIAL state"). The existing SSR test does not cover this because it passes
  no `filters`/`remoteFilter`.
- **Client:** the query fires **twice** on mount (setup immediate watch + `onMounted` kick)
  vs React's single effect kick.

Both empirically reproduced against the built dist:

```
CASE 1 (remoteFilter + filters prop): query calls during SSR = 1, html has loading row: true
CASE 2 (remoteFilter only, batch-X baseline): query calls during SSR = 0
CLIENT (remoteFilter + filters prop): query calls after mount+settle = 2
```

Batch X was safe only by accident (`formApplied` always starts `{}`, so the immediate push
was a no-op); batch Y added a source whose value can be non-empty at setup.

**Fix (React parity):** seed `initialParams.filters` with the merged map
(`remoteFilter ? mergeFormFilters(filters ?? {}, {}) : {}`) like React does, and drop
`immediate: true` from the watch — or gate the immediate flush behind a `mounted` flag so
the single `onMounted` request carries the merged filters. Add an SSR case with
`remoteFilter + filters` to `Table.ssr.test.ts`.

### F2 — MEDIUM — `pnpm size` gate red at HEAD; batch Y contributes and did not raise the budget

**File:** `scripts/size-baseline.json` / `scripts/check-size.mjs` (budget `vue: 88`)

```
✗ @iris-ui-kit/vue     OVER  97.3KB / 88KB gzip (Δ +14.8KB)
✗ @iris-ui-kit/core    OVER  38.4KB / 36KB gzip   (pre-existing; core untouched by batch Y)
✗ @iris-ui-kit/react   OVER  104.7KB / 80KB gzip (pre-existing)
✗ @iris-ui-kit/solid   OVER  97.3KB / 95KB gzip  (pre-existing)
! vue: import { useForm } → tree-shaken WARN 80.2KB / 80KB (Δ +10.2KB)
```

The batch-Y adapt report claims "all gates" but does not list `pnpm size`; the commit's
+597-line `Table.ts` is a material contributor to the vue overage. Per the script's own
policy ("Raise a budget deliberately (in a reviewed commit) when a real feature grows a
package"), the vue budget should have been raised in the batch-Y commit.

### F3 — LOW / informational — `update:columnVisibility` emit is declared but never fired

**File:** `packages/vue/src/primitives/table/Table.ts:512`

Declared channel with no firer anywhere in the adapter. Consistent with the batch-Z
handoff ("toolbar column panel fires the already-declared emit"), and React only fires the
equivalent from its (batch-S) column panel, so this is a planned surface, not a defect.
Worth stating explicitly in the prop docs: the controlled map is currently write-only from
the table's side.

### F4 — LOW / informational — summary-row lead cells still omit the expand track

**File:** `packages/vue/src/primitives/table/Table.ts:1848–1897 (`leadSummaryCells`)`

With `renderDetail` + `seq`/`selection` + summary, the summary's lead placeholders
auto-place into tracks 1..3 while `gridTemplateColumns` declares drag/seq/**expand**/selection:
the `__selection` placeholder lands in the expand track and every data cell shifts one
track left. Pre-existing (React's summary has the identical quirk — it renders only the
selection placeholder against a gridTemplate that includes the expand track), and batch Y
fixed drag/seq but not expand — so the batch-Y claim of "deterministic alignment in every
combination" is overbroad for expand+summary. One-line fix: push an expand placeholder in
`leadSummaryCells` when `showDetail`.

### F5 — informational — manifest inline-function type truncation

`packages/manifest/manifest.json` vue `spanMethod` → `(params: {`, `onDataChange` →
`(rows: Array<Record<string, unknown>>) =` (truncated at the arrow). Pre-existing scanner
artifact, symmetric with React (React `spanMethod` truncates too); named-interface props
(`columnVisibility` → `IrisTableColumnVisibility`, `columnDrag` → `IrisTableColumnDrag`,
`rowDrag` → `IrisTableRowDrag`, `filters` → `Record<string, string>`, `seq` → `boolean`)
parse fully. `check:manifest` passes. Batch-Z handoff entry already tracks it.

### F6 — informational — grouped-header columnDrag fully disabled (React: leaf-only drag)

**File:** `packages/vue/src/primitives/table/Table.ts:2173** (`onPointerdown`gated on`!grouped.value`). React attaches drag to leaf header cells inside grouped headers;
Vue disables the feature entirely in grouped mode. This is the documented simplification
("Grouped headers are NOT supported") and the grouped header is otherwise untouched —
acceptable, but it is a semantic gap vs React worth surfacing in the docs rather than only
in the prop docstring.

---

## Checked and confirmed correct (against the React reference)

1. **columnVisibility** — `displayColumns` (reference-preserving when prop absent) feeds
   every render path: flat header, grouped `headerMatrix`, body, summary, filters,
   virtualization window, pinned offsets, and drag targets. Hidden columns vanish from
   all of them; the emit channel is declared.
2. **filters** — substring, case-insensitive, `''`-ignored, AND-combined with form values
   (`mergeFormFilters`, form wins), unknown keys no-op, proxy-mode server-owned with only
   the prop map filtering the loaded page — line-for-line the React semantics.
3. **seq** — `index + seqStartIndex` (default 1), leading track before selection,
   header/summary placeholders, `colTrack`/`pinnedOffsets` generalized via
   `leadTrackCount()`; the explicit-track approach is the documented deviation from
   React's auto-placement and is deterministic under virtualization + grouping.
4. **spanMethod** — occupy-set mark/skip logic byte-identical to React (`rowspan` marks
   rows below, `colspan` marks columns right, covered cells render null), cleared once per
   body pass (Vue clears at the top of every render — strictly safer than React's
   `idx === 0` clear), `gridRowEnd/gridColumnEnd: span n` applied, virtualized cells
   checked in the same order.
5. **columnDrag / rowDrag** — core `createSortable` bridge exactly like React: press →
   `tryStart` (4px threshold, returns true once) → rects captured at that moment →
   `moveOver`/`closestCenter` → `end` commits, tap cancels, rects cleared on up,
   pointerleave cancels row drag, drop onto `__seq`/`__drag` placeholders is a no-op.
   `rowDrag` additionally writes the local rows ref and fires `onDataChange` — the
   documented deviation for Vue's prop flow (React leaves the reorder to the parent), and
   it is tested.
6. **expose** — `loadData` writes `liveData`/`localRowsOverride` with **no query**
   (asserted: query call count unchanged) and fires `onDataChange`; parent `data`
   re-feed clears the local override (controlled prop wins again); `reloadData`/
   `commitProxy` are safe no-ops without a proxy; `getProxyInfo` maps
   `page/pageSize/total` identically to React and returns null without a proxy.
7. **Core / additive / CSS** — zero core changes, framework-free grep clean, all new
   props optional with `leadTrackCount() === 0` restoring byte-identical rendering, only
   `var(--iris-*)` tokens (the `rgba(99,102,241,0.12)` fallback is pre-existing and
   matches React), manifest regenerated and consistent across all four frameworks.

---

## Required before re-approval

- [x] F1: don't push remote filters during setup (seed `initialParams.filters` and/or
      gate the immediate watch behind mount); add an SSR regression test with
      `remoteFilter + filters`.
- [x] F2: raise the vue size budget deliberately in the batch commit (or trim).
- [x] Optional: F4 one-line expand placeholder in `leadSummaryCells`.

## Follow-up re-review — 2026-08-20

**Verdict: PASS**

The three concrete findings are now closed in the current worktree:

- **F1 HIGH** — `useTableProxy` seeds the merged remote-filter map in
  `initialParams`, and the mounted request remains the only auto-load request.
  A dedicated SSR case with a non-empty `filters` prop and
  `remoteFilter: true` proves `query` is not called and the server stays in the
  initial empty state.
- **F2 MEDIUM** — the Vue whole-package budget is deliberately set to 106KB in
  `scripts/check-size.mjs`; the current measurement is 102.2KB gzip.
- **F4 LOW** — summary rows now render the `__expand` placeholder between the
  sequence and selection tracks, matching `gridTemplateColumns` and body rows.

Regression evidence:

- `Table.ssr.test.ts`: 3/3, including the non-empty remote-filter case.
- `Table.test.ts`: 78/78, plus `test/summary-detail-alignment.test.ts`: 1/1,
  including `seq + expand + selection + summary` track ordering.
- Vue package suite: **1545/1545**.

F3 and F5/F6 remain informational/documented semantics; they do not block the
batch. The original failure is therefore superseded by this follow-up result.
