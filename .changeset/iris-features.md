---
'@iris-ui-kit/core': minor
'@iris-ui-kit/react': minor
'@iris-ui-kit/vue': minor
'@iris-ui-kit/solid': minor
'@iris-ui-kit/svelte': minor
'@iris-ui-kit/plugin-editor': minor
'@iris-ui-kit/plugin-notifications': minor
'@iris-ui-kit/plugin-pro-table': minor
---

### Cross-framework behavior contracts
Added Select, Menu, Alert, Banner, SplitButton, and Form contract scenarios across all 4 frameworks (37 scenarios, 148 tests). These shared scenarios verify identical overlay lifecycle, form validation, and interaction behavior across React, Vue, Solid, and Svelte.

### Column virtualization (pro-table)
Wired applyColumnWindow into all 4 framework adapters. When columnVirtualized is enabled, only viewport-visible columns are rendered in the tbody, with the table offset via marginLeft to preserve scroll position.

### Editor plugin
IrisCodeEditor now supports completions (autocomplete via @codemirror/autocomplete) and diff view (base prop with LCS-based change decorations).

### CMS demos
All 4 CMS apps (React, Vue, Solid, Svelte) now have auth + login + RBAC menu filtering + notifications plugin integration. React and Vue also have CommandPalette with keyboard shortcut.

### Portal control
Added portalTarget/teleport props to Svelte Select/Menu and Vue Select, allowing inline rendering for testing and controlled environments.

### CI instrumentation
Added bench, size, arch-check, RSC, and format checks to CI workflow.
