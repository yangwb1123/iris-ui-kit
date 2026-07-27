# @iris-ui-kit/vue

## 0.1.0

### Minor Changes

- 91ca7ec: First public release of Iris UI — a token-driven, cross-framework (React 18 + Vue 3) component library.
  - 5-layer architecture (Theme → Meta Primitives → Composite → Layouts → System Skeletons) plus an orthogonal Behaviors layer, with full React⇔Vue parity (96 components).
  - Six framework-agnostic engines in `@iris-ui-kit/core`: state machines, form orchestration, i18n, virtualization windowing, async resources, and server-side pagination — each with thin dual-adapter bridges.
  - Production-readiness: SSR-safe IDs + render smoke tests, axe-core accessibility gate, i18n (Intl + overridable copy), reduced-motion / color-scheme / RTL theme foundations, variable-height virtualization, a machine-readable manifest (`llms.txt`), and a bundle-size budget.

- 67e1e2e: ### Cross-framework behavior contracts
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

### Patch Changes

- Updated dependencies [91ca7ec]
- Updated dependencies [67e1e2e]
  - @iris-ui-kit/core@0.1.0
  - @iris-ui-kit/tokens@0.1.0
  - @iris-ui-kit/theme@0.1.0
  - @iris-ui-kit/icons@0.1.0
  - @iris-ui-kit/skins@0.0.1
