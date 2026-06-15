# `ssr-next` — Next.js App Router SSR/RSC smoke (ROADMAP v3 R14)

The canonical proof that `@iris-ui/react` works inside a **real meta-framework
SSR/RSC pipeline**. The library claims "SSR/RSC-ready"; this app is what
actually builds it through Next.js's App Router server renderer.

## Why a Next App Router build is the proof

`next build` server-renders every route at build time. That single command is a
strict, end-to-end compatibility gate because it fails hard on:

- **bad client boundaries** — a component using hooks/state/effects without a
  `'use client'` directive (directly or transitively) errors during the RSC
  pass. `@iris-ui/react` injects `'use client'` into _every_ emitted entry (see
  `packages/react/tsup.config.ts` + the `pnpm check:rsc` tripwire), so its
  components can be imported straight from a Server Component.
- **server-side DOM access** — any `document` / `window` touched at module-eval
  or during the server render crashes the build. Iris's theme injection runs in
  a client-only effect, so it stays off the server path.
- **broken hydration** — the client island must reconcile against the
  server-rendered HTML without a mismatch.

A green `next build` here means all three hold.

## Structure

```
app/
  layout.tsx   Server Component — root <html>/<body>, server-renders with no DOM access
  page.tsx     Server Component — imports and renders the client island
  Demo.tsx     'use client' island — the interactive components + hydration
  globals.css  minimal page reset
next.config.mjs  transpilePackages for the workspace @iris-ui packages
```

`app/page.tsx` (a **Server Component**, no directive) renders `app/Demo.tsx` (a
**Client Component**). That Server → Client import is the boundary under test.

### Components exercised

A representative spread, on purpose:

- **Overlays (closed by default):** `IrisDialog` and `IrisPopover` — overlays
  are the highest-risk for SSR because they reach for `document`/floating-ui;
  rendered closed, they must server-render to nothing interactive and only wire
  up on hydration.
- **Data:** `IrisTable` with columns + in-memory rows (incl. a `render` cell
  returning an `IrisBadge`).
- **Basics:** `IrisButton`, `IrisInput` (controlled via `useState`), `IrisBadge`.
- **Theming:** `ThemeProvider` + `createThemeStore` (client-only CSS-var
  injection).

## next.config — `transpilePackages`

```js
transpilePackages: ['@iris-ui/react', '@iris-ui/core', '@iris-ui/theme', '@iris-ui/tokens']
```

The `@iris-ui/*` workspace packages are consumed via `workspace:*`. Listing them
in `transpilePackages` makes Next run them through its own compiler, so the
`workspace:*` resolution and the injected `'use client'` boundaries resolve
cleanly in both the server-render and the client bundle.

## Running

```bash
pnpm --filter ssr-next dev     # http://localhost:5180
pnpm --filter ssr-next build   # the SSR/RSC-compat proof
```

`build` is wired into the monorepo's turbo graph, so
`pnpm turbo run build` exercises it as part of the standard gate.

## React version

Pinned to **React 18.3.1** + **react-dom 18.3.1** to match the repo's React
adapter (`@iris-ui/react` dev-deps React `^18.3.1`; its peer range is
`^18 || ^19`). Next is pinned to **14.2.x** — the Next 14 line targets React
18; Next 15 requires React 19, which would diverge from the rest of the repo.

## Scope — the other meta-frameworks are DEFERRED

This round (R14) is intentionally bounded to **one** app: Next.js App Router.

**Nuxt** (Vue), **SvelteKit** (Svelte), and **SolidStart** (Solid) are
**explicitly deferred**. Each would follow the _identical thin-smoke pattern_:
a server-rendered page that mounts a small island of `@iris-ui/{vue,svelte,solid}`
components (an overlay closed by default + a data component + a few basics),
where a successful framework build is the SSR proof. They are deferred to avoid
quadrupling heavy SSR toolchains in the monorepo in a single round; Next is the
canonical/strictest proof (RSC client boundaries) and validates the shared
architecture (injected `'use client'`, no server-side DOM, client-only theming)
that the other three reuse.
