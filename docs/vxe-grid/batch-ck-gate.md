Gate complete. Summary:

## ✅ Batch CK Gate — PASS

**Review verdict**: PASS (`docs/vxe-grid/batch-ck-review.md` — 0 MAJOR / 0 MEDIUM; 1 P4 cosmetic + 1 P4 info). **P4 fixed in this gate**: `props.ts` `searchHighlight` JSDoc reflowed so the backticked token list `` `render`/`html`/`link`/`autoLink`/sparkline `` sits on one line — the generated manifest description no longer carries the stray space (`` `render`/ `html` ``), verified in both manifest.json occurrences; the fail-closed ending `Additive; default off (fail-closed).` is intact. P4 #2 (baseline prose file-count inconsistency) is info-only, no action.

### Gate results

| Step                                                                   | Result                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (3m39s, 110 cached; first attempt hit a pre-existing `ssr-nuxt` .nuxt race — `nuxi prepare` vs `nuxt build` concurrent write — verified green in isolation 6/6, rerun clean) |
| `audit:security`                                                       | **0 vulnerabilities**                                                                                                                                                                                     |
| `gen:manifest` + `check:manifest`                                      | up to date — 155×4 components, 86 tokens, propCount **171** / eventCount **31** (only diff = P4-fixed description)                                                                                        |
| `gen:docs-reference` + `check:docs-reference`                          | up to date (components.md / iris-tokens.css / explorer-data.ts)                                                                                                                                           |
| `iris-ui-spec` audit                                                   | **0 violations** (1416 files)                                                                                                                                                                             |
| Framework-free invariant                                               | core 0 framework imports                                                                                                                                                                                  |
| Comparison doc                                                         | `docs/vxe-grid-comparison.md` — iris 独有 table (`单元格文本搜索高亮 searchHighlight` row) + 构建状态 批 CK entry                                                                                         |
| Prettier                                                               | clean on all changed files                                                                                                                                                                                |

### Final test counts

- **core: 1559/1559** (11 new `splitSearchHits` tests, 1548→1559)
- **react: 2503/2503** (11 new search-highlight tests incl. fnr-coexistence T10, 2492→2503)
- manifest propCount **171** / eventCount 31 · audit 0

### Commit

**`d208c8fc`** (adapt stage) carried the implementation (10 files, +318/−5: core `search-highlight.ts` `splitSearchHits` + 11 tests + barrel, react `props.ts` prop + `Table.tsx` `applySearchHighlight` two call sites + `styles.ts` `SEARCH_HIT_STYLE` + 11 tests, manifest 170→171). This gate commit folds the accumulated docs + the P4 JSDoc reflow + the regenerated manifest description: `props.ts` (JSDoc), `manifest.json` (description), comparison doc (iris 独有 `searchHighlight` row + 构建状态 批 CK entry), DECISIONS.md (gate log), batch-ck-review.md, batch-ck-gate.md.

## Implementation recap

`searchHighlight?: string` (after `fnr`) — vxe has no inline search highlight. Every text cell's display chain (mask → formatter ?? raw, the same text autoLink consumes) gets a case-insensitive literal-substring search (core `splitSearchHits`: no regex, non-overlapping, odd segment indices = hits, `null` fail-closed); each occurrence renders as an inline `<mark data-iris-search-hit>` styled with the same `--iris-surface-selected` token `fnrCellStyle` uses — the distinction from fnr is the mechanism (pure inline mark, no bar/state/write-back). Single module chokepoint `applySearchHighlight` at exactly two call sites (formatter + raw fallback); render/html/link/autoLink/sparkline cells untouched (autoLink wins, documented). Core 11 + react 11 new tests (incl. T10 fnr-coexistence); manifest propCount 170→**171**, events 31 unchanged; vue/solid/svelte untouched.
