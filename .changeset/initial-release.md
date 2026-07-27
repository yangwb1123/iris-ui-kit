---
'@iris-ui-kit/core': minor
'@iris-ui-kit/tokens': minor
'@iris-ui-kit/theme': minor
'@iris-ui-kit/icons': minor
'@iris-ui-kit/react': minor
'@iris-ui-kit/vue': minor
'@iris-ui-kit/manifest': minor
---

First public release of Iris UI — a token-driven, cross-framework (React 18 + Vue 3) component library.

- 5-layer architecture (Theme → Meta Primitives → Composite → Layouts → System Skeletons) plus an orthogonal Behaviors layer, with full React⇔Vue parity (96 components).
- Six framework-agnostic engines in `@iris-ui-kit/core`: state machines, form orchestration, i18n, virtualization windowing, async resources, and server-side pagination — each with thin dual-adapter bridges.
- Production-readiness: SSR-safe IDs + render smoke tests, axe-core accessibility gate, i18n (Intl + overridable copy), reduced-motion / color-scheme / RTL theme foundations, variable-height virtualization, a machine-readable manifest (`llms.txt`), and a bundle-size budget.
