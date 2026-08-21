---
layout: home
hero:
  name: Iris UI
  text: Token-driven, cross-framework UI infrastructure
  tagline: One theme.json skins every layer. React, Vue, Solid & Svelte — same names, same semantics.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Components
      link: /components
features:
  - title: Cross-framework parity
    details: 155 components are exported with the same names and semantics from React, Vue, Solid, and Svelte. All 620 framework contracts are extracted natively; business logic lives in a framework-agnostic core and adapters remain thin reactive bridges.
  - title: Logic that sinks to core
    details: Six engines — state machines, forms, i18n, virtualization, async resources, and pagination — are pure and framework-agnostic, each with a thin hook per framework.
  - title: Token-driven theming
    details: Every color, space, and radius is a CSS variable. Swap one theme.json to reskin the whole system, light/dark, with reduced-motion and color-scheme awareness.
  - title: Real reference applications
    details: Four CMS bundles render real dashboard, login, users, settings, and workspace pages with no GenericPage fallback. Next, Nuxt, SolidStart, and SvelteKit all exercise routed data/feedback flows, hydration, and production HTTP tests.
  - title: Guarded distribution
    details: Remote registry and marketplace artifacts use SHA-256 integrity checks; the external-consumer gate auto-discovers all 27 publishable packages, and native CI builds Electron, Tauri, and Wails without skip fallbacks.
  - title: Production safeguards
    details: SSR-safe IDs, an axe-core accessibility gate, i18n with overridable copy, an RTL foundation, a machine-readable manifest, and a bundle-size budget.
---
