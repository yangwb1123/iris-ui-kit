---
'@iris-ui-kit/core': patch
'@iris-ui-kit/plugin-admin': patch
---

Propagate AbortSignals through cached, resilient, resource, and Admin fetchers so owner teardown can cancel foreground and stale-while-revalidate requests.
