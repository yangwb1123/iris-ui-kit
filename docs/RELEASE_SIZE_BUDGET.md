# Release size budget disposition

The maintainer explicitly authorized “尺寸门禁修改，然后发布” on 2026-10-09,
after receiving the failed 55/7KiB gate and measured 68.2/11.4KiB entries.
This is a deliberate, bounded acceptance of the current size, not a disabled
size check, an audit exemption, or release approval for unrelated failed gates.

## Limits and unchanged measurement

| Entry                          | Measured gzip bytes | Previous limit |      New limit |      Headroom |
| ------------------------------ | ------------------: | -------------: | -------------: | ------------: |
| `packages/core/dist/index.js`  |              69,881 | 56,320 (55KiB) | 73,728 (72KiB) | 3,847 (5.50%) |
| `packages/icons/dist/index.js` |              11,723 |   7,168 (7KiB) | 12,288 (12KiB) |   565 (4.82%) |

Measurements use Node 20.20.2 `gzipSync` defaults on built ESM entries, exactly
as before. Only these two package limits change, in `scripts/check-size.mjs`
and `iris.yaml`. No source-map exclusion, payload relocation, API/security
removal, mangle experiment, baseline overwrite or threshold bypass accompanies
this disposition. Exceeding either new limit must still fail.

The advisory historical `scripts/size-baseline.json` is intentionally retained,
so printed deltas remain visible rather than being reset to zero. Other entry,
plugin, complete Svelte runtime and enforced single-icon budgets are unchanged.

## Why retain the bytes

- Core remains the framework-independent owner of shared grid/data controllers,
  responsive component-size/layout contracts and pointer/item-owned Toast logic.
  Keeping this ownership avoids four independent implementations or removing
  accepted public behavior merely to cross an obsolete limit.
- Icons retains bounded SVG parsing/reference validation, safe rendering,
  provider checks and the public icon exports. Security behavior is not traded
  for a smaller barrel.
- `docs/STATE.md` recorded 76.4KiB core / 13.2KiB icons on 2026-09-29, before
  the current release-readiness/Toast work. The starting candidate was already
  over the old limits. The whole historical delta is therefore **not** a measured
  marginal cost of Toast, and this document does not claim such attribution.
- Current compatible compaction and tree-shaking reduced those historical
  measurements without renaming public functions/properties or weakening safety.
  The original candidate measurement was 69,559 / 11,639 bytes; the current graph
  is +322 / +84 bytes, respectively. Those are checkpoint differences, not an
  isolated causal feature attribution or production performance proof.

## Evidence boundaries and release conditions

Entry gzip is not recursive ESM/CJS file sums, complete tarball size, a typical
consumer bundle, transferred network bytes or loading latency. For example,
last recorded recursive sums were core ESM 121,646 / CJS 145,889 bytes and icons
ESM 11,723 / CJS 12,310 bytes; they are distinct measures, not substitute budgets.
The real gate's separately labeled consumer probes remain visible.

Every changed source/version graph must rebuild coherently and pass complete
qualification, all 27 public-package external pack/install checks and applicable
native consumers. Current successful tests do not approve absent main-push CI,
provenance, registry permissions, version integrity or production deployment.
Npm timeout/nonzero writes remain unknown outcomes, not rollback or retry
permission. Publication uses dependency-ordered exact production versions;
private dev-certificate tooling stays outside the public runtime graph.
