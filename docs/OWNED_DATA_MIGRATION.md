# Owned-data migration — versioned contract proposal

**Status: opt-in public entry implemented as candidate work; legacy defaults unchanged; release line pending.**
On 2026-10-15 the maintainer selected route B for versioned architecture, compatibility
and acceptance design. A fresh independent review accepted that design and its private
review protocol, not implementation or release. On 2026-10-16 the maintainer's continuation
answered the D1–D3 private-pilot request, and a separate external experiment validated the
current-snapshot UI projection. On 2026-10-17 the maintainer approved decisions A–D:

- **A** — add the opt-in `@iris-ui-kit/core/owned-notifications` entry with
  `createOwnedNotificationCenter()`; keep the legacy factory, writable `store`, copying
  `list()` and defaults unchanged; the first version excludes selectors, persistence and
  data-carrying reverse migration.
- **B** — public guardrails mirror the private values (10000 records, 1048576 UTF-16
  key+value units, 65536 units per string); the four shells keep their current timer
  behavior and documented differences are not silently changed.
- **C** — the new entry is candidate work for the next maintainer-approved minor line and
  is not part of the prepared core 0.2.7 release; version fields stay untouched here.
- **D** — public entry and the D5 bridge acceptance come first; the four desktop demo
  shells then adopt the entry as candidate pilot work (timers unchanged, no consumer is
  forced to adopt, legacy entry remains the supported default).

The public entry exposes ONE read contract: `getState()`, `subscribe()` and the same
readonly `store` used by a framework bridge all deliver the current revision per
committed wake-up — exactly one wake-up per commit, no coalescing, reordering or
suppression. The raw captured-view channel remains the private kernel's behavior and is
covered by its own regressions; stale-event introspection is out of scope for this first
version. The four shells keep their existing timer behavior and the documented
per-framework differences are not silently changed. Consumer migration, selectors,
persistence and data-carrying reverse migration remain separate, unreleased work.

This does not approve the D4/D6 tracks, product resource defaults, numeric performance
targets, baseline changes, default-consumer migration or publication. `owned-v1` remains a
design label, not an npm version or public option.

The source-only candidate is [the private notification pilot](../packages/core/src/internal/owned-notifications.ts),
with separate admission and private-root modules and three `owned-notification*.test.ts`
suites. It is not a package entry, adapter capability or persistent plugin. It admits
only the fixed primitive notification schema: at most two container levels, seven fields
per canonical record and 80002 nodes including array length metadata at 10000 records.
Generic tree/form/row admission is not implemented. Array index/length keys, generated
IDs and normalized optional/default fields count toward the text budget.

Private linked records avoid mutation-time traversal of previous public arrays; ID
collision lookup and dismissal still traverse private nodes in O(n). A whole-list view
still costs O(n), including inside subscribed mutations; bursts can remain O(n²).
The factory closure is the owner epoch (no reset/destroy/async operation in this slice).
Views cache only the current revision; detached export transfers data, not authority.
These are structural implementation choices, not verified latency, heap or capacity
claims. Prototype tests and review do not replace the independent integration/release
gates below. No production consumer has been migrated.

## 1. Problem, evidence and intended benefit

Form editors, data-source consumers and desktop notification shells need bounded,
predictable mutation and read costs without losing isolation or request authority.
Repeated whole-state work is partly a consequence of when ownership begins, not
just inefficient loops. A runtime cannot safely share arbitrary caller-owned
objects while promising detached mutable views and observable copying on every edit.

The code/protocol-only benchmark-gate repair is accepted on source digest
`de63d6dd2e1557fdd3cec740079102cf1e4032cb7cd707d7752ecdc6afd15929`.
Its local predecessor's original benchmark was 15/20, with five regressions.
That old measurement does not qualify this design or a future implementation.
Corrected 49dd diagnostic CI run `38572473889` is evidence, not acceptance;
mandatory CI `38572473920` was cancelled. Historical 6898 CI had eight regressions.
None proves a universal performance floor or that compatible improvement is impossible.

