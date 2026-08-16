Verdict written to `docs/vxe-grid/batch-cw-review.md`.

## Verdict: **PASS** — 0 spec violations, 1 minor + 2 informational

### Verification performed

| Check                                                                             | Result                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core framework-free (`grep 'from (vue\|react\|solid\|svelte)' packages/core/src`) | empty — only +3 default i18n keys in core                                                                                                                                   |
| core test                                                                         | **1559/1559**                                                                                                                                                               |
| react test                                                                        | **2648/2648** (incl. 12/12 new `import-preview.test.tsx`)                                                                                                                   |
| react typecheck                                                                   | clean                                                                                                                                                                       |
| react lint                                                                        | 0 errors (1 pre-existing IrisTable complexity warning)                                                                                                                      |
| `pnpm audit`                                                                      | no known vulnerabilities                                                                                                                                                    |
| check:manifest                                                                    | up to date — iris table **183 props / 32 events** (182→183 exactly as predicted)                                                                                            |
| check:docs-reference / prettier                                                   | green                                                                                                                                                                       |
| Additive only                                                                     | single removed source line = the old direct `toolbar.onImport(rows)` replaced by gate (off path behaviorally byte-identical); no dist/artifacts; other frameworks untouched |

### Findings

1. **minor (a11y)** — `Table.tsx:9765-9766`: `aria-modal="true"` without focus trap / scroll lock / focus restore (focus stays on the ⇪ trigger behind the backdrop; Tab escapes the dialog). Repo modal primitives (DialogContent `useFocusTrap`/`useBodyScrollLock` precedent) pair modal semantics with focus management; not a spec fiat, so PASS stands. Fix suggested.
2. **informational** — doc count mismatch: adapt.md says 253 lines / DECISIONS 252 行; actual test file is 243 lines.
3. **informational** — dialog title is a plain `div` with only `aria-label` (no `aria-labelledby`/heading semantics).

No files modified (only the new verdict file; pre-existing stage dirt untouched).
