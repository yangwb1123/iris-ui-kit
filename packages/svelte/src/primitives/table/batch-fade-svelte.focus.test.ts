import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import IrisTable from './IrisTable.svelte'
import { TABLE_FADE_STYLES, TABLE_STYLES } from './table-styles'

const columns = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'age', title: 'Age', width: 120 },
]
const data = [{ id: 1, name: 'Alice', age: 25 }]

function installAnimationFrameStub(): void {
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) =>
    window.setTimeout(() => callback(0), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
}

async function flush(): Promise<void> {
  await tick()
  await Promise.resolve()
  await tick()
}

async function stepFrames(): Promise<void> {
  vi.advanceTimersByTime(16)
  await flush()
  vi.advanceTimersByTime(16)
  await flush()
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.getElementById('iris-table-column-fade-styles-svelte')?.remove()
})

describe('Svelte IrisTable columnFade focus recovery', () => {
  it('uses token-backed transitions with a reduced-motion CSS freeze gate', () => {
    const view = render(IrisTable, { props: { columns, data, columnFade: true } })
    expect(TABLE_STYLES).not.toContain('transition: opacity')
    expect(TABLE_FADE_STYLES).toContain('transition: opacity var(--iris-duration-md, 200ms) ease;')
    expect(TABLE_FADE_STYLES).toContain(
      'transition: grid-template-columns var(--iris-duration-md, 200ms) ease;',
    )
    expect(TABLE_FADE_STYLES).toContain('@media (prefers-reduced-motion: reduce)')
    expect(TABLE_FADE_STYLES).toContain('transition: none !important;')
    expect(view.container.querySelector('[data-iris-table]')).not.toBeNull()
    expect(
      view.container.querySelector<HTMLElement>('[data-iris-table-row-key="1"]')?.style.transition,
    ).toContain('background-color')
    expect(TABLE_STYLES).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })

  it('moves focus from a collapsed cell and marks it inert/hidden', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const view = render(IrisTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        columnVisibility: {},
        columnFade: true,
        keyboardNavigation: true,
      },
    })
    const fading = view.container.querySelector(
      '[data-iris-table-row-key="1"] [data-iris-table-cell="age"]',
    ) as HTMLElement
    fading.focus()
    expect(document.activeElement).toBe(fading)
    await view.rerender({
      columns,
      data,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
      keyboardNavigation: true,
    })
    await stepFrames()
    expect(fading.getAttribute('aria-hidden')).toBe('true')
    expect(fading.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(
      view.container.querySelector('[data-iris-table-cell="name"]'),
    )
  })

  it('recovers same-row focus when reduced motion disables the fade', async () => {
    vi.useFakeTimers()
    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('matchMedia', () => media as unknown as MediaQueryList)
    const view = render(IrisTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        columnVisibility: {},
        columnFade: true,
        keyboardNavigation: true,
      },
    })
    await flush()
    const fading = view.container.querySelector(
      '[data-iris-table-row-key="1"] [data-iris-table-cell="age"]',
    ) as HTMLElement
    fading.focus()
    await view.rerender({
      columns,
      data,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
      keyboardNavigation: true,
    })
    await flush()
    expect(view.container.querySelector('[data-iris-table-cell="age"]')).toBeNull()
    expect(document.activeElement).toBe(
      view.container.querySelector('[data-iris-table-cell="name"]'),
    )
  })

  it('recovers same-row focus when the feature is disabled during a hide', async () => {
    vi.useFakeTimers()
    const view = render(IrisTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        columnVisibility: {},
        columnFade: true,
        keyboardNavigation: true,
      },
    })
    await flush()
    const fading = view.container.querySelector(
      '[data-iris-table-row-key="1"] [data-iris-table-cell="age"]',
    ) as HTMLElement
    fading.focus()
    await view.rerender({
      columns,
      data,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: false,
      keyboardNavigation: true,
    })
    await flush()
    expect(view.container.querySelector('[data-iris-table-cell="age"]')).toBeNull()
    expect(document.activeElement).toBe(
      view.container.querySelector('[data-iris-table-cell="name"]'),
    )
  })

  it('does not steal focus after the user leaves the table during a fade', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const outside = document.createElement('button')
    outside.type = 'button'
    outside.textContent = 'Outside'
    document.body.appendChild(outside)
    const view = render(IrisTable, {
      props: { columns, data, rowKey: 'id', columnVisibility: {}, columnFade: true },
    })
    const fading = view.container.querySelector(
      '[data-iris-table-row-key="1"] [data-iris-table-cell="age"]',
    ) as HTMLElement
    fading.focus()
    await view.rerender({
      columns,
      data,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    outside.focus()
    await stepFrames()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})