| Owner / source                                                   | Current cost and observable boundary                                                                                                   | Proposed opportunity                                                                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `core/src/form/store.ts`, `drafts.ts`, `arrays.ts`, `history.ts` | Detached validation inputs; even unused clone output has observable effects. Arrays copy and rekey; native JSON history runs per save. | Admit values once, update owned paths/collections, materialize callback inputs explicitly; version history semantics. |
| `core/src/notifications.ts`                                      | Real spread followed by output verification; public writable `store` can inject foreign state.                                         | Private records/sequence plus read-only public view and explicit import.                                              |
| `core/src/data-source.ts`, `data-source/client.ts`               | Canonical/public row copies, synchronous initial load, callbacks and native cancellation.                                              | Separately specified owned-row mode; not deferred initialization.                                                     |
| `core/src/query-cache.ts`                                        | Each real miss owns a fresh native signal plus dedup/generation/TTL/SWR/LRU.                                                           | No cancellation optimization proposed. Owned data does not remove this cost.                                          |

Paths in this table are under `packages/`. Old form already had JSON history and
old data-source construction already had native signals; neither entire regression
can be attributed to new safety features. Old query lacked current cancellation
and old notifications exposed mutable records: reverting is not a compatible fix.
See [the performance contract](PERFORMANCE_CONTRACT.md) for evidence limitations.

**Success of this design** means an inspectable boundary and migration/test plan,
not faster production, approved targets or release readiness. No adapter-local
business logic, new framework, generic persistence platform, automatic data migration,
benchmark literal shortcut, fake signal, or global `createStore` rewrite is in scope.

## 2. Version boundary and minimal first slice

Keep legacy factories, exports, defaults and tests unchanged. Use a separately named,
explicitly selected capability only after design/API approval; never choose behavior
by object shape, frozen status, fetcher arity, absence of subscribers or benchmark name.
Do not cast an owned engine to the legacy interface or silently route rejected inputs
to legacy. Decision A (2026-10-17) fixes the opt-in public name as
`@iris-ui-kit/core/owned-notifications` with `createOwnedNotificationCenter()`; distribution
stays the prepared 27-package graph in the next approved minor, not the prepared 0.2.7 line.

First proposed pilot: the **desktop core notification center** in
`packages/core/src/notifications.ts`, not forms, query or data-source simultaneously.
Its primitive record payload is the smallest place to validate ownership/read costs.
Proposed pilot operations are post, dismiss, clear, explicit replacement/import, immutable
read and detached export (public names per decision A). Post accepts only its declared input
fields: typed title/body/icon/appId and tone/timeout scalar normalization after admission.
Missing optional fields use existing defaults; unknown fields and non-admitted values
refuse before commit. Import accepts dense records with nonempty unique string IDs and
those normalized fields; duplicates refuse rather than overwrite. A generated-ID collision
also refuses, without automatic retry. Missing-id dismissal/empty clear are no-ops with no
revision change. Replacement is one all-or-nothing engine transaction, not repeated posts.
`packages/plugin-notifications/src/core/index.ts` is a DIFFERENT same-name factory:
it uses `push`, `items`, read/unread state and automatic persistence. It is not the
`scale.bench.ts` notification workload and is not included in this pilot.

Reuse `ReadonlyStore<T>` from [core store](../packages/core/src/store.ts).
It is already consumed by general React/Vue store bridges. It is only a type:
return a separate runtime facade exposing `getState`/`subscribe`, not the writable
store with a narrower annotation. A writable-store compatibility facade would
reintroduce admission on arbitrary writes and cannot inherit owned-mode cost claims.
Legacy callers requiring `setState`, `batch` or `subscribeWith` stay on legacy until
an explicit replacement capability is designed. No implicit general-store change.

## 3. Proposed owned value domain (D1)

The first owned payload domain is a **tree**, not arbitrary JavaScript graphs:

- Leaves: null, undefined, booleans, strings and finite numbers; preserve `-0`.
- Containers: dense ordinary arrays and records whose reported prototype is the
  engine realm's `Object.prototype` or null. Normalize output records to ordinary
  objects. Cross-realm/custom prototypes require explicit caller conversion.
- Only own enumerable string-keyed data properties, except array `length`.
  Reject accessors without calling their getter, symbol keys, extra array properties,
  sparse/inherited indices, reserved `__proto__`/`prototype`/`constructor` keys,
  functions, symbols, bigint, nonfinite numbers, Date/Map/Set/typed arrays and classes.
- Reject cycles AND repeated container identities within one admitted input
  (aliases), with a bounded path/code diagnostic, not values dumped into errors.
  Internal sharing across revisions is allowed; aliases within a revision are not.
