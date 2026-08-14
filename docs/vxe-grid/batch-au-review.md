## Verdict: PASS — `docs/vxe-grid/batch-au-review.md` written

Reviewed the AU compare-view batch (`db4afc33` + `7df7ea09`) against baseline, re-ran every gate myself, and inspected all code paths.

**Checklist results:**

1. **diffRows** — ✅ Keyed by `rowKeyField` (not position), added/removed/changed correct, per-column `Object.is` diff (type changes detected: `1` vs `'1'` → change), same rows → empty. 19 core tests pass.
2. **React wiring** — ✅ Attrs on the right rows/cells (all body paths share `renderRow`; cell lookup mirrors `getCellValue`'s `dataIndex ?? key`); compare tooltip wins on changed cells, tooltipConfig retained on unchanged, editing exempt; 3 distinct token-only backgrounds; no `compareWith`/no `rowKey` → memo null, fully inert (13 react tests pass).
3. **Additive/manifest/core/CSS** — ✅ Only additive changes (2 new core files, 1 prop, 1 i18n key en+zh, helpers, 1 test file); `check:manifest` up to date (propCount 138→139, 155×4, 0 unavailable); core framework-free grep empty; audit-tokens' 5 unknowns are all pre-existing; core 1396 + react 2027 tests, typecheck, lint, prettier all green.

**Findings (2 low, 4 info):**

1. **[LOW]** `styles.ts:117` — changed rows use `--iris-surface-selected`; baseline specified `--iris-surface-hover`. Collides visually with selection highlight and goes two-tone on hover. Fix: use baseline token or justify in DECISIONS.md.
2. **[LOW]** `Table.tsx:4816` — striped body cells paint opaque `var(--iris-surface)` over the row-level tint; compare tint invisible on striped odd rows (gutter cells only). No test covers striped + compare.
3. **[INFO]** No explicit type-change test in core suite (Object.is guarantees it mechanically).
4. **[INFO]** rowKey/index fallback could misattribute status for keyless rows whose fallback key collides (consistent with pre-existing selection/editing contract).
5. **[INFO]** `data-iris-row-added` + its CSS are dead in react (snapshot-only rows never render) — documented.
6. **[INFO]** Direction semantics (live-only → `removed`, tooltip old = live value) treat snapshot as the "new" state; per baseline but worth clarifying in JSDoc.

Nothing blocking; gate stage (turbo/E2E/size/RSC) remains per workflow.
