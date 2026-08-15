Gate complete. Summary:

## ✅ PASS → Gate executed, committed

**Verdict:** PASS (3 non-blocking findings; applied the one doc suggestion)

**Full repo gate** (`turbo run test typecheck lint build --concurrency=2`): **180/180 successful** (125 cached) · audit **0 vulnerabilities** · `gen:manifest` regenerated → **155 components × 4 frameworks, 86 tokens**, `check:manifest` up-to-date.

**Final test counts** (all passed, total **8238**):

- core **1517/1517** · react **2232/2232** (+13 from 批 BN `row-height.test.tsx`) · vue 1531 · solid 974 (+34 hydration) · svelte 916 (+31 hydration)

**Comparison doc:** `docs/vxe-grid-comparison.md` iris 独有 section — 批 BN row `rowHeight` was already synced by the adapt commit; added the review's one suggested sentence clarifying the **data-row-only scope belongs to the non-virtual path** (virtual path: group-header/summary plan slots also consume the fn at plan indices). Also carried the previously uncommitted BM gate docs (`DECISIONS.md`, `batch-bm-gate.md`) plus the BN batch artifacts (`batch-bn-{baseline,adapt,review}.md`) per `git add -A`.

**Commit:** `94a1ad190e4a326d94b45bf650e6af25d575000b` — `feat(table): grid 批 BN——行高自定义（iris 独有）` (6 files, +108/−12; lint-staged prettier clean, change-budget warning non-blocking: 6 files vs target 5 — multi-framework fan-out exception).

Working tree clean.
