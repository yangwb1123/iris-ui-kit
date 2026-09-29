---
'@iris-ui-kit/core': patch
'@iris-ui-kit/icons': minor
'@iris-ui-kit/react': minor
'@iris-ui-kit/vue': minor
'@iris-ui-kit/solid': minor
'@iris-ui-kit/svelte': minor
---

Add the searchable, categorized `IrisIconPicker` to all four framework adapters, with semantic-name helpers and localized default labels. Add an optional Iconify JSON provider that converts a restricted, validated SVG subset—including safe nested groups, gradients, clip paths, and masks—into structured icons. Export `normalizeIconNodes` to sanitize and bound custom icon trees before rendering, including cyclic nodes, unsafe tags, event attributes, and external paint URLs.
