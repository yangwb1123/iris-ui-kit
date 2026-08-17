Gate stage complete. Report:

## ✅ Gate PASS — 批 CZ「跳到行」(iris 独有)

**Review verdict**: **PASS** (0 blockers, 5 LOW/INFO) — no code fixes required.

### Full repo gate — 180/180 successful

```
Tasks:    180 successful, 180 total (54 cached)   Time: 5m11s
```

`pnpm turbo run test typecheck lint build --concurrency=2` — all packages green, including four-framework SSR, desktop shells (Electron/Tauri/Wails), and E2E.

### Verification

- **`pnpm audit` → 0 vulnerabilities** (`No known vulnerabilities found`)
- **`gen:manifest` + `check:manifest`**: up to date, zero diff — 155 components × 4 frameworks, props **185** / events **32** (goToRow is a handle method, not counted)
- **iris-ui-spec 0 violations** (CSS all-token), core framework-free (grep empty) — both re-verified in review

### Comparison doc (iris 独有 section)

Batch CZ row was already committed with the implementation (73a295b4) — `goToRow(key)` handle, `findTableRowEl` shared locator, `scrollIntoView(nearest)` + `data-iris-row-target` 2s highlight, single-target/restart/unmount-cleanup semantics, 11 tests. Cross-checked against review: **react 2660→2671, core 1580 unchanged, manifest 185 props/32 events** — accurate, no further edits needed.

### Commit

```
8964a7b6  feat(table): grid 批 CZ——跳到行（iris 独有）
```

3 files, +62 (DECISIONS.md + batch-cz-adapt.md + batch-cz-review.md). Working tree clean.

### Final test counts

| Suite      | Tests         |
| ---------- | ------------- |
| core       | **1580/1580** |
| react      | **2671/2671** |
| turbo gate | 180/180 tasks |

Note: two non-CZ virtual-scroll stress tests (`CommandPalette` A1 rendering 10k nodes, `Tree.virtual` A3) flaked intermittently under parallel full-suite load but pass cleanly in isolation (63/63) and in the turbo gate (180/180) — pre-existing timing sensitivity, unrelated to goToRow (which passed in every run). Committed state matches the gate-verified tree.
