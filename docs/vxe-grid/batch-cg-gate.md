Working tree clean. Done — gate complete.

## 批 CG Gate — PASS ✅

**Verdict**: Review PASS (`docs/vxe-grid/batch-cg-review.md`, 0 blocker / 0 major; 1 low / 4 info — none blocking, no code fixes needed).

### Gate results

| Step                                                                   | Result                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful**                                                                    |
| audit:security                                                         | **0 vulnerabilities**                                                                           |
| audit:tokens                                                           | exit 1 with only pre-existing warnings — **0 new** from this batch                              |
| gen:manifest + check:manifest                                          | up to date — 155 components × 4, **propCount 168→169** (`charCount` description fully captured) |
| prettier                                                               | clean                                                                                           |
| comparison doc                                                         | `docs/vxe-grid-comparison.md` updated — iris 独有 section + 构建状态 paragraph (批 CG entries)  |
| char-count tests                                                       | 14/14 pass standalone (verified post-commit)                                                    |

### Commits

- **`b73b7095f1746f4346aa69a643aa58d291082a6e`** — `feat(table): grid 批 CG——单元格字数统计（iris 独有）` (5 files: comparison doc ×2 entries, DECISIONS.md, cf-gate + cg-adapt re-formats, cg-review verdict)
- **`90de62af3c03cd42ab52874fc280c5e4c268d341`** — `docs(table): batch CG gate report`

### Final test counts

- **react: 2454/2454** (14 new char-count tests: 6 编辑计数 + 8 选区计数)
- **core: 1533/1533** (unchanged — framework-free, 3 i18n default keys)
- **manifest: 155×4 components, propCount 169**, check:manifest green
- **spec: 0 violations** · audit: 0 vulnerabilities
