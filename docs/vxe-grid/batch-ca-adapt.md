All green on the committed state. Batch CA is complete.

## Report

**Commits** (2, following BZ convention):

- `b44df655` — `feat(table): grid 批 CA——单元格链接自动检测（iris 独有）` (10 files, +263/−5)
- `f7426654` — `docs(table): batch CA adapt report`

**Files changed**

| File                                                     | Change                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/auto-link.ts`                         | **NEW** — framework-free `detectAutoLink(text): string \| null` (never throws): URL `/^https?:\/\/\S+$/i` + email byte-identical to `mask.ts` `EMAIL_RE`, whole-text anchored, no embedding/punctuation stripping (fiat)                                                                        |
| `packages/core/src/index.ts`                             | barrel export `detectAutoLink`                                                                                                                                                                                                                                                                  |
| `packages/react/src/primitives/table/props.ts`           | `autoLink?: boolean` after `compareWith` (scanner JSDoc convention)                                                                                                                                                                                                                             |
| `packages/react/src/primitives/table/Table.tsx`          | 3 touch points: core import · destructure `autoLink = false` · module helper `renderAutoLinkCell` (beside `contextCellText`, mask→formatter??raw chain, `typeof string` gate) + render branch **after `col.link` / before `col.formatter`** (explicit link column wins; fall-through byte-同形) |
| `packages/core/src/auto-link.test.ts`                    | **NEW** — 8 tests, 37 lines                                                                                                                                                                                                                                                                     |
| `packages/react/src/primitives/table/auto-link.test.tsx` | **NEW** — 7 tests, 94 lines                                                                                                                                                                                                                                                                     |
| `packages/manifest/{manifest.json,llms.txt}`             | regenerated via `gen:manifest`                                                                                                                                                                                                                                                                  |
| `docs/vxe-grid-comparison.md`                            | persistState row + 构建状态 line (comparison doc 2 处 per baseline)                                                                                                                                                                                                                             |

Zero changes: `types.ts` / `styles.ts` / i18n / vue / solid / svelte. Strictly additive (default off, no prop → zero anchors).

**Tests added**: 15 — core 8 (https URL / URL tail / scheme case-insensitivity / email mask-parity / plain-text null / embedded-URL null / empty null / ftp+bare-host null) · react 7 (URL anchor `data-iris-auto-link` `_blank`+`noreferrer` / email anchor / no-match plain / `col.link` wins / formatter-chain detection / no-prop lazy / anchor click stops propagation).

**Counts**: core 1517→**1525** · react 2385→**2392** · manifest propCount 165→**166**, eventCount 31 unchanged · spec `0 violations` (1415 files) · check:manifest up-to-date.

**Verification** (all ✅): core test 1525/1525 · react typecheck clean · react test 2392/2392 · react lint 0 errors (1 pre-existing complexity warning 280, verified pre-stash) · `iris-ui-spec.py --mode all` 0 violations · `gen:manifest` regenerated + committed · manifest package 69/69.

**What is left**: runner's review/gate stage; working-tree `DECISIONS.md`/`batch-bz-gate.md` are prior-stage leftovers (untouched, per BZ precedent); vue/solid/svelte alignment deferred (react-only scope — open questions O1 table-vs-column prop and O2 strict display chain resolved per baseline fiats: table-level `autoLink?: boolean`, mask→formatter detection chain).
