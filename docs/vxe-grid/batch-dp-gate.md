✅ **Gate PASS complete** for 批 DP (表格滚动条增强, iris 独有). Review verdict was **PASS** (4 LOW/INFO, no blockers). Feature skeleton shipped at `61ec5418`; DP commit `107bf8af` closed the real gap — hover color was previously a no-op (`primary → primary`, baseline observation ①) — plus a default-off negative assertion (observation ③).

## Gate results

| Check                                                                  | Result                                                                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (135 cached)                                                                                                |
| `pnpm audit:security`                                                  | **0 known vulnerabilities**                                                                                                              |
| `pnpm gen:manifest` + `check:manifest`                                 | **up to date** — regenerated, 155 components × 4 frameworks, 86 tokens, zero diff (`scrollbarThumb` already in props flow, no new types) |
| `git diff --check` + commit hooks                                      | Clean; filesize/budget hooks pass                                                                                                        |

## Final test counts

| Suite                                                     | Files | Tests       |
| --------------------------------------------------------- | ----- | ----------- |
| react (incl. DP 14/14 in `batch-dl-dt.test.tsx`)          | 246   | **2819**    |
| core                                                      | 104   | **1597**    |
| DP suite `batch-dl-dt.test.tsx` (2 DP cases incl. on/off) | —     | **14/14**   |
| turbo tasks                                               | —     | **180/180** |

## Spec compliance (review-verified)

- `scrollbarThumb?: boolean` opt-in default **false** (`props/advanced.ts:198`), root marker absent when off (`Table.tsx:8070`)
- CSS: 8×8px thin thumb + `--iris-radius-sm` radius + Firefox `scrollbar-color` (`table-css.ts:153-175` — sole runtime injection source)
- **Hover is a real enhancement**: rest `color-mix(in srgb, var(--iris-primary) 60%, transparent)` → `:hover` full `var(--iris-primary)` (baseline observation ① no-op fixed)
- Covers root container + `[data-iris-virtual-scroll]` (VirtualScroll.tsx:361 real attribute)
- Constraints: core untouched (framework-free), react only, additive only, zero hardcoded colors, no dist/tgz

## Docs updated

- `docs/vxe-grid-comparison.md` (iris 独有 section) — added 批 DP row (`scrollbarThumb` token thumb: 8×8px + radius-sm + Firefox scrollbar-color; rest→hover `color-mix over --iris-primary`; root + virtual-scroll coverage; off → zero root marker byte-locked; observation ② twin-copy de-sync left to a future single-source refactor) + appended 构建状态 summary
- `docs/vxe-grid/batch-dp-gate.md` — rewritten as the real gate report (DO precedent)
- `docs/vxe-grid/DECISIONS.md` — gate record appended

## Commit

**`<this commit>`** `feat(table): grid 批 DP——表格滚动条增强（iris 独有）`

Working tree clean after commit; review findings LOW/INFO tracked in `batch-dp-review.md` — nothing blocking.