- No automatic Date/JSON coercion, `toJSON`, iterator consumption or silent dropping
  of unsupported fields. These restrictions are intentional compatibility changes.
  Even a currently normalized invalid notification value can instead fail admission.

Admission builds a fresh private representation; it never freezes or retains the
caller's containers. Capture type/prototype, then own keys once; inspect descriptors
in that key order and descend depth-first. For arrays capture the length descriptor,
require exactly the dense canonical indices plus length, then visit indices in order.
Descriptor flags do not become mutable engine policy. Disappearing/unsupported
properties refuse admission; successful admission describes the captured values,
not an atomic snapshot of a concurrently/reentrantly changing external object.

**A proxy cannot be certified harmless by these checks.** Reflection can invoke traps,
which may lie, mutate external state, throw or reenter. Copying reported descriptors
into owned data is the safety boundary, not a claim that the original was non-proxy.
No general input `Get`, iterator or accessor invocation is part of this profile;
proxy reflection remains observable. Existing legacy traces stay unchanged.

Admission and prospective state have finite budgets. PRIVATE NOTIFICATION
PILOT limits (D2 approved only for this prototype, not product defaults or performance targets):

| Resource                      | Proposed maximum / behavior                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| One admission                 | 100000 nodes, 32 container levels, 256 keys per record, 10000 elements per array                                  |
| Text                          | 256 UTF-16 code units per key, 65536 per string, 1048576 total key/value code units per admission                 |
| Live notification state       | 10000 records and 1048576 total key/value text code units; reject excess, never silently evict records            |
| Explicit detached export      | Same logical node/text bounds as live state; one fresh detached result per call, no retained mutable export cache |
| Engine-held public view cache | One current-revision view; drop the engine reference on revision change                                           |

Count leaves and containers as nodes, root container depth as 1, and all captured
keys/text including generated notification IDs in state accounting. Check new private
record/state aggregates before commit. Import limits must admit a full valid exported
live notification state (including IDs), not just a small post; test that round-trip at
all caps. Input limits alone do not bound accumulated state. The fixed notification schema has only primitive fields; no generic graph engine
is required to implement this pilot. Future form/row/history budgets need separate
approval; this table does not authorize unbounded retained history or an Infinity fallback.
These proposed values are conservative engineering guardrails, not proven user capacity
or heap bounds. External consumers can retain old views beyond engine control.
Reflection and arbitrary user callbacks cannot be preempted by a synchronous JavaScript
counter: limits bound engine work, not malicious callback execution. No sandbox or
rollback of external trap/callback effects is promised.

## 4. State transaction, reads and observable differences (D3)

Capture owner lifecycle epoch and revision before admission. Stage normalized input,
new private root, affected metadata/history and any public snapshot needed for current
listeners. Immediately before commit require the same epoch/revision. Reentrant changes
supersede the outer operation: refuse it, with no automatic replay or rollback of the
inner operation. Commit the engine root/metadata/history together, then notify.
An admission/budget/materialization failure before commit leaves those engine fields
unchanged. Callback-generated external effects and consumed IDs are not rolled back.

Owned mode does not re-iterate or verify previous PUBLIC arrays on mutations. It
traverses only owner-created private nodes and newly admitted input. That explicitly
changes the legacy spread/iterator, reflection, push lookup/numeric setter and throw
timing contract; it must not be described as an equivalent optimization.

- `getState()` is synchronous. Cache one immutable public view per current revision;
  repeated reads at that revision return the identical object, including unobserved
  reads (React `useSyncExternalStore` requirement). Old retained views never change.
- The notification view includes its monotonic revision and a readonly ordinary array
  of immutable records, newest first. A private persistent/chunked sequence is a representation candidate,
  not a promised O(1) implementation. Never expose internal nodes, brands or builders.
- With no listeners, a revision may materialize its flat view on first read. With
  listeners, materialize BEFORE commit and synchronously deliver that revision's
  view; subscriber-required reads remain inside the mutation/lifecycle measurement.
- An explicit detached-export operation returns a fresh mutable tree; in the pilot
  this is the records array accepted by import, without transferring revision, epoch
  or owner authority. Changes to it do not affect the engine. It is not `getState()`,
  is not silently called by adapters,
  and its full allocation/work must be measured. Public views are re-admitted as
  foreign input on import; frozen/public identity is not an ownership shortcut.
