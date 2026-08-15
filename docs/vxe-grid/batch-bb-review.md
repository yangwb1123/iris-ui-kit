**Verdict: PASS** — written to `docs/vxe-grid/batch-bb-review.md`. No source files modified.

## Verification results (commit `ac8d9acc`)

| Check                     | Result                                                      |
| ------------------------- | ----------------------------------------------------------- |
| react test                | ✅ 2098 passed (+11)                                        |
| core / plugin-locale-zh   | ✅ 1438 / 6 (zh drift guard)                                |
| typecheck / lint          | ✅ clean / 0 errors (1 pre-existing complexity warning 250) |
| check:manifest            | ✅ up to date (propCount 146, both props single-line)       |
| check:docs-reference      | ✅ up to date                                               |
| prettier / spec audit     | ✅ clean / no new violations (17 pre-existing)              |
| core framework-free / hex | ✅ strings only / none                                      |

## Checklist findings

1. **Menu gating/order/semantics** ✅ — existence = `annotations[cellId(rowKeyOf(row,idx), col.key)]` (same `::` key as the AZ badge); add vs edit+remove; appended after 摘要; empty/whitespace text deletes the key; `onAnnotationsChange` always gets a fresh `{...}` object; reserved keys intercepted before user `onSelect` with dedupe.
2. **Panel** ✅ — textarea seeded via `annotations[cellKey]` + seq-key remount (tested); Esc/outside/scroll dismissal; no-callback case → items visible, save/remove inert, documented + tested.
3. **Hygiene** ✅ — one-line `else`→`else-if` rewrite is the only non-additive change; tokens-only styles; en+zh i18n; manifest regenerated and clean.

## Findings (all non-functional)

1. **MEDIUM** — `docs/vxe-grid-comparison.md:60/117/330`: usage-snippet fence opened with 4 backticks but closed with `/>``` (content + 3 backticks — cannot close a 4-fence); it only closes at a stray ` `` ` added at EOF, so lines 61–329 (all parity tables, batch rows, counts, 决策) render as one giant code block. Fix: closing fence of ≥4 backticks on its own line after `/>`, delete the EOF ` `` `.
2. **LOW** — `docs/vxe-grid-comparison.md:306`: says "10 react 新测试" but the file has 11 (counts line elsewhere says +11). Fix: 10 → 11.
3. **LOW** — `Table.tsx:~7505`: without `onAnnotationsChange`, the panel 删除 button still closes the panel (unconditional `closeAnnotate()` after the inert early-return) while save leaves it open — inconsistent, untested, undocumented. Fix: make it truly inert or document close-as-cancel + add a test.

Plus informational notes (stale "working tree clean" claim in committed adapt.md, `cellNote` display-shadowing boundary, pre-existing 154-vs-155 component drift).
