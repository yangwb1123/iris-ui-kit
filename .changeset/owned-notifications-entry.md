---
'@iris-ui-kit/core': minor
---

Add the opt-in `@iris-ui-kit/core/owned-notifications` entry with
`createOwnedNotificationCenter()`: frozen readonly views, current-snapshot
wake-ups for generic framework bridges, bounded import/export and rejection
instead of eviction. The legacy `./notifications` factory keeps its writable
`store`, copying `list()` and defaults unchanged; no automatic engine selection
and no default-consumer migration. This entry is candidate work for the next
approved minor line and is not part of the prepared core 0.2.7 release.