- Preserve the existing store's notification policy: listeners present at emit start,
  removed listeners skipped, newly added listeners wait for the next emit. Reentrant
  commits notify synchronously; remaining outer listeners receive the captured outer
  view, while `getState()` sees the latest revision. Do not coalesce those events.
  Revisions must not wrap/reuse identity on exhaustion; refuse further commits instead.
- Preserve fail-fast listener exceptions, not invent exception swallowing: commit
  has already happened, remaining listeners are skipped and the caller can observe
  the exception. Inspect revision/state before replay; a thrown post is NOT a rollback.

A whole-list subscriber after every post still materializes O(n) references per event
and can produce O(n²) burst work. Persistent append alone cannot remove this cost.
Per-field/windowed read capabilities could change the demand contract, but are not
smuggled into this pilot or treated as equivalent to full-list consumption.

## 5. Later form/history profile (D4; not part of first pilot)

Value updates use private path-copy/collection operations, followed by existing
reserved-path and validation-authority checks. Array metadata rekeying must be staged
with values, not published before an admission failure. Index/path semantics require
explicit trace tests; legacy arrays continue to support their current sparse behavior.

Proposed validator registry: capture registrations at creation; any future explicit
reconfiguration advances authority and cancels stale work. Mutating the caller's
original registry no longer changes registrations. Registered closures may remain
live; no purity inference or function-arity guessing is permitted.

With NO applicable validator, do not clone a discarded graph or emit a fake validating
cycle; explicit validation still returns a native Promise. With a validator, materialize
isolated mutable inputs inside each callback invocation, preserving value/values
correspondence. A form validation supplies separate detached input to each callback;
callback mutations cannot affect other callbacks or engine state. This is a proposed
stronger isolation contract, not a statement about legacy inter-validator sharing.
Transform/submit inputs are also detached; returned data is re-admitted before any
engine write. All callback copies, async settlement, cancellation and error handling
belong in full lifecycle accounting. Do not substitute read-only inputs to save a copy.

Proposed history: retain bounded immutable VALUES roots, not native JSON strings.
Only changed admitted values add a step; redo is truncated after a new value commit.
Equality includes key order and `Object.is` leaf semantics, including undefined/-0;
compare changed admitted subtrees, not an assumed free whole-tree comparator.
Dirty state uses admitted-domain value equality rather than legacy reference equality.
History navigation restores values, recomputes dirty against admitted initial values,
clears touched/errors/validating and cancels stale validation/submission/buffered work;
there is no automatic validation on navigation. Metadata-only edits add no value step.
Reset replaces admitted initial values and resets the history. These policies, especially
cleared touched state and non-JSON equality, require explicit product approval.

No native JSON lookup/stringify/parse or `toJSON` effects are promised on every owned
save/undo/redo. Undefined/-0 round-trip in memory rather than taking JSON's conversions.
Persistence is a separate versioned export/import contract, NOT a transparent replacement
for existing drafts/storage. Do not reinterpret old persisted blobs in place. No silent
loss of touched metadata, custom types or aliases during a legacy migration is acceptable.

## 6. Requests, rows and durable side effects

Query is deliberately NOT optimized by this proposal. Retain real per-request native
signals, cancellation order, shared in-flight promise installation, generation/dedup,
TTL/SWR/LRU, listener behavior and stale-settlement isolation. No fake/shared/proxy
signal, arity detection, preallocation outside timing, or non-cancellable default.
Corrected diagnostic native-control cost is evidence of a trade-off, not a universal
floor. It does not grant a new query minimum or prove the old target impossible.

A later owned-row data source may share immutable admitted rows with read consumers,
but only under an explicit readonly-row type/behavior contract. Selectors receiving
readonly rows can reject formerly mutating callbacks; that is not a type-only change.
Opaque error objects/callbacks are not owned tree payloads; do not claim whole-state
deep immutability until their separate view contract is specified (D6).
Synchronous initial-load visibility/failures remain synchronous; canonical/public
isolation, maxRows, destroy/reload/StrictMode remount and pending optimistic layers
must be covered. No hidden lazy initialization, reduced construction workload or
cross-instance memo sharing. A row domain cannot silently narrow query/filter values.

Outbox storage format, second-read ordering, FIFO/reentry, per-decode live executor,
eager durable initialization, mutation outcomes and at-least-once delivery remain
unchanged. Do not combine persistence migration with row sharing. Read-only views,
errors, cancel or timeouts do not roll back already-sent writes. Unknown outcomes
must be reconciled; neither engine nor migration may blindly replay them.

