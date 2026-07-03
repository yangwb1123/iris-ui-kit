/**
 * REAL SSR -> hydrate test for the ssr-solidstart app's @iris-ui/solid
 * composition. Replaces the old "build IS the test" placeholder with a genuine
 * renderToString -> hydrate round-trip that fails on a hydration mismatch (the
 * classic createUniqueId drift / server-vs-client markup divergence).
 *
 * ---------------------------------------------------------------------------
 * WHY THE SSR HALF RUNS IN A CHILD PROCESS
 * ---------------------------------------------------------------------------
 * Solid SSR and Solid hydrate need mutually-exclusive builds:
 *   - renderToString lives only in solid-js/web's *server* build (node
 *     condition) and needs components compiled `generate:'ssr'`.
 *   - hydrate lives only in the *client* build (browser condition) and needs
 *     components compiled `generate:'dom'` + `hydratable:true`.
 * A single Vitest module graph has one resolve condition + one Solid compile
 * target, so the two can't share it. We therefore split the round-trip across
 * one jsdom process:
 *   1. SERVER (child): `scripts/ssr-render.mjs` spins a Vite SSR server
 *      (node condition, `generate:'ssr'`), `ssrLoadModule`s `iris-tree.ssr.tsx`
 *      and renderToString's the SAME `IrisTree` this file hydrates — producing
 *      real hydratable markup with `data-hk` keys. (It must be a child: jsdom's
 *      TextEncoder trips esbuild's realm check and Vitest rewrites
 *      `import.meta.url`, both of which break Vite in-process.)
 *   2. CLIENT (this file): runs under the app vitest.config (jsdom, browser
 *      condition, `generate:'dom'` + hydratable via vite-plugin-solid `ssr:true`)
 *      and imports the SAME `IrisTree`, so its compiled DOM output shares the
 *      server's `data-hk` key scheme.
 * Hydrating (2) over (1)'s markup is a genuine reconcile: a server/client
 * divergence makes Solid's hydrate log to console.error/warn — which this test
 * asserts does NOT happen.
 *
 * Determinism: Solid resets createUniqueId per renderToString and re-derives
 * matching ids from the `data-hk` keys on hydrate, and both sides share the one
 * `IrisTree` (+ one themeStore), so no manual SSR id-context wiring is needed.
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { hydrate } from 'solid-js/web'

import { IrisTree } from './iris-tree'

// process.cwd() is the app root under vitest.
const appRoot = process.cwd()
const ssrScript = resolve(appRoot, 'scripts/ssr-render.mjs')

// A hydration mismatch surfaces through console.error/console.warn. We treat
// ANY console.error during hydrate as a failure, plus any warning whose text
// smells like a hydration problem.
const HYDRATION_PATTERN = /hydrat|mismatch|did not match|server.+client|reconcil/i

let serverHtml = ''

beforeAll(() => {
  // Render the iris composition to SSR markup in a clean Node child (see header).
  const out = execFileSync('node', [ssrScript], {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const m = /__IRIS_SSR_START__([\s\S]*)__IRIS_SSR_END__/.exec(out)
  if (!m) throw new Error(`SSR child did not emit markup. stdout was:\n${out}`)
  serverHtml = m[1]
}, 60_000)

afterAll(() => {
  document.body.innerHTML = ''
})

describe('ssr-solidstart — app iris composition: SSR render + real client hydrate', () => {
  it('server-renders the iris composition to non-empty, hydratable markup', () => {
    expect(typeof serverHtml).toBe('string')
    expect(serverHtml.length).toBeGreaterThan(0)
    // hydratable SSR output carries hydration keys.
    expect(serverHtml).toMatch(/data-hk=/)
    // sanity: the actual iris content is present in the server markup.
    expect(serverHtml).toContain('Primary action')
    expect(serverHtml).toContain('live badge')
    expect(serverHtml).toContain('Ada Lovelace')
    expect(serverHtml).toContain('Subscribe')
    expect(serverHtml).toContain('Notifications')
    expect(serverHtml).toContain('Accordion content A')
    expect(serverHtml).toContain('First item')
  })

  it('hydrates the server markup with NO hydration-mismatch warning', () => {
    const errors: unknown[][] = []
    const warnings: unknown[][] = []
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      errors.push(a)
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...a) => {
      warnings.push(a)
    })

    // Seed Solid's hydration registry. In a full SSR document this object is
    // emitted as an inline bootstrap <script> by the server runtime; with a
    // bare renderToString(tree) it isn't, so the client `hydrate` (which reads
    // globalThis._$HY) needs it defined. hydrate reconciles structurally from
    // the markup's `data-hk` keys, so an empty registry is the correct seed.
    const prevHY = (globalThis as Record<string, unknown>)._$HY
    ;(globalThis as Record<string, unknown>)._$HY = {
      events: [],
      completed: new WeakSet(),
      r: {},
      done: false,
      fe() {},
    }

    const container = document.createElement('div')
    container.innerHTML = serverHtml
    document.body.appendChild(container)

    let dispose: (() => void) | undefined
    try {
      // The real reconcile: client DOM build hydrating over the server markup.
      dispose = hydrate(() => IrisTree(), container)
    } finally {
      errSpy.mockRestore()
      warnSpy.mockRestore()
      ;(globalThis as Record<string, unknown>)._$HY = prevHY
    }

    // 1) NO console.error during hydrate (Solid surfaces hydration mismatches
    //    and reconcile failures through console.error).
    expect(errors, `console.error during hydrate:\n${JSON.stringify(errors)}`).toEqual([])

    // 2) NO hydration-mismatch-shaped warning.
    const mismatchWarnings = warnings.filter((w) =>
      w.some((arg) => typeof arg === 'string' && HYDRATION_PATTERN.test(arg)),
    )
    expect(
      mismatchWarnings,
      `hydration-mismatch warnings:\n${JSON.stringify(mismatchWarnings)}`,
    ).toEqual([])

    // 3) Sanity: after hydration the DOM still holds the iris content.
    // (Subscribe/Notifications are aria-label-only, so they're asserted
    // against serverHtml above, not here — they never appear in textContent.)
    const text = container.textContent ?? ''
    expect(text).toContain('Primary action')
    expect(text).toContain('live badge')
    expect(text).toContain('Ada Lovelace')
    expect(text).toContain('Accordion content A')
    expect(container.querySelector('button')).not.toBeNull()
    // IrisTable renders a role="table" element (not a native <table>).
    expect(container.querySelector('[data-iris-table]')).not.toBeNull()
    // Form controls that survived SSR hydration.
    expect(container.querySelector('[role="slider"]')).not.toBeNull()
    expect(
      container.querySelector('[role="radio"]') ?? container.querySelector('[data-iris-rating]'),
    ).not.toBeNull()
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-accordion]')).not.toBeNull()

    dispose?.()
    container.remove()
  })
})
