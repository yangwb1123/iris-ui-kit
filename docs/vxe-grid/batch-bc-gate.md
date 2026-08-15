Done. Gate stage complete.

## Verdict: PASS

Review findings were non-blocking (1 medium disclosed fiat + 2 low docs issues — the duplicate DECISIONS adapt entry was removed during bookkeeping).

## Gate results

| Check                                                 | Result                                               |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks successful** (4m59s, 55 cached)      |
| `pnpm audit`                                          | **0 vulnerabilities**                                |
| `gen:manifest` + `check:manifest`                     | 155 components ×4 frameworks, 86 tokens — up to date |
| `check:docs-reference`                                | up to date (3 files)                                 |

## Comparison doc

`docs/vxe-grid-comparison.md` iris 独有 section already carried the 批 BC row from adapt (row 57 `formulaTables` entry, batch table row 317, usage snippet, build-status lines 265/321). Verified every figure against the actual gate run — react 2110 / core 1457 / 180/180 / 审计 0 / manifest 155×4 all match; no doc changes needed.

## Commit

```
5306de16 feat(table): grid 批 BC——跨表引用公式（iris 独有）
```

(4 files, +87/−18: gate record `batch-bc-gate.md`, review verdict, adapt doc + DECISIONS bookkeeping; working tree clean; lint-staged prettier + filesize/budget gates passed)

## Final test counts

- **core: 1457 passed** (94 files) — 批 BC +19 (`formula-tables`)
- **react: 2110 passed** (187 files) — 批 BC +12 (`formula-tables`)
- Full gate also covered vue/solid/svelte, all 27 packages, and Electron/Tauri/Wails desktop shells
