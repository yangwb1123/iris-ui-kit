Gate complete — **PASS**, all findings fixed, full repo gate green.

## Summary

**Verdict**: PASS with 3 non-blocking findings → applied all fixes before gating:

1. **MEDIUM** — `IrisTableConditionalStyle` now exported from the react table barrel; `props.ts` imports it instead of the inline duplicate (single source of truth); type lands in `manifest.json`/`llms.txt` after regen
2. **MEDIUM** — `table-conditional-formatting.md` registered in the VitePress en Guide sidebar
3. **LOW** — new test: editing + conditionalStyles (editor stays opaque `--iris-background`, rule style survives during edit)

**Extra fix found during gate**: AX's own core test had a lint error (unused `row`/`value` in spy predicate) → `when: () => …`, core lint back to 0 errors.

## Full repo gate

| Check                                                 | Result                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ 180/180 tasks                                                      |
| `audit:security`                                      | ✅ 0 vulnerabilities                                                  |
| `gen:manifest` + `check:manifest`                     | ✅ up to date (155×4, +`IrisTableConditionalStyle`)                   |
| `check:docs-reference`                                | ✅ up to date                                                         |
| `audit:tokens`                                        | ⚠️ pre-existing warning set (verified identical at parent per review) |

## Final test counts

- **core: 1417** (91 files)
- **react: 2054** (182 files) — +1 vs review's 2053
- vue 1531 · registry 10 · icons 29 · eslint-plugin 10 · tokens 24

## Commits

```
5844964d docs: 批 AX gate 报告
1f820da6 feat(table): grid 批 AX——单元格条件格式（when 谓词 + 样式规则）
```

Report written to `docs/vxe-grid/batch-ax-gate.md`; working tree clean.
