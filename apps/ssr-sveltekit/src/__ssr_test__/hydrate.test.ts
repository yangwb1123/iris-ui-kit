/**
 * APP-LEVEL SSR → hydrate test for the SvelteKit smoke app's iris composition.
 *
 * This replaces the old placeholder `test` script ("build IS the test") with a
 * REAL renderToString → hydrate assertion that catches hydration mismatches in
 * the component tree the app renders (ThemeProvider + Button/Input/Badge +
 * Dialog + Table), mirroring the per-adapter pattern in
 * `packages/svelte/src/hydration.test.ts` but applied to the app's composition.
 *
 * --------------------------------------------------------------------------
 * WHY TWO VITEST CONFIGS (`vitest.ssr.config.ts` + `vitest.hydrate.config.ts`)
 * --------------------------------------------------------------------------
 * Svelte 5's `render` (svelte/server) needs the *server* compilation of a
 * `.svelte` file; `mount(…, { hydrate:true })` needs the *client* (DOM) build +
 * a live DOM. vite-plugin-svelte emits exactly ONE compilation per `.svelte`
 * import, decided by the Vitest *environment* (node → server build, jsdom →
 * client build) — they are mutually exclusive in a single module graph (this is
 * the same wall documented in `packages/svelte/src/hydration.test.ts`). So the
 * app `test` script runs TWO vitest passes that ARE the two module graphs:
 *   1. `vitest.ssr.config.ts`   (node env)  — `ssr-generate.test.ts` server-
 *      renders `AppComposition.svelte` and writes `__ssr_fixture__.html`.
 *   2. `vitest.hydrate.config.ts` (jsdom env) — THIS file reads that fixture,
 *      puts it in a container, and `mount(…, { hydrate:true })`s the *client*
 *      build onto it, asserting no hydration-mismatch + content survives.
 * That is a genuine renderToString → hydrate flow against the app's real tree.
 *
 * `resolve.conditions` (in the hydrate config) puts `browser` before `node` so
 * `svelte` resolves to its client entry (the one that actually exposes
 * `mount`/`hydrate`) — the same thing `@testing-library/svelte`'s
 * `svelteTesting()` plugin does, inlined into config so the app needs no extra
 * dependency.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// jsdom env → vite-plugin-svelte compiles this to the CLIENT (DOM) build, which
// is what `mount(…, { hydrate:true })` requires.
import App from './AppComposition.svelte'

const FIXTURE = resolve(process.cwd(), 'src/__ssr_test__/__ssr_fixture__.html')

/** A console line that looks like a hydration / placement mismatch. */
function isMismatchMessage(args: unknown[]): boolean {
  const text = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')
  return /hydrat|mismatch|node_invalid_placement|did not match|expected server html/i.test(text)
}

describe('ssr-sveltekit — app composition hydrates without mismatch', () => {
  it('hydrates the server-rendered iris composition with no mismatch warning', () => {
    // 1. The SSR HTML was produced (real svelte/server render) by the node-env
    //    pass (`ssr-generate.test.ts`) and persisted to this fixture.
    const ssrHtml = readFileSync(FIXTURE, 'utf8')
    expect(ssrHtml.length, 'SSR fixture should be non-empty').toBeGreaterThan(0)
    // Sanity: SSR output carries Svelte 5 hydration markers + the iris content.
    expect(ssrHtml).toContain('<!--[-->')
    expect(ssrHtml).toContain('Ada Lovelace')

    // 2. Put the SSR HTML into a jsdom container, then HYDRATE the client build.
    const container = document.createElement('div')
    container.innerHTML = ssrHtml
    document.body.appendChild(container)

    // 3. Spy on console.error/console.warn across hydration. An SSR/hydration
    //    failure (invalid DOM placement, `effect_orphan`, a real hydration
    //    mismatch, a thrown lifecycle error) surfaces here — that is exactly how
    //    the original `+page.svelte` `asChild` <button>-in-<button> bug shows up
    //    (`node_invalid_placement_ssr … will likely result in a
    //    hydration_mismatch`), which is why this composition avoids it.
    const errors: unknown[][] = []
    const warnings: unknown[][] = []
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      errors.push(a)
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...a) => {
      warnings.push(a)
    })

    let comp: ReturnType<typeof mount> | undefined
    try {
      comp = mount(App, { target: container, props: {}, hydrate: true } as never)
    } finally {
      errSpy.mockRestore()
      warnSpy.mockRestore()
    }

    // No console.error / console.warn at all during hydration…
    expect(errors, `console.error during hydrate:\n${JSON.stringify(errors, null, 2)}`).toEqual([])
    expect(warnings, `console.warn during hydrate:\n${JSON.stringify(warnings, null, 2)}`).toEqual(
      [],
    )
    // …and specifically NOTHING that reads like a hydration mismatch.
    expect(errors.some(isMismatchMessage), 'a hydration-mismatch error fired').toBe(false)
    expect(warnings.some(isMismatchMessage), 'a hydration-mismatch warning fired').toBe(false)

    // 4. Sanity: the hydrated DOM still contains the iris content.
    expect(container.textContent).toContain('Ada Lovelace') // IrisTable rows
    expect(container.textContent).toContain('live badge') // IrisBadge
    expect(container.textContent).toContain('Primary action') // IrisButton
    expect(container.querySelector('button.iris-button'), 'hydrated IrisButton').not.toBeNull()
    expect(container.querySelector('[data-iris-table]'), 'hydrated IrisTable').not.toBeNull()

    if (comp) unmount(comp)
  })
})
