Review complete. Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-aa-review.md`.

## Verdict: **PASS** (1 medium finding, 3 low/info)

**Gates — all green:** solid typecheck ✅ · lint 0 errors ✅ · tests 939+34 (parity-aa 23/23) ✅ · `pnpm audit` ✅ · `check:manifest` (155×4 aligned) ✅ · prettier ✅ · core framework-free grep ✅ · CSS-token hygiene ✅.

**Checklist outcome:**

1. **columnVisibility** — PASS: `displayColumns` feeds every render path (flat/grouped headers, body, summary, gridTemplate, colTrack, width seeding); no bypass sites; reference-preserving.
2. **filters** — PASS: substring case-insensitive, `''` inactive, `filterMethod` override, react-identical proxy/local merge semantics.
3. **seq/spanMethod** — mostly PASS with one reproduced defect (finding #1): seq lands in all 5 grid sites with verified track arithmetic; occupied-set rebuild is correct for sort/filter/refetch (proven empirically — the `bodyEntries` wrapper identities force Solid `<For>` re-runs), but **stale when the `spanMethod` prop is swapped to a different function without data change** (reproduced: Bob's covered cell stays blank after swapping to a no-span fn).
4. **proxyConfig** — PASS: presence-keyed lifecycle, SSR-safe, dedupe/no-double-request verified, solid `IrisPagination` + `pagerConfig`, edit write-back parity, `autoLoad:false`.
5. **multiSort** — PASS: cycle byte-identical to react (`append asc → desc → remove`), chained comparator, badges, controlled/uncontrolled, remote `sorts`.
6. **formConfig** — PASS: draft/applied, signature re-seed, submit→`{filters, page:1}`, reset refetch-on-noop.
7. **toolbar** — PASS: refresh (proxy re-query parity), export, buttons, batch-with-keys.
8. **Hygiene** — PASS: core untouched, additive only, manifest regenerated, tokens only.

**Findings:** #1 MEDIUM (IrisTable.tsx:586-600/623-637 — spanMethod swap staleness, fix: key the occupy rebuild on `props.spanMethod` identity; regression test included in the review) · #2 LOW (spanMethod×virtualScroll windowed coverage, documented deferral, suggest fail-closed) · #3 INFO (summary lacks detail-track placeholder — same defect exists in react, parity) · #4 INFO (`onColumnVisibilityChange`/`onFiltersChange` declared but never fired — deferred panel).

No source files were modified; scratch tests ran against the repo and were deleted — tree clean except the runner's stage-log docs and this review file.
