Gate complete. Working tree clean.

## 批 DC 门禁完成 — PASS

**Review verdict**: PASS (`batch-dc-review.md`) — 3 doc-level findings, all fixed in this commit:

1. **propCount 185 → 186** — fixed in `batch-dc-adapt.md:19`, `vxe-grid-comparison.md` DC row, and the `DECISIONS.md` ledger. Verified against `manifest.json`: **186 props / 32 events**.
2. **test file "384 行" → "402 行"** — `pinned-reorder.test.tsx` verified at 402 lines via `wc -l`.
3. **`Table.tsx:240` comment** — no test imports `clampReorderZone` (all 15 go through the drag pipeline), so the comment now says tests exercise it through the full drag pipeline.

### Full gate results

| Gate                                                  | Result                                              |
| ----------------------------------------------------- | --------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks successful** (135 cached, 45 fresh) |
| `pnpm audit`                                          | **0 vulnerabilities**                               |
| `gen:manifest`                                        | 155 components ×4, 86 tokens (zero diff)            |
| `check:manifest`                                      | **up to date, zero diff**                           |
| prettier (affected files)                             | clean                                               |

### Final test counts (force-run)

- **core: 1580 / 1580** (102 files)
- **react: 2697 / 2697** (238 files, +15 from the new `pinned-reorder.test.tsx` 402-line suite)

### Commit

```
7657759f9fbd71ec25966ec04f9581945ccefc65  feat(table): grid 批 DC——列冻结复用（iris 独有）
```

6 files changed (+81/−30): Table.tsx comment fix, comparison doc (DC row + 构建状态 append), DECISIONS ledger, adapt/review/gate reports. Working tree clean (`.vinxi` excluded).
