# Core performance contract review (draft)

**Status: evidence preparation, not an approved replacement baseline.** The active
`scripts/bench-baseline.json`, original workloads and 20% regression tolerance remain
unchanged. A successful diagnostic collection does not pass a performance gate or
authorize integration, release, or deployment.

On 2026-10-15 the maintainer selected the versioned architecture **design** route.
[Owned-data migration](OWNED_DATA_MIGRATION.md) proposes the input/view/history
boundary, consumer migration and acceptance plan. Its detailed semantics, resource
limits, public API, numeric performance targets and default switch remain unapproved;
it changes no runtime, baseline or release authority.

## What needs a decision

The original six obligations now include safety work absent from some historical
implementations. Benchmark-commit `8b694b9e242d6db033b5320e0b843fbebb391318` really passed
20/20 on main/push CI [30320648612](https://github.com/yangwb1123/iris-ui-kit/actions/runs/30320648612),
job90155614637, Node20.20.2, ubuntu24.04 image20260720.247.2. Its test harness was
Vitest3.2.6; the current lock pins4.1.11. That is a qualification run at the baseline
commit, not proof of the exact samples used to author the baseline numbers.

| Original operation                    | Existing minimum ops/s | Behavior that must remain                                                  | Proposed replacement minimum |
| ------------------------------------- | ---------------------: | -------------------------------------------------------------------------- | ---------------------------- |
| 1000 writes + one 10-field validation |                186.168 | Isolated validator snapshots, authority/reentry/async lifecycle            | Not decided                  |
| Insert/remove 1000 rows               |                5.31944 | Row detachment, metadata rekey, full clone effects, history                | Not decided                  |
| 500 swaps                             |               11.00648 | Snapshot/output effects, identities, validating rekey, history             | Not decided                  |
| 10000 unique queries                  |                179.216 | Fresh native signals, generation/dedup/TTL/SWR/LRU/cancel/stale settlement | Not decided                  |
| Construct + synchronous initial load  |               37845.88 | Real native signal, row copies, synchronous load/outbox/lifecycle          | Not decided                  |
| Post 1000 notifications               |                226.192 | Actual spread/iterator effects, verified outputs, frozen owned records     | Not decided                  |

Old form already had JSON history; old data-source construction already had native
signals. Do not attribute their entire regression to newly added features. Old query
lacked native cancellation and old notifications exposed mutable internal records;
the historical implementation is NOT a compatible production fallback.

The prior local original gate was15/20 with validation passing and the other five
failing. Local native-only controls exceeded the old query operation budget, but
that is not a universal lower bound or certified CI floor. Earlier notification
pairs ran after intrinsic-hook witnesses; restoring JavaScript descriptors does not
prove V8 optimization state was restored. This new plan isolates semantic tests from
all measurement processes. It does not erase any earlier sample or failure.

## Reproducible diagnostic plan

`python3 -B scripts/bench-evidence/collect.py --help` is a **diagnostic-only** entry.
It reuses the publisher's bounded source snapshot/copy and owned-process transport;
it imports no publication policy and performs no Git writes, install, network request,
or baseline/history update itself. Executed source is trusted code, not sandboxed:
source verification detects changes but does not promise rollback of side effects.

1. Freeze separate candidate and clean historical checkouts. The historical SHA is
   fixed above; record exact candidate HEAD AND whole tracked/untracked source digest.
   Require byte-equal benchmark-file inventories and bytes, including files not timed.
2. Use ONLY the current frozen-lockfile installation: Node20, pnpm10.34.5,
   Vitest4.1.11 and its installed Tinybench. Do not install historical dependencies.
   Both sources use this same current harness. Per-source TS configuration remains
   in each frozen source manifest; this is not a reconstruction of July's environment.
3. Select the six original callback names in `form.bench.ts`, `resilience.bench.ts`
   and `scale.bench.ts`. No callback edits or benchmark warmup/time/iteration overrides.
   Serial isolated files/one fork worker are explicit. **This is not the full original
   benchmark gate**, which remains required separately.
4. Two deliberately incompatible controls replace only the query factory import in
   the original unique-query callback: native-control creates a real controller and
   obtains its signal INSIDE every fetch; fetcher-control omits the signal. Both omit
   cache/lifecycle capabilities and can NEVER become a runtime fallback. No function
   arity guessing, fake/shared signals, pooling or preallocation outside timing.
5. Six declared cohorts per variant, alternating historical/current/native/fetcher
   and the reverse order. Fresh Vitest process per cohort. No compatibility tests,
   constructor instrumentation or prototype witnesses in those processes. No forced
   GC, background-process interference, sample selection or retries. Separate unit
   tests check signal identities/abort behavior but provide no performance numbers.
6. Persist each completed case's exposed native vector immediately in the parent,
   then verify it against the final report. On timeout, samples still internal to
   an unfinished case may be unavailable: mark collection failed/Missing, retain
   all exposed/partial evidence and never replay that timed cohort. Parent-side
   serialization/IPC can contend with the worker; this overhead is not calibrated.
   Retain every exposed native sample vector and native summary. `includeSamples` retains
   vectors between cases and adds memory/IPC overhead compared with the default
   reporter. Tinybench may sort its exposed vector; this is not a chronological trace.
   Each sample times one ORIGINAL callback, not one row/request. The summary reports
   medians of six native-run Hz statistics, not individual-call latency medians.

Limits: at most6cohorts/variant;1500seconds whole execution (default1200), including
setup/copy/final verification;300seconds/child;4MiB/child log;8MiB/JSON;250000native
samples/report. Existing source snapshot budgets also apply. Output must be a NEW
external directory. Nonzero/signal/timeout, empty/malformed/duplicate/nonfinite or
mismatched reports, missing samples, unexpected cases, and source changes refuse a
complete result. Preserve intent, raw/partial files and logs; do not rerun to select
a winner. A leftover directory is not permission to delete and replay it.

Example local **collection validation**, not CI calibration (reference must already
be a separate clean checkout of the fixed SHA; output parent must exist):

```sh
python3 -B scripts/bench-evidence/collect.py \
  --reference-dir /path/to/owned/historical-checkout \
  --expected-head "$(git rev-parse HEAD)" \
  --output-dir /tmp/new-iris-performance-evidence \
  --pairs 1 --seconds 600
```

Local dirty source is fingerprinted, never represented by HEAD alone. Actions requires
clean source,6cohorts and run_attempt1. The collector rejects inherited NODE_OPTIONS
or VITEST_* overrides. Environment claims alone are not attestation.

## Actions execution and review

`.github/workflows/performance-evidence.yml` uses a separate ubuntu-latest/Node20
job with read-only repository permission, no publishing credentials/OIDC, no writes
to main, and no changes to the existing CI/release gates or their timeouts. The PR
trigger permits first use before this new workflow reaches the default branch;
manual dispatch generally requires it to exist on the default branch first.

The user still owns committing/pushing the feature branch. No workflow has been
remotely executed merely because its YAML or local tests pass. Once pushed, the PR
workflow checks out the exact PR HEAD rather than a synthetic merge SHA, records
actual image/toolchain/CPU/run metadata, runs separate protocol tests, then collects
all24cohorts on one worker. Artifacts retain failures via `always()` for14days; download
and retain them before expiry. Concurrent same-SHA attempts are serialized, not
cancelled; this is NOT a persistent cross-run idempotency fence. Do not dispatch
another run to hide a slow/failed one. All run IDs and attempts belong in the review.

Review must externally confirm repository/workflow/run/event/exact HEAD, execution
exit codes, image/toolchain, all declared cohorts, raw hashes, source identities and
semantic differences. A `summary.json` alone is insufficient; any failure receipt,
nonzero collector step or missing artifact is a failure/unknown, never an empty pass.

Before any baseline change:

- Decide product-acceptable minimum throughput/latency for each FULL capability set;
  do not mechanically copy slower observations into a new threshold.
- Distinguish removable work from required work and explicit behavior changes. If a
  versioned architecture migration is chosen, specify getter/iterator/throw timing,
  snapshots/identities/history/notification/abort compatibility and migration tests.
  Do not move work outside the old callback and claim total-cost savings.
- Independently review a versioned proposal and its complete CI evidence. An approved
  review plan is not approval of numeric targets. Preserve old baseline and FAIL history.
- Only after explicit target approval, measure/calibrate with the prescribed ORIGINAL
  full workloads in CI; keep20%tolerance and all correctness/safety/coverage/package/
  native/browser gates. Neither this tool nor a green diagnostic workflow grants an
  exception to an existing failed mandatory check.

## Mandatory benchmark gate: one execution owner

`node scripts/check-bench-regression.mjs` owns one fresh **workspace-wide**
`pnpm bench` invocation and adjudicates that invocation's output. CI must not run
another `pnpm bench` first. The declared workspace inventory at this repair has
49 package manifests and only `packages/core` owns a bench script. Keeping the root
Turbo task also retains future non-core owners and the existing `^build` dependency
edges; benchmark caching remains disabled. `pnpm bench` alone is execution, not the
regression verdict. No previous log, cached benchmark table or diagnostic artifact
can satisfy this command.

Turbo's stream/grouped/full-output/no-prefix flags control presentation only. Vitest
workloads, warmups, samples, concurrency and all baseline values remain unchanged.
Removing the earlier whole-process pass removes its incidental prewarming and changes
execution topology: this is **not** a claim of identical historical timing conditions,
production speedup, or guaranteed completion inside CI's unchanged 30 minute limit.
Nothing is moved outside an operation's measured callback. Fresh qualified CI evidence
and every other integration/release gate remain necessary.

The gate refuses missing/malformed/duplicate-key baseline input, invalid/nonpositive
throughput, invalid history, ambiguous names, failed/signalled child execution, empty,
incomplete, duplicate or malformed result tables, and absent required cases. Required
cases must belong to the core runner and their declared benchmark source file. All
20 existing baseline cases remain required. Non-baselined rows are retained and labeled
**not acceptance**, not promoted into new numeric obligations. A changed output format
fails closed rather than silently skipping rows. Names ending in a number (including
`interleaved measure(10) + setScroll × 100`) are parsed as names, not fabricated Hz;
old stored history is not retroactively corrected.

Each recognized Vitest `RUN` owns a nonempty result stream and exactly one
`BENCH Summary`. It must complete before another runner starts and before EOF;
completion of core cannot certify a later or earlier runner. Empty tables are
rejected at EOF even without a final newline. Suites, tables and completion markers
require an active runner; tables also require a source-file marker. Repeated normalized
runner roots and data after completion are rejected. Complete non-core runners remain
valid before or after core, without adding numeric obligations for their extra rows.
These are checks on the recognized log protocol, not proof against a trusted producer
fabricating output or a certificate for arbitrary other benchmark formats.

Default tolerance remains 0.2: minimum throughput is baseline × 0.8. An explicit
`--threshold=0` through `--threshold=0.2` may only tighten it; malformed, duplicate,
unknown or looser arguments are rejected before execution. Exit 0 requires a complete
passing adjudication; exit 1 records complete measured regressions; exit 2 means invalid
input/evidence/execution/persistence, not a performance score. These stricter rejection
rules intentionally replace previously permissive CLI behavior.

Execution has a 600 second absolute child deadline and an 8 MiB combined output budget;
continuing output cannot extend the deadline. Cleanup targets the owned POSIX process
group, including descendants after leader exit. Windows uses owned-PID tree termination
and refuses unconfirmed cleanup; this local Linux verification is **not Windows or macOS
acceptance**, nor a sandbox against trusted source deliberately escaping its process tree.
JSON/history reads and replacement writes are limited to 1 MiB. An exclusive, non-breaking
`bench-history.json.lock` excludes cooperating checker invocations. After a hard kill,
inspect the owner/outcome before manually removing a stale lock; do not blindly replay.
Only complete evidence updates history (including genuine regressions), through a synced
temporary file and atomic rename. Existing dates/results are retained; a changed history
is not overwritten. These checks cannot roll back benchmark code's other side effects.

`node --test scripts/lib/bench-regression.test.mjs` uses deterministic subprocess
producers and private histories for gate regressions, plus owned sleeper/output fixtures
for transport cleanup. Their fabricated numbers are protocol fixtures, not benchmarks.
The script suite discovers these tests automatically. Full production performance,
native/browser acceptance, main/push CI and release authorization remain independent.

## Artifacts and implementation checks

`intent.json` contains the plan/environment/workload hashes; two source manifests
contain all source bytes' hashes. Each cohort has config/intent/log/raw samples/hash
verification. `summary.json` is complete evidence collection only:
`performance_accepted=false`, `release_authorized=false`. `failure.json` and partials
are retained on failure; source snapshots/stages remain for local inspection.

`node --test scripts/lib/bench-evidence.test.mjs` runs strict protocol/source/argument/
deadline tests, create-only artifact checks, separate signal witnesses, workflow
permission checks, and a tiny SYNTHETIC native Vitest CLI fixture. None is a production
performance result. These tests are automatically included in `pnpm test:scripts`.
