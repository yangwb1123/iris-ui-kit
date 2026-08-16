✅ **Batch CK gate complete — PASS**

## Review verdict

`docs/vxe-grid/batch-ck-review.md`: **PASS** (0 MAJOR / 0 MEDIUM; 1 P4 cosmetic + 1 P4 info). The P4 cosmetic finding was **fixed in this gate**: reflowed the `searchHighlight` JSDoc in `packages/react/src/primitives/table/props.ts` so the backticked token list sits on one line — the regenerated manifest description no longer carries the stray space (`` `render`/ `html` `` → `` `render`/`html` ``), verified in both manifest.json occurrences; the fail-closed ending `Additive; default off (fail-closed).` is intact. P4 #2 was info-only (baseline prose inconsistency), no action.

## Gate results

| Step                                                                   | Result                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (3m39s, 110 cached). First attempt hit a pre-existing `ssr-nuxt` flake (`nuxi prepare` vs `nuxt build` racing on shared `.nuxt` under concurrency=2) — verified green in isolation (6/6), rerun clean |
| `audit:security`                                                       | **0 vulnerabilities**                                                                                                                                                                                                              |
| `gen:manifest` + `check:manifest`                                      | up to date — 155×4 components, 86 tokens, propCount **171** / eventCount 31                                                                                                                                                        |
| `gen:docs-reference` + `check:docs-reference`                          | up to date                                                                                                                                                                                                                         |
| `iris-ui-spec` audit                                                   | **0 violations** (1416 files)                                                                                                                                                                                                      |
| Framework-free invariant                                               | core 0 framework imports                                                                                                                                                                                                           |
| Comparison doc                                                         | `docs/vxe-grid-comparison.md` — iris 独有 table row (`单元格文本搜索高亮 searchHighlight`) + 构建状态 批 CK entry                                                                                                                  |
| Prettier                                                               | clean on all changed files                                                                                                                                                                                                         |

## Final test counts

- **core: 1559/1559** (11 new `splitSearchHits` tests, 1548→1559)
- **react: 2503/2503** (11 new search-highlight tests incl. fnr-coexistence T10, 2492→2503)
- manifest propCount **171** / eventCount 31 · audit **0**

## Commit

**`fcf9a661`** — `feat(table): grid 批 CK——单元格文本搜索高亮（iris 独有）` (8 files, +129/−58: comparison doc, DECISIONS.md, batch-ck-gate.md report, batch-ck-review.md, batch-cj-gate.md/adapt polish, manifest.json regen, props.ts P4 fix). Implementation itself landed earlier at `d208c8fc`. Working tree clean.
