/**
 * Server-render entry, loaded ONLY through Vite's `ssrLoadModule` by
 * `hydration.test.tsx`. Because it is evaluated in Vite's SSR module graph,
 * vite-plugin-solid compiles `IrisTree` with `generate:'ssr'` + `hydratable`,
 * and `solid-js/web` here is the *server* build (the one that actually exposes
 * a working `renderToString`). The returned string carries `data-hk` hydration
 * keys that the client `hydrate()` reconciles against.
 */
import { renderToString } from 'solid-js/web'
import { IrisTree } from './iris-tree'

export function renderIrisTreeToString(): string {
  return renderToString(() => IrisTree())
}
