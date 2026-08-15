## Verdict: FAIL — written to `docs/vxe-grid/batch-bx-review.md`

Reviewed commit `19919b36` against the BX baseline + adapt report. All gates re-run; 2 medium findings on the primary review axes block the gate.

**Verification (independently re-run):**

- core test **1517/1517** · react test **2361/2361** (+17) · react typecheck clean · react lint 0 errors (1 pre-existing complexity warning) · `audit:security` 0 vulns · zh drift 6/6 · `check:manifest` up-to-date (155×4, props 165 / events 31; check left files byte-identical)
- core framework-free ✅ (grep empty; core only +2 i18n strings) · CSS tokens ✅ (only `var(--iris-surface)`/`var(--iris-background)`, no hex)
- Spec verified: menu keys/i18n, single+mutually-exclusive items, dual-channel with no optimistic flip (BH precedent), full `contextMenu` decoupling, right-click zero side-effects, grouped leaf gating, `pinOf` single throat (all 4 read sites), virtualization keeps pinned columns

**Findings:**

1. **MEDIUM** — `Table.tsx:2696`: controlled `pinnedColumns[col.key] ?? null` makes **absent keys ≡ explicit null**, so `pinnedColumns={{}}` silently unpins every statically-declared `col.pinned` column. Contradicts the baseline contract ("受控 null 覆盖静态" — only explicit null should win), both controlled precedents in the same component (`columnWidths`/`columnVisibility` are override-maps where absent falls back to declaration), and the prop's own JSDoc framing. Fix: `col.key in pinnedColumns ? pinnedColumns[col.key] : col.pinned ?? null` + 3 regression tests.
2. **MEDIUM** — `props.ts:222-229`: the two new prop JSDocs use an inline-`/**`-content format the manifest parser (`consumeDocComment`) can't handle — reproduced byte-for-byte. Committed `manifest.json:36429/37422` has a **truncated mid-sentence** `pinnedColumns` description; `onColumnPinnedChange` (36434/37427) has **no description**. `check:manifest` passes because regeneration is deterministic, so the corruption sails through the hygiene gate. Fix: reformat to `/**`-own-line style + `pnpm gen:manifest`.
3. **LOW** — grouped leaf header visual fill-in (`Table.tsx:8681-8687`) changes existing behavior for static-pinned grouped columns (baseline-flagged arbitration point; confirmed as reasonable symmetry fix, but add a static-pinned grouped test — current tests only cover menu-pinned leaves).
4. **LOW** — test gaps: no `pinnedColumns={{}}` + static-pinned edge; no multi-column offset accumulation.
5. **INFO** — `arch-check:ratchet`/`audit:tokens` are red repo-wide, all pre-existing (Table.tsx was 9166 lines at parent vs baseline 1255); BX adds +126 net lines to the already-baseline-exceeded file.

No source files modified (only the review doc created; `git status` shows just runner-managed `DECISIONS.md`/`batch-bx-adapt.md`). Recommendation: re-adapt fixes 1–2, confirm 3, then re-review → gate.
