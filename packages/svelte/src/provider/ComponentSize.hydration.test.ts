import { afterEach, describe, expect, it, vi } from 'vitest'
import { hydrate, tick, unmount } from 'svelte'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import Nested from './ComponentSizeNestedHarness.svelte'
import Reactive from './ComponentSizeReactiveHarness.svelte'

const roots: Array<{ container: HTMLDivElement; instance: ReturnType<typeof hydrate> }> = []

function serverMarkups(filename: string, props: Array<Record<string, unknown>>): string[] {
  // Keep compilation/rendering INSIDE the existing test deadline. One native
  // server renders each distinct request freshly, without recompiling identical
  // sources for every root. This is neither precomputed markup nor extra time.
  // Its native typed-array realm stays separate from jsdom.
  const script = `
    import { createServer } from 'vite';
    import { svelte } from '@sveltejs/vite-plugin-svelte';
    const server = await createServer({ configFile: false, logLevel: 'error',
      // Vitest disables HMR; its SSR companion must use the same compiler mode.
      // Svelte 5 ignores legacy hot:false, leaving Vite's default HMR enabled.
      plugins: [svelte({ compilerOptions: { hmr: false, preserveWhitespace: false } })], resolve: { conditions: ['node'] },
      // These frozen, SSR-only requests need neither HMR/WebSocket transport
      // nor file watching. hmr:false alone does not disable Vite 6's socket.
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      ssr: { resolve: { conditions: ['node'] } } });
    try {
      const component = await server.ssrLoadModule('/src/provider/' + process.argv[1] + '.svelte');
      const { render } = await server.ssrLoadModule('svelte/server');
      const requests = JSON.parse(process.argv[2]);
      const bodies = requests.map(props => render(component.default, { props }).body);
      console.log(JSON.stringify({ bodies,
        hmrDisabled: server.config.server.hmr === false,
        websocketDisabled: server.config.server.ws === false,
        watcherDisabled: server.config.server.watch === null }));
    } finally { await server.close(); }
  `
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script, filename, JSON.stringify(props)],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 256 * 1024,
    },
  )
  expect(result.status, result.stderr || String(result.error)).toBe(0)
  const { bodies, hmrDisabled, websocketDisabled, watcherDisabled } = JSON.parse(result.stdout) as {
    bodies: string[]
    hmrDisabled: boolean
    websocketDisabled: boolean
    watcherDisabled: boolean
  }
  // These are the native server's resolved options, not a mocked renderer.
  expect(hmrDisabled, 'SSR-only requests do not need development hot updates').toBe(true)
  expect(websocketDisabled, 'SSR-only requests must not start a WebSocket transport').toBe(true)
  expect(watcherDisabled, 'Frozen SSR source does not need a file watcher').toBe(true)
  expect(bodies).toHaveLength(props.length)
  expect(bodies.every((body) => typeof body === 'string')).toBe(true)
  return bodies
}
afterEach(async () => {
  for (const { container, instance } of roots.splice(0)) {
    await unmount(instance)
    container.remove()
  }
  vi.restoreAllMocks()
})

async function hydrated(name: 'Nested' | 'Reactive', props: Record<string, unknown>, html: string) {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  const before = Array.from(container.querySelectorAll('[data-iris-input]'))
  const warnings = vi.spyOn(console, 'warn')
  const errors = vi.spyOn(console, 'error')
  const instance = hydrate(name === 'Nested' ? Nested : Reactive, {
    target: container,
    props,
    recover: false,
  })
  roots.push({ container, instance })
  await tick()
  const after = Array.from(container.querySelectorAll('[data-iris-input]'))
  expect(after).toHaveLength(before.length)
  after.forEach((element, index) => expect(element).toBe(before[index]))
  const diagnostics = [...warnings.mock.calls, ...errors.mock.calls]
  expect(diagnostics.filter((args) => /hydration|mismatch/i.test(args.join(' ')))).toEqual([])
  warnings.mockRestore()
  errors.mockRestore()
  return container
}

function sizes(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-iris-input-size]')).map((el) =>
    el.getAttribute('data-iris-input-size'),
  )
}
async function cycle(container: HTMLElement) {
  container.querySelector<HTMLButtonElement>('[data-testid="cycle"]')!.click()
  await tick()
}

describe('Svelte provider actual SSR-to-client hydration', () => {
  it('inherits and overrides nested sizes without replacing SSR controls', async () => {
    const [inherited, overridden] = serverMarkups('ComponentSizeNestedHarness', [
      {},
      { innerSize: 'lg' },
    ])
    expect(sizes(await hydrated('Nested', {}, inherited))).toEqual(['sm', 'sm', 'sm'])
    expect(sizes(await hydrated('Nested', { innerSize: 'lg' }, overridden))).toEqual([
      'sm',
      'lg',
      'sm',
    ])
  })
  it('updates hydrated size without remounting or leaking between independent roots', async () => {
    const [first, second] = serverMarkups('ComponentSizeReactiveHarness', [{}, {}])
    const a = await hydrated('Reactive', {}, first)
    const b = await hydrated('Reactive', {}, second)
    const input = a.querySelector('input')!
    input.focus()
    await cycle(a)
    expect(sizes(a)).toEqual(['lg'])
    expect(sizes(b)).toEqual(['sm'])
    expect(a.querySelector('input')).toBe(input)
    expect(document.activeElement).toBe(input)
    await cycle(a)
    expect(sizes(a)).toEqual(['md'])
    await unmount(roots[0].instance)
    roots[0].container.remove()
    roots.shift()
    await cycle(b)
    expect(sizes(b)).toEqual(['lg'])
    await cycle(b)
    expect(sizes(b)).toEqual(['md'])
  })
})
