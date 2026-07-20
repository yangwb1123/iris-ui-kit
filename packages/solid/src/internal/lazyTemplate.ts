// Build-time-only shim wired in via `tsup.config.ts`'s esbuild `alias` as the
// `moduleName` babel-plugin-jsx-dom-expressions imports its DOM runtime
// helpers from (see that file for why). Not part of the public API — never
// exported from `src/index.tsx`.
//
// Solid's compiler hoists a `template()` call to *module scope* for every
// component with static markup (`var _tmpl$ = template('<div>')`, reused via
// `.cloneNode()` per instance — a perf optimization). `solid-js/web`'s own
// package.json resolves the plain `node`/`import`-only condition set (e.g.
// `node -e "import(pkg)"`, an SSR entry point before hydration, a non-jsdom
// test runner) to its *server* build, where `template` is aliased straight
// to a stub that throws synchronously ("Client-only API called on the
// server side") the instant it's called — not when its result is used, when
// it's called. So merely *importing* a compiled component throws before any
// component ever mounts.
//
// `solid-js/web`'s real (browser) `template()` is itself already internally
// lazy — it defers `document.createElement` until the returned closure is
// invoked. We add one more layer of laziness around the *call itself*, so
// resolving `solid-js/web`'s real implementation only happens on first
// actual render (when `_tmpl$()` is invoked by component code), never at
// module evaluation. For real (browser/jsdom) usage this is behaviorally
// identical to today — same implementation, invoked one tick later.
export * from 'solid-js/web'

import { template as realTemplate, delegateEvents as realDelegateEvents } from 'solid-js/web'

type TemplateFn = (() => Element) & { cloneNode?: TemplateFn }

export function template(html: string, isCE?: boolean, isSVG?: boolean): TemplateFn {
  let fn: TemplateFn | undefined
  const lazy: TemplateFn = () => {
    if (!fn) fn = realTemplate(html, isCE, isSVG) as TemplateFn
    return fn()
  }
  lazy.cloneNode = lazy
  return lazy
}

// The compiler also emits a module-scope `delegateEvents([...])` call per
// file that uses delegated (bubbling) event props — real one-time setup, not
// something with a "later" hook to defer into like `template()` above. But
// it's meaningless (and, via the server stub, throwing) without a DOM to
// delegate on, so — matching this package's existing SSR guard convention
// (see IrisDialogContent) — only run it when `document` genuinely exists.
// Real browser/jsdom rendering always has `document`, so this is a no-op
// change there: same call, same timing.
export function delegateEvents(...args: Parameters<typeof realDelegateEvents>): void {
  if (typeof document === 'undefined') return
  realDelegateEvents(...args)
}
