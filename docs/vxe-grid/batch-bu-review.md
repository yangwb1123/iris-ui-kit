**Verdict: FAIL** — written to `docs/vxe-grid/batch-bu-review.md`

## Summary

Reviewed commit `d892160d` against `batch-bu-baseline.md`. All static gates pass, but the documented fixed-height behavior is empirically false.

**Gates re-run (all ✅)**

- core test 1517/1517 · react test 2306/2306 (+10) · typecheck clean · lint 0 errors (1 pre-existing warning)
- audit:security clean · audit:tokens only pre-existing warnings · check:manifest up-to-date (propCount 160→161) · iris-ui-spec 0 violations
- core framework-free (0 diff in core/vue/solid/svelte/tokens/theme/skins) · token-only CSS (`--iris-muted`, `--iris-space-xl`, `--iris-font-size-lg`) · additive-only (presence-gated, empty-string gate, root-style change conditional)

**Empirical browser verification (Chrome via Playwright, scratch harness in /tmp, removed)**

- ✅ Layering: watermark above static rows/footer/pager; below sticky header z2 and pinned columns z1 in both modes; zoom fixed wins
- ❌ **HIGH** — fixed-height scroll: the layer is `position: absolute; inset: 0` on the root, which **is** the scroll container (`overflow: auto`). Verified: before scroll layerTop=433.6; after scrolling to mid, layerTop=**-2782.4** — the watermark scrolls away with the rows and disappears from the viewport. The baseline/comparison doc/code comments all claim "fixed-height 下锚视口、随行滚动不动", which doesn't exist. For a scrollable grid (the dominant production config) the watermark is invisible after any scroll. Fix: `position: sticky; top: 0; height: 100%` anchoring (or a non-scrolling wrapper), or explicitly re-document scroll-with-content.
- **LOW** — test ⑨ pins `position: absolute; inset: 0` (the exact cause) and can't detect the claim; jsdom can't scroll, but the anchoring strategy is assertable.
- **INFO** — `data-iris-watermark` attr shape diverges from the standalone `IrisWatermark` primitive's wrapper, so a global `[data-iris-watermark]` selector matches two element shapes.

No files were modified (only the review markdown was created; temp harness deleted; `git status` shows just the pre-existing pipeline files).
