import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIconRegistry } from '@iris-ui-kit/icons'
import IrisIconPicker from './IrisIconPicker.svelte'

afterEach(cleanup)

const categories = [{ id: 'common', label: 'Common', iconNames: ['check', 'folder'] }] as const

describe('@iris-ui-kit/svelte IrisIconPicker', () => {
  it('renders and filters semantic icon names by search and category', async () => {
    const { container } = render(IrisIconPicker, {
      props: { iconNames: ['check', 'folder', 'home'], categories },
    })
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3)
    const common = container.querySelector(
      '[data-iris-icon-picker-category="common"]',
    ) as HTMLButtonElement
    await fireEvent.click(common)
    flushSync()
    expect(
      Array.from(container.querySelectorAll('[role="option"]')).map((node) =>
        node.getAttribute('aria-label'),
      ),
    ).toEqual(['check', 'folder'])
    const search = container.querySelector('input[type="search"]') as HTMLInputElement
    search.value = 'folder'
    await fireEvent.input(search)
    flushSync()
    expect(
      Array.from(container.querySelectorAll('[role="option"]')).map((node) =>
        node.getAttribute('aria-label'),
      ),
    ).toEqual(['folder'])
  })

  it('supports arrow-key focus, selection callback, and empty state', async () => {
    const onValueChange = vi.fn()
    const { container } = render(IrisIconPicker, {
      props: { iconNames: ['check', 'folder'], onValueChange },
    })
    const search = container.querySelector('input[type="search"]') as HTMLInputElement
    await fireEvent.keyDown(search, { key: 'ArrowDown' })
    flushSync()
    const check = container.querySelector(
      '[data-iris-icon-picker-option="check"]',
    ) as HTMLButtonElement
    expect(document.activeElement).toBe(check)
    await fireEvent.keyDown(check, { key: 'ArrowRight' })
    flushSync()
    const folder = container.querySelector(
      '[data-iris-icon-picker-option="folder"]',
    ) as HTMLButtonElement
    expect(document.activeElement).toBe(folder)
    await fireEvent.click(folder)
    flushSync()
    expect(onValueChange).toHaveBeenCalledWith('folder')
    expect(folder.getAttribute('aria-selected')).toBe('true')

    search.value = 'missing'
    await fireEvent.input(search)
    flushSync()
    expect(container.querySelector('[data-iris-icon-picker-empty]')?.textContent).toContain(
      'No icons found',
    )
  })

  it('resolves custom registries without accepting raw SVG markup', async () => {
    const registry = createIconRegistry({
      icons: [{ name: 'custom', nodes: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 4 } }] }],
    })
    const onValueChange = vi.fn()
    const { container } = render(IrisIconPicker, {
      props: { value: 'custom', registry, onValueChange, label: 'Choose glyph' },
    })
    const option = container.querySelector(
      '[data-iris-icon-picker-option="custom"]',
    ) as HTMLButtonElement
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Choose glyph',
    )
    await fireEvent.click(option)
    flushSync()
    expect(onValueChange).toHaveBeenCalledWith('custom')
    expect(option.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('svg circle')).not.toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })
})
