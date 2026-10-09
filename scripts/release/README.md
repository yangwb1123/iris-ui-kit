# Standalone whole-graph publisher

These four Python modules are the generated standalone publication-policy
snapshot developed for this Iris release transaction. They use only Python's
standard library; no pbatch implementation, credentials, private project data,
or upstream snaplink source is imported or redistributed here. The snapshot
initially matched the isolated runner publisher's tested source bytes. Independent
review subsequently found and repaired canonical tar paths, hidden metadata
budgets, silent owned-child cleanup and cross-worker intent recovery here. The
isolated runner snapshot predates those repairs and is not approved for publishing
this graph; sync/backport it separately rather than claiming byte equivalence.
They are covered by this repository's MIT license.

`python3 -B scripts/release/iris_publish.py --help` is the parameter authority.
Only `--dry-run` or `--publish` is accepted. No version bump, source restoration,
application upgrade, commit/push, single-package or gate-bypass mode exists.
Version preparation happens separately through Changesets before qualification.

Publication requires clean source, the explicitly approved SHA/source digest,
actual successful main-push CI, enabled GitHub Actions and exact-SHA OIDC
provenance. The release workflow additionally requires maintainer repository
variables `IRIS_APPROVED_RELEASE_SHA` and `IRIS_APPROVED_SOURCE_SHA256`.
Neither failed CI nor a new SHA inherits the previous release approval.

All public artifacts are qualified/packed before any npm write. Production
workspace dependencies must be concrete matching graph versions; tarballs must
be bounded, safe and MIT licensed. Conflicting immutable registry versions block
the entire graph before its first write. The private certificate helper is not
published. Every write outcome is reconciled against actual registry metadata;
nonzero/timeout/404/unreadable results are unknown, never automatically retried.

The Git-common write-intent journal is fsynced before external writes. In addition,
a create-only GitHub ref `refs/tags/iris-npm-intent-<package>-<version>` is confirmed
**before** each npm write. It survives ephemeral-worker replacement, a different
source SHA, and a new evidence directory. Whole-graph preflight blocks every
unresolved retained intent when the registry does not confirm the exact artifact;
a racing invocation also fails the atomic ref creation. API timeout/nonzero or
unconfirmed ref creation never permits an npm write or automatic POST replay.
These retained refs require narrowly declared `contents: write`; no source branch
is changed by the publisher. Preserve them permanently, even after success.
A graph entirely confirmed in registry may be reinstalled without another write.
A partial/unknown graph cannot auto-replay missing versions: inspect registry and
obtain a separately reviewed recovery transaction. Preserve receipts/tarballs/logs
and disable the repository release switch after this transaction. Never delete
intent refs/journals or change versions to disguise a partial publication.

`published: true` means at least one write is confirmed; `published: null` means
an attempted write remains unknown with none confirmed. `publication_complete`
requires the full graph plus real external registry installation. A dry-run pack
is not registry, browser, authenticated SVERP, hardware or production acceptance.

This is POSIX/Linux-only. Private stages are not sandboxes: trusted lifecycle
scripts retain execution-account permissions. Deadlines/log byte budgets cover
owned process groups only; mandatory evidence persistence is fail closed.
