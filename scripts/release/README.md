# Standalone whole-graph publisher

These four Python modules are the generated standalone publication-policy
snapshot developed for this Iris release transaction. They use only Python's
standard library; no pbatch implementation, credentials, private project data,
or upstream snaplink source is imported or redistributed here. The snapshot
matches the isolated runner publisher's tested source bytes; subsequent shared
policy fixes must be reviewed and synchronized, not patched independently.
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

The Git-common write-intent journal is fsynced before external writes. Within the
same retained repository, even a new evidence directory cannot forget unknown
attempts. GitHub-hosted workers are ephemeral: their journal does **not** survive
an unrelated worker. Preserve the uploaded receipt/tarballs/logs and inspect the
actual registry before requesting any workflow rerun; a fresh worker is not a
recovery authorization. Disable the repository release switch after this
transaction, including a failed or unknown outcome. Do not delete retained
journals or change versions to disguise a partial publication.

`published: true` means at least one write is confirmed; `published: null` means
an attempted write remains unknown with none confirmed. `publication_complete`
requires the full graph plus real external registry installation. A dry-run pack
is not registry, browser, authenticated SVERP, hardware or production acceptance.

This is POSIX/Linux-only. Private stages are not sandboxes: trusted lifecycle
scripts retain execution-account permissions. Deadlines/log byte budgets cover
owned process groups only; mandatory evidence persistence is fail closed.
