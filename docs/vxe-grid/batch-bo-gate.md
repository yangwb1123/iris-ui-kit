Gate stage complete — **review verdict was FAIL → fix applied → full gate green → committed**.

## Review verdict

**FAIL (1 blocking finding)**: commit `59e701c0` truncated the pre-existing BN (`rowHeight`) row mid-cell in `docs/vxe-grid-comparison.md` — no closing `|`, tail stranded as orphaned paragraph line 70 (broken markdown table, lost BN content).

## Fix applied

- Restored line 68 to BN's **full original single-line row** (byte-verified verbatim against `94a1ad19:docs/vxe-grid-comparison.md` via `diff`)
- Deleted the orphaned line 70

## Full repo gate

| Gate                                                  | Result                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks** (4m26s)                                    |
| audit                                                 | **0 vulns**                                                  |
| `gen:manifest` + `check:manifest`                     | **155 components** (155×4 frameworks), 86 tokens, up to date |

## Final test counts

- **core: 1517/1517** (97 files)
- **react: 2242/2242** (198 files) — incl. `reset-column-widths.test.tsx` **10/10**
- Full repo: 180 tasks successful, 0 failed

## Commit

```
e20c9ffc feat(table): grid 批 BO——列宽重置（iris 独有）
```

6 files changed, 110 insertions(+), 2 deletions(-) — docs fix + DECISIONS.md pipeline entries + batch stage records. Working tree clean.
