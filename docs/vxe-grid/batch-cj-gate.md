Gate complete. Summary:

## ✅ Batch CJ Gate — PASS

**Review verdict**: PASS (0 MAJOR / 0 MEDIUM). The single **P3** finding was fixed in this gate: `props.ts` `shortcutHints` JSDoc `*/` moved to its own line per the `charCount` precedent → regenerated manifest description now carries the full fail-closed ending `…Additive; default off (fail-closed).` (verified in both manifest.json occurrences). P4 (display-only capitalization) left as documented.

### Gate results

| Step                                                                   | Result                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Full repo gate (`turbo run test typecheck lint build --concurrency=2`) | **180/180 tasks successful** (4m29s, 54 cached)                                                                    |
| `audit:security`                                                       | **0 vulnerabilities**                                                                                              |
| `gen:manifest` + `check:manifest`                                      | up to date — 155×4 components, 86 tokens, propCount **170** / eventCount **31** (only diff = P3-fixed description) |
| `gen:docs-reference` + `check:docs-reference`                          | up to date                                                                                                         |
| `iris-ui-spec` audit                                                   | **0 violations** (1416 files)                                                                                      |
| Framework-free invariant                                               | core 0 framework imports                                                                                           |
| Comparison doc                                                         | `docs/vxe-grid-comparison.md` — iris 独有 table (`表格快捷键提示 shortcutHints` row) + 构建状态 批 CJ entry        |
| Prettier                                                               | clean on all changed/added files                                                                                   |

### Final test counts

- **core: 1548/1548** (6 new `formatKeyBinding`/`formatKeyBindings` tests, 1542→1548)
- **react: 2492/2492** (11 new shortcut-hints tests, 2481→2492)
- manifest propCount **170** / eventCount 31 · audit 0

### Commit

**`bdc437a9`** — `feat(table): grid 批 CJ——表格快捷键提示（iris 独有）` (9 files, +153/−20: comparison doc, DECISIONS.md, batch-ci-gate.md final polish, 4 CJ stage docs, manifest.json regen, props.ts P3 fix). Implementation itself landed earlier at `9a1dacb4` (adapt stage, 11 files +528/−4). Working tree clean.