## 7. Consumer migration and rollback

This is a source-backed impact sample, NOT a complete consumer census:

| Surface                                                                                       | Concrete concern / required evidence                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four `packages/{react,vue,solid,svelte}/src/form/useForm.ts`                                  | Expose legacy form/state types; React forwards a subset of config and live callback wrappers, others differ. Do not assume a new option forwards uniformly. |
| React/Vue `useStore` and `useStoreSelector`                                                   | General bridges already accept `ReadonlyStore`; selectors still require writable `Store` shape/`subscribeWith`. No unsafe cast.                             |
| `apps/desktop-os-vue/src/notifications.ts`, Svelte `notifications.svelte.ts`, Solid `App.tsx` | Actual full-list subscribers: include read/emit cost, timer ownership, unsubscribe and retained view behavior.                                              |
| `plugin-notifications/src/core/index.ts`                                                      | Separate persistent inbox engine; name matches are not an import/capability inventory.                                                                      |
| `core/src/data-source-ownership.test.ts`, notification snapshot tests                         | Real public `store.setState` escape hatches and ownership effects; do not erase assertions.                                                                 |

Before any default migration, resolve imports/aliases/re-exports/generic calls and
namespace access across declared workspaces and external consumers. Regex hits are
only discovery (they miss generic calls and conflate same-name factories). Inventory
raw store writes, mutable row/value use, accessors/classes/aliases, persisted drafts,
validator registry mutation, JSON hooks and lifecycle behavior with consumer owners.
External usage is unknown until owners attest it; repository scans cannot certify it.

Stage migration per controller/call site, not a global flag: audit domain → explicit
normalization/conversion with reviewed failure behavior → opt-in controller → four
adapter/native integration → consumer acceptance. Keep business policy in core; bridges
only transport the selected capability and readonly type. No new barrel API to evade core.
Legacy remains available and receives its original tests until an approved support and
deprecation plan says otherwise; no package version is assigned by this document.

Rollback is a chosen engine for NEW sessions, not an in-place reinterpretation of owned
state. Explicitly export compatible values and re-admit under the chosen destination,
reporting unsupported conversions. Preserve old storage/backups; version namespaces
must not overwrite each other. Stop/reconcile outstanding requests and outbox writes
before changing owners; do not replay imports or mutations with unknown results.

## 8. Acceptance design: separate correctness, cost and publication

Legacy differential tests retain current traces, not just final equality. Owned tests
assert the intentionally changed trace and isolation boundary instead of deleting legacy
assertions. The following is the required cross-profile acceptance matrix. The private
pilot tests cover only a notification subset; this document is not a completed test
report. Four-framework integration, later profiles and production acceptance remain future work:

| Area          | Minimum adversarial acceptance                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admission     | All supported leaves; -0/undefined; order; null prototype; accessor rejection without getter invocation; sparse/symbol/reserved/custom values; aliases/cycles; reflection traps, throws and reentry; no caller freezing/retention; boundary and over-budget inputs. |
| Transaction   | Failure before commit leaves root/revision/history/metadata unchanged; inner reentrant commit wins; no automatic replay; listener throw is post-commit; listener removal/addition and nested notification order.                                                    |
| Views         | Same-revision identity before/after subscription; retained-view immutability; detached-export independence; no public mutators; ordinary-array read behavior; subscribed and unobserved paths; unsubscribe/resubscribe; multiple instances.                         |
| Notifications | Newest-first post, dismiss/missing-id/clear, explicit import failure, application-owned timers, four actual desktop bridges, full-list observer per post, reads after each mutation and retained snapshots.                                                         |
| Form/history  | Callback isolation including value/values identity; registered vs absent validators; native async/thenables; stale submit/validate; debounce buffers; array flags; undo/redo actual round-trip, max history, redo truncation, reset, equality and non-JSON effects. |
| Rows/requests | Mutable legacy isolation; readonly-row callback behavior; synchronous init; remount, cancel/stale settlement, independent real signals; retained snapshots and optimistic/outbox authority.                                                                         |
| Migration     | Legacy/new coexistence without shared mutable internals; corrupt/old-version export; unsupported conversion refusal; rollback/new-session paths; unknown-write reconciliation.                                                                                      |

