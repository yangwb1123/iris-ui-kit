---
'@iris-ui-kit/plugin-admin': patch
---

Defer Admin DataPage requests until the client mount lifecycle so server rendering and uncommitted renders remain side-effect free.
