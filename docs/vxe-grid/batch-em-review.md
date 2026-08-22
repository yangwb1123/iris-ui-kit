Review complete. **Verdict: PASS** — written to `docs/vxe-grid/batch-em-review.md`.

## Summary

**All verification commands green:**

| Check                    | Result                                        |
| ------------------------ | --------------------------------------------- |
| core test                | ✅ 1597/1597, formula engine untouched        |
| svelte typecheck         | ✅ 0 errors                                   |
| svelte test + hydration  | ✅ 1003/1003 (+15 formula) + 35/35            |
| svelte lint              | ✅ clean                                      |
| audit:security / tokens  | ✅ 0 vulns / clean                            |
| check:manifest           | ✅ nil diff (155×4, 86 tokens, unavailable=0) |
| core framework-free grep | ✅ zero framework imports                     |
| diff --check / prettier  | ✅ clean                                      |

**Parity findings (adversarial sweep):**

- `getCellValue` 2-arg `memoizedFormulaValue` branch — byte-compatible with react's no-tables slot; non-formula path byte-identical to parent (additive-only)
- Choke-point propagation verified: single+multi sort, both filter channels, summary, cell render, draft/pattern hints, exports ×2, range Ctrl+C — all through `getCellValue`; `tableDisplayText` 3-arg resolver is safe (svelte getCellValue ≡ core `resolveTableValue` for non-formula)
- 8 edit guard touch points confirmed (inline 5 + row-mode 3); zero raw `col.editable` conditionals remain
- `withComputedFormulaCells` verified reference-preserving for no-formula, shadow-row for formula; ref segments stay raw (`toCsvRows`) matching react's `serializeRefRows` exportMultiCsv shape
- `autoDetectTypes` cast cleanup equivalent; no circular import in row-edit module; fixtures (no tables slot, bare exportCsv) honored
- Diff scope: svelte package only — no vue/react/solid/core changes

**Findings (all non-blocking):**

1. **LOW (docs)** — `docs/vxe-grid-comparison.md:398` / `batch-em-adapt.md:13`: "本批 1614，净 +8 行" vs actual **1613 / net +7** (`wc -l` parent 1606 → 1613). Arch-state conclusion unaffected (1606 > baseline 1493 is pre-existing since batch EJ).
2. **INFO** — arch-check ratchet not rerun (out of command list), but parent line count independently confirms the pre-existing violation claim.
3. **INFO** — `formulaTables` cross-table refs unsynced across all four frameworks — documented fiat, matches EK/EL precedent.

No files modified besides the review report.