Deterministic work witnesses may establish which input traversals disappeared; they
must run separately from pristine performance processes. A count is not latency or heap.
Measure admission + mutation + demanded reads/materialization + callbacks/async settle +
history navigation + cleanup, with retained snapshots and long-running churn. Report
mutation-only AND whole-lifecycle costs; never move work out of an original measured
operation and claim the original workload sped up.

| Proposed profile          | Product-owned inputs/targets required before timing approval                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop notifications     | Burst sizes, steady cap, full-list/windowed demand, subscriber counts, dismiss/clear cadence; end-to-end latency/throughput and retained-memory maxima.                    |
| Form edits/arrays/history | Data shape/depth, array size, validators, read/write ratio, history depth, undo/redo and submit; interaction and validation deadlines plus memory.                         |
| Construction/rows         | Dataset/page sizes, immediate visibility, selector costs, read frequency, retained views, outbox use; init/read/mutation deadlines and memory.                             |
| Unique queries            | Miss/hit/cancel mix, required native cancellation, runtime/device class; complete callback throughput/latency. Ownership-only gains cannot satisfy this row by assumption. |

Every numeric cell is **UNAPPROVED (D7)**; no current slow value is copied into a target.
Structural bounds above are design obligations, not achieved benchmarks. Freeze runtime,
harness, callbacks, topology, source, workload sizes, budgets/cohorts and statistical
rules before a future one-shot measurement; preserve every sample/failure. Paired source
comparisons require equivalent workloads and explicit semantic differences. Cross-version
non-equivalent profiles must be labeled as such, not reported as a legacy speedup.

All 20 active legacy benchmark obligations, original samples/workloads/baseline/history,
20% tolerance and single root-workspace execution remain. Added owned profiles do not
clear failing legacy gates. No gate is retired or weakened here. A later default/contract
supersession requires a separate maintainer-reviewed obligation mapping and approved
numeric acceptance; active failures cannot be renamed away. If active obligations cannot
be met, stop the release rather than treating B or a design PASS as a waiver.

Correctness/security, V8 90/89/92/90, existing exclusions, size/package graph and whole-27
external install, native Linux, fixed-image browser/visual, CI 30min/release 45min,
exact main/push success and fresh default-deny release approval remain independent.
Use the canonical publisher, all-package preflight and provenance path. Unknown/partial
publication stops for reconciliation; this design authorizes none of those operations.

## 9. Decisions and implementation gates

**D1–D3 are approved for the private notification prototype (2026-10-16); decisions A–D
(2026-10-17) authorize the opt-in public entry as candidate work with the guardrails and
version line recorded above.** D2 still does not authorize product resource defaults or
future form/row/history budgets. D4/D6 tracks, default-consumer migration and publication
remain **Proposed / awaiting explicit approval**. No approval or passing review here grants
release authority.

| ID  | Decision / responsible owner                                                                                         | Blocks                                   |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| D1  | Maintainer + affected consumer owners: tree-only domain, rejected aliases/accessors/types, conversion semantics      | Owned admission implementation           |
| D2  | Engineering + product: accept/revise the concrete pilot limits above; separately set future form/row/history budgets | Pilot implementation and public defaults |
| D3  | Maintainer + notification consumers: readonly facade, lazy unobserved views, listener/reentry/error contract         | Notification pilot                       |
| D4  | Form consumers: explicit registry, no-validator events, callback copies, values-only history and metadata clearing   | Form/history migration                   |
| D5  | Maintainer: opt-in surface and version line approved (A–C); consumer census, deprecation and coexistence still open  | Default switch / consumer migration      |
| D6  | Data-source consumers: readonly row/selectors, opaque error view, complete lifecycle semantics                       | Owned-row implementation                 |
| D7  | Product + performance reviewer: representative profiles and numeric targets; independent full evidence review        | Performance/default/release acceptance   |

The authorized current slice is one private notification pilot with explicit
structural/failure regression witnesses and read-demand accounting; no public exports
or automatic default switch. Preregister target benefit/budget before measurements.
Stop if it only improves an unobserved mutation while the required subscribed profile fails.
Do not automatically expand into forms/rows/query or another micro-optimization round.
Then separately qualify the capability, migrate consumers, and only with D4–D7 as applicable
consider a versioned default. Until then the 27-package publication remains on HOLD.
