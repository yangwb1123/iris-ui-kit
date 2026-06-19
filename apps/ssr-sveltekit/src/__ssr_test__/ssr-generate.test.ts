/**
 * PASS 1 of the app's SSR → hydrate test (node env, `vitest.ssr.config.ts`).
 *
 * Runs in a node environment so vite-plugin-svelte compiles the iris
 * composition to Svelte 5's *server* build, then server-renders it with
 * `render` from `svelte/server` (real renderToString) and writes the HTML to
 * `__ssr_fixture__.html`. PASS 2 (`hydrate.test.ts`, jsdom env) reads that
 * fixture and hydrates the *client* build onto it. The two passes are two
 * separate module graphs on purpose — see the header in `hydrate.test.ts` for
 * why server + client builds cannot coexist in one Vitest config.
 *
 * Asserting no console.error/console.warn HERE is itself load-bearing: the live
 * page's `<IrisDialogTrigger asChild><IrisButton/></IrisDialogTrigger>` markup
 * makes svelte/server log `node_invalid_placement_ssr … will likely result in a
 * hydration_mismatch` (the Svelte trigger does not implement `asChild`, so it
 * nests a <button> in a <button>). `AppComposition.svelte` uses the dialog the
 * Svelte-supported way, so this pass is clean.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from 'svelte/server'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import App from './AppComposition.svelte'

const FIXTURE = resolve(process.cwd(), 'src/__ssr_test__/__ssr_fixture__.html')

function isMismatchMessage(args: unknown[]): boolean {
  const text = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')
  return /hydrat|mismatch|node_invalid_placement|did not match/i.test(text)
}

describe('ssr-sveltekit — app composition server-renders cleanly (SSR pass)', () => {
  it('server-renders the iris composition with no SSR error and writes the hydration fixture', () => {
    const errors: unknown[][] = []
    const warnings: unknown[][] = []
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      errors.push(a)
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...a) => {
      warnings.push(a)
    })

    let body = ''
    try {
      body = render(App as never, { props: {} } as never).body
    } finally {
      errSpy.mockRestore()
      warnSpy.mockRestore()
    }

    expect(body.length, 'SSR body should be non-empty').toBeGreaterThan(0)
    expect(errors, `console.error during SSR:\n${JSON.stringify(errors, null, 2)}`).toEqual([])
    expect(warnings, `console.warn during SSR:\n${JSON.stringify(warnings, null, 2)}`).toEqual([])
    expect(errors.some(isMismatchMessage), 'SSR logged a placement/mismatch error').toBe(false)
    // Svelte 5 hydratable output + the iris content must be present.
    expect(body).toContain('<!--[-->')
    expect(body).toContain('Ada Lovelace')

    // Persist for PASS 2 (jsdom hydrate).
    mkdirSync(dirname(FIXTURE), { recursive: true })
    writeFileSync(FIXTURE, body, 'utf8')
  })
})
