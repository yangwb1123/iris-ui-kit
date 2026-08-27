import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { hydrate } from 'solid-js/web'
import { BATCH_FADE_SOLID_SSR_FIXTURE } from './batch-fade-solid.ssr-fixture'
import { IrisTable } from './IrisTable'

const columns = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'age', title: 'Age', width: 120 },
]
const data = [{ id: 1, name: 'Alice', age: 25 }]
let container: HTMLDivElement | null = null
let dispose: (() => void) | undefined

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  dispose?.()
  dispose = undefined
  container?.remove()
  container = null
  delete (globalThis as typeof globalThis & { _$HY?: unknown })._$HY
  vi.restoreAllMocks()
})

describe('Solid IrisTable columnFade hydration', () => {
  it('hydrates initially hidden markup and handles the first visibility update', async () => {
    container = document.createElement('div')
    container.appendChild(
      document.createRange().createContextualFragment(BATCH_FADE_SOLID_SSR_FIXTURE),
    )
    document.body.appendChild(container)
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({ age: false })
    const warnings: unknown[][] = []
    const errors: unknown[][] = []
    ;(globalThis as typeof globalThis & { _$HY?: unknown })._$HY = {
      done: false,
      completed: new Set<Node>(),
      events: [],
      r: {},
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => warnings.push(args))
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args))
    try {
      dispose = hydrate(
        () => (
          <IrisTable
            columns={columns}
            data={data}
            rowKey="id"
            columnVisibility={visibility()}
            columnFade
          />
        ),
        container,
      )
      expect(
        [...warnings, ...errors].filter((args) =>
          args.some((arg) => typeof arg === 'string' && /hydration|mismatch/i.test(arg)),
        ),
      ).toEqual([])
      expect(container.querySelector('[data-iris-table]')).not.toBeNull()
      expect(container.querySelector('[data-iris-table-cell="age"]')).toBeNull()
      expect(container.querySelector('[data-iris-column-fade-active]')).toBeNull()

      setVisibility({ age: true })
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
