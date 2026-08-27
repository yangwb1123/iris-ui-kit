import { afterEach, describe, expect, it, vi } from 'vitest'
import { hydrate, tick, unmount } from 'svelte'
import Harness from './batch-fade-svelte-hydration-harness.svelte'
import { BATCH_FADE_SVELTE_SSR_FIXTURE } from './batch-fade-svelte.ssr-fixture'

let container: HTMLDivElement | null = null
let instance: ReturnType<typeof hydrate> | undefined

async function flush(): Promise<void> {
  await tick()
  await Promise.resolve()
  await tick()
}

afterEach(() => {
  if (instance) unmount(instance)
  instance = undefined
  container?.remove()
  container = null
  vi.restoreAllMocks()
})

describe('Svelte IrisTable columnFade hydration', () => {
  it('hydrates settled initial-hidden markup and animates a later toggle', async () => {
    container = document.createElement('div')
    container.innerHTML = BATCH_FADE_SVELTE_SSR_FIXTURE
    document.body.appendChild(container)
    const warnings: unknown[][] = []
    const errors: unknown[][] = []
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => warnings.push(args))
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args))

    try {
      instance = hydrate(Harness, { target: container, props: {} })
      expect(
        [...warnings, ...errors].filter((args) =>
          args.some((arg) => typeof arg === 'string' && /hydration|mismatch/i.test(arg)),
        ),
      ).toEqual([])
      expect(container.querySelector('[data-iris-table]')).not.toBeNull()
      expect(container.querySelector('[data-iris-table-cell="age"]')).toBeNull()
      expect(container.querySelector('[data-iris-column-fade-active]')).toBeNull()

      ;(instance as unknown as { showAge: () => void }).showAge()
      await flush()
      expect(
        container
          .querySelector('[data-iris-table-cell="age"]')
          ?.getAttribute('data-iris-column-fade'),
      ).toBe('in')
    } finally {
      warn.mockRestore()
      error.mockRestore()
    }
  })
})
