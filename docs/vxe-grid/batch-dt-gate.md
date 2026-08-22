Gate complete. Summary:

## 批 DT Gate — PASS ✅

**Verdict**: `batch-dt-review.md` = **PASS** (feature landed at `61ec5418`, ancestor of HEAD; zero source changes needed — DT is a handle method `exportRowsCsv(keys)` with the `exportSelectionCsv` byte-identical pipeline).

### Gates re-run

| Gate                                  | Result                                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| `turbo run test typecheck lint build` | ✅ **180/180** tasks (174 cached, 6 forced)                  |
| `pnpm audit`                          | ✅ **0 vulnerabilities**                                     |
| `gen:manifest`                        | ✅ regenerated — **zero diff** (155×4 components, 86 tokens) |
| `check:manifest`                      | ✅ up to date                                                |

### Test counts (fresh runs)

- **core**: 104 files — **1597/1597** ✅
- **react**: 246 files — **2826/2826** ✅ (includes DT pin at `batch-dl-dt.test.tsx:485-489`, 492 lines ≤ 500)

### Doc update (`docs/vxe-grid-comparison.md`, iris 独有 section)

- New **批 DT** row inserted after 批 DS in the 能力/说明 table: contract `IrisTableHandle.exportRowsCsv(keys: Array<string | number>) => string` (`types/handle.ts:38`) → `new Set(keys)` + `bodyDataRef` filter (body order, unknown keys silently skipped, zero dependency on checkbox/selectable) → `exportSelectionCsv` byte-identical pipeline (formula materialization / mask / hidden-column exclusion / OWASP neutralize), empty → `''`, plus the 4 accepted non-blocking review observations.
- 构建状态 summary line appended with the DT entry. Batch status table already listed DT (line 432).

### Commit

- `b638a29db5a43828038d57943e9caabdcea83581` — `feat(table): grid 批 DT——表格导出选择（iris 独有）` (6 files, +115/−42; working tree clean)
- Budget warning (6 files > target 5) is the known multi-framework doc fan-out exception, non-blocking.
