Gate stage complete. **Review verdict was FAIL** → fixes applied, browser-verified, full gate green, committed.

## Review fixes (per `batch-bu-review.md`)

| Finding                                                                                                                        | Fix                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HIGH** — absolute `inset: 0` layer on the scroll-container root scrolled away with rows (verified: layerTop 433.6 → −2782.4) | Layer is now a **sticky first child** (`position: sticky; top: 0; left: 0; height: 100%`) — at content top its normal position is the scrollport top, so it pins from scroll 0. Naive sticky-after-rows was tried and failed the same way; first-child is the operative part |
| **LOW** — test ⑨ pinned the broken `absolute; inset: 0`                                                                        | Test ⑨ now asserts the anchoring strategy: `root().firstElementChild === layer` + sticky/top 0/left 0/height 100%                                                                                                                                                            |
| **INFO** — `[data-iris-watermark]` matched two element shapes vs the primitive                                                 | Table layer now mirrors `IrisWatermark`'s DOM exactly: wrapper `data-iris-watermark` → `data-iris-watermark-overlay` (absolute inset-0, aria-hidden) → 72 tiles                                                                                                              |

## Empirical browser verification (Chrome/Playwright, harness removed)

14/14 assertions: after scrolling 1500px the watermark top stays **24→24** (rows moved 3624→2124), fully inside viewport; layering z-auto < pinned z1 < header z2; sticky header still pinned; tiles rotate −22deg, `var(--iris-muted)`, 72 count.

## Gate results

- **Full repo gate**: `turbo run test typecheck lint build --concurrency=2` → **180/180 successful**
- **Audit**: security 0 vulnerabilities; tokens only the 2 pre-existing warnings
- **Manifest**: `gen:manifest` (155 × 4, propCount 161) + `check:manifest` up-to-date
- **Prettier** clean · react typecheck clean · lint 0 errors (1 pre-existing warning)

## Test counts

- **core**: 1517/1517 · **react**: 2306/2306 (incl. 10 watermark tests + vxe-parity spec)

## Commit

**`9ee0045d342a0595819f7e543d0d46de069d2946`** — `feat(table): grid 批 BU——表格水印（iris 独有）` (10 files: Table.tsx, styles.ts, props.ts, watermark.test.tsx, manifest.json, comparison doc ×3, review/adapt/DECISIONS docs)

`docs/vxe-grid/batch-bu-gate.md` (gate report with hash) left as uncommitted pipeline state, matching the BT gate precedent.
