# Verdict: **PASS**

`docs/vxe-grid/batch-bf-review.md` written.

## Summary

**Spec correctness — ✅.** `exportVersionCsv: (index: number) => string` lands at the exact anchors (types.ts:582 after `restoreVersion`; Table.tsx:3638–3645 after `restoreVersion,`). It's a faithful reuse of the batch-AP pipeline — `exportCsv(withComputedFormulaCells(entry.rows, viewColumnsRef.current, formulaTablesRef.current), viewColumnsRef.current)` is byte-identical in shape to `exportSelectionCsv` — with `history.get(index)` → `undefined` → `''`. All 8 mandated tests exist and pass, covering pre-change semantics, out-of-range/trimmed/no-prop → `''`, post-restore byte-equality, masks (batch AY), and formula materialization + hidden-column exclusion.

**Additive only — ✅.** `git diff` = Table.tsx +14, types.ts +2; one new 147-line test file. Zero core/props/i18n/panel/CSS changes.

**Manifest hygiene — ✅.** `check:manifest` passes (155 components, no diff); handle methods are manifest-invisible by design, consistent with `restoreVersion`/`exportSelectionCsv`.

**Core framework-free — ✅.** No core files touched; `createVersionHistory.get` already existed.

**Verification:** core 1457/1457 · react 2140/2140 (190 files) · typecheck clean · lint 0 errors (1 pre-existing complexity warning) · audit:security clean.

## Findings

1. **[LOW]** Baseline's "locked invariant" (`batch-bf-baseline.md:9`: after `restoreVersion(i)`, `exportVersionCsv(i) === exportCurrentViewCsv()` byte-identical) is over-scoped: `exportVersionCsv` exports the raw ring snapshot while `exportCurrentViewCsv` exports the **filtered+sorted** view (`filteredDataRef`, Table.tsx:3501/3776/3849). With an active filter or sort, the equality breaks — test #6 only covers the unfiltered case. Implementation is faithful to the baseline's own row-source decision; fix = scope the claim in baseline/JSDoc and optionally add a divergence test. No code change required.
2. **[INFO]** A valid version with empty pre-change rows exports a header-only string (`"Name,Age\n"`), so `''` strictly means unknown/no-prop — consistent with `exportCurrentViewCsv`.
3. **[INFO]** `audit:tokens` fails on 5 legacy tokens — pre-existing (batch P/A), batch BF added zero CSS.

No implementation files were modified (verdict file is the only write).
