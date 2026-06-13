import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import MenuHarness from './MenuHarness.svelte'

afterEach(cleanup)

describe('IrisMenu', () => {
  it('renders without crashing', () => {
    const { container } = render(MenuHarness)
    expect(container).toBeTruthy()
  })

  it('content is not visible initially', () => {
    const { container } = render(MenuHarness)
    expect(container.querySelector('[data-iris-menu-content]')).toBeNull()
  })

  it('opens on trigger click', async () => {
    const { getByText } = render(MenuHarness)
    await fireEvent.click(getByText('Menu'))
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
  })

  it('renders a separator with role="separator"', async () => {
    const { getByText } = render(MenuHarness)
    await fireEvent.click(getByText('Menu'))
    const sep = document.querySelector('[data-iris-menu-separator]')
    expect(sep).not.toBeNull()
    expect(sep?.getAttribute('role')).toBe('separator')
  })

  it('selects item and closes', async () => {
    const onSelect = vi.fn()
    const { getByText } = render(MenuHarness, { props: { onSelect } })
    await fireEvent.click(getByText('Menu'))
    await fireEvent.click(getByText('Item 1'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('Escape closes the menu', async () => {
    const { getByText } = render(MenuHarness)
    await fireEvent.click(getByText('Menu'))
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  describe('submenu keyboard', () => {
    const subTrigger = () => document.querySelector<HTMLElement>('[data-iris-menu-sub-trigger]')!
    const subContent = () => document.querySelector<HTMLElement>('[data-iris-menu-sub-content]')

    it('ArrowRight on the sub-trigger opens the submenu', async () => {
      const { getByText } = render(MenuHarness, { props: { withSub: true } })
      await fireEvent.click(getByText('Menu'))
      expect(subContent()).toBeNull()
      await fireEvent.keyDown(subTrigger(), { key: 'ArrowRight' })
      expect(subContent()).not.toBeNull()
      expect(subTrigger().getAttribute('aria-expanded')).toBe('true')
      // aria-controls references the submenu panel (not an unreferenced id).
      expect(subTrigger().getAttribute('aria-controls')).toBe(subContent()!.id)
    })

    it('ArrowLeft on the sub-trigger closes the submenu', async () => {
      const { getByText } = render(MenuHarness, { props: { withSub: true } })
      await fireEvent.click(getByText('Menu'))
      await fireEvent.keyDown(subTrigger(), { key: 'ArrowRight' })
      expect(subContent()).not.toBeNull()
      await fireEvent.keyDown(subTrigger(), { key: 'ArrowLeft' })
      expect(subContent()).toBeNull()
    })

    it('Escape inside the submenu closes it', async () => {
      const { getByText } = render(MenuHarness, { props: { withSub: true } })
      await fireEvent.click(getByText('Menu'))
      await fireEvent.keyDown(subTrigger(), { key: 'ArrowRight' })
      await fireEvent.keyDown(subContent()!, { key: 'Escape' })
      expect(subContent()).toBeNull()
    })

    it('ArrowDown inside the submenu moves focus between items', async () => {
      const { getByText } = render(MenuHarness, { props: { withSub: true } })
      await fireEvent.click(getByText('Menu'))
      await fireEvent.keyDown(subTrigger(), { key: 'ArrowRight' })
      const items = Array.from(subContent()!.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      items[0]!.focus()
      await fireEvent.keyDown(subContent()!, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(items[1])
    })

    it('a nested (2-level) submenu opens independently and a deep leaf closes the whole tree', async () => {
      const onDeepSelect = vi.fn()
      const { getByText } = render(MenuHarness, {
        props: { withSub: true, withNestedSub: true, onDeepSelect },
      })
      await fireEvent.click(getByText('Menu'))
      const subTriggers = () =>
        document.querySelectorAll<HTMLElement>('[data-iris-menu-sub-trigger]')
      await fireEvent.keyDown(subTriggers()[0]!, { key: 'ArrowRight' })
      // a second, nested sub-trigger ("Even more") now exists inside the first panel
      const nested = Array.from(subTriggers()).find((t) => t.textContent?.includes('Even more'))!
      expect(nested).toBeTruthy()
      await fireEvent.keyDown(nested, { key: 'ArrowRight' })
      const deep = getByText('Deep 1')
      expect(deep).toBeTruthy()
      // selecting the deep leaf collapses the ENTIRE tree (root closes)
      await fireEvent.click(deep)
      flushSync()
      expect(onDeepSelect).toHaveBeenCalledTimes(1)
      expect(document.querySelector('[data-iris-menu-content]')).toBeNull()
    })
  })
})
