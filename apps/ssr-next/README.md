# `ssr-next` — Next.js App Router SSR/RSC smoke (ROADMAP v3 R14)

The canonical proof that `@iris-ui-kit/react` works inside a **real meta-framework
SSR/RSC pipeline**. The library claims "SSR/RSC-ready"; this app is what
actually builds it through Next.js's App Router server renderer.

## Why a Next App Router build is the proof

`next build` server-renders every route at build time. That single command is a
strict, end-to-end compatibility gate because it fails hard on:

- **bad client boundaries** — a component using hooks/state/effects without a
  `'use client'` directive (directly or transitively) errors during the RSC
  pass. `@iris-ui-kit/react` injects `'use client'` into _every_ emitted entry (see
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
next.config.mjs  transpilePackages for the workspace @iris-ui-kit packages
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
- **Forms:** `IrisForm` + `useForm` + `useField` + `IrisFormField` — an "Add
  team member" form with two required, validated fields. The most
  stateful/validation-heavy component class in the library, and the kind most
  likely to hit an SSR-only bug (validation engine touching the DOM at the
  wrong time, or a server-vs-client mismatch in the initial validation state).
  It server-renders untouched (no errors) and becomes interactive — typing,
  blur-validation, submit — only after hydration.
- **Basics:** `IrisButton`, `IrisInput` (controlled via `useState`), `IrisBadge`.
- **Theming:** `ThemeProvider` + `createThemeStore` (client-only CSS-var
  injection).

## next.config — `transpilePackages`

```js
transpilePackages: [
  '@iris-ui-kit/react',
  '@iris-ui-kit/core',
  '@iris-ui-kit/theme',
  '@iris-ui-kit/tokens',
]
```

The `@iris-ui-kit/*` workspace packages are consumed via `workspace:*`. Listing them
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

## Versions and four-framework SSR matrix

This reference uses **Next 15.5.21** with React/React DOM 18.3.1, which remains
inside the adapter's `^18 || ^19` peer range. It now exposes `/`, `/data`,
`/feedback`, and `/api/feedback`; tests start the optimized production server
on an ephemeral port and verify RSC HTML, server data, JSON validation, and the
no-JavaScript form redirect.

The same production proof exists for every adapter:

| Adapter | Meta-framework     | Production proof                                                   |
| ------- | ------------------ | ------------------------------------------------------------------ |
| React   | Next.js App Router | RSC/client boundary, hydration, multi-route HTTP and route handler |
| Vue     | Nuxt               | hydration, `useAsyncData`, server API and progressive form POST    |
| Solid   | SolidStart         | hydration, server query/action and multi-route HTTP                |
| Svelte  | SvelteKit          | SSR/hydration, server load/action and multi-route HTTP             |

All four apps are part of the monorepo build/test graph; none is deferred.
