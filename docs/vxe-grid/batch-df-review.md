I've completed the adversarial review and written the verdict to `docs/vxe-grid/batch-df-review.md`.

## Verdict: PASS (1 minor P2 finding)

**Reviewed** commit `90f082c4` against the baseline, inspected the full impl, and ran all requested verification gates.

### Verification results (all green)

| Check                     | Result                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| core test                 | 102 files / 1584 tests ✅                                         |
| react test                | 239 files / 2719 tests (clip-fnr: 26 passed incl. 8 new) ✅       |
| react typecheck           | clean ✅                                                          |
| react lint                | 0 errors (1 pre-existing complexity warning at Table.tsx:2613) ✅ |
| iris-ui-spec `--mode all` | 0 violations ✅                                                   |
| `check:manifest`          | up-to-date ✅                                                     |

### Axis findings

- **Spec correctness**: single-cell overflow insert via `overflowStart`/`newRows`, auto-id `max+1` via core `insertRowInList`, surplus-cell clip, locked/readonly skip, one `commitRowList(next,'paste')`, multi-cell fiat clip preserved, default-off byte-identical. ✅
- **Additive only**: gated by new `pasteOptions?.insertIfOverflow`; default-off degenerates to batch-O guard. ✅
- **Manifest hygiene**: check passes, but found **P2** — the `pasteOptions` JSDoc (props.ts:684) puts its final prose on the `*/` line, and the manifest scanner (`packages/manifest/src/props.ts` `parsePropsBody`) drops the closing line. Result: the harvested description truncates mid-sentence to "…keeps batch-O" in `manifest.json`/`llms.txt`. Fix: move final prose to its own line (like `clipConfig`), re-run `gen:manifest`.
- **Core framework-free**: `grep` for framework imports in `packages/core/src` → no matches. ✅
- **CSS tokens**: none required (data-only feature). ✅

Minor observation (not a finding): row-level `locked`/`cellPermission` predicates evaluate against the still-empty `nr` on overflow rows — acceptable/by-design.

No files were modified (only the verdict doc was written, which is the deliverable).
