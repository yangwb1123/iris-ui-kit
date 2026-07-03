import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import TabsHarness from './TabsHarness.svelte'

describe('IrisTabs', () => {
  it('shows active tab content', () => {
    const { getByText } = render(TabsHarness, { props: { defaultValue: 'a' } })
    expect(getByText('Content A')).toBeTruthy()
  })

  it('switches active tab on click', async () => {
    const { getByText, queryByText } = render(TabsHarness, { props: { defaultValue: 'a' } })
    // Content B should not be visible initially (lazy)
    expect(queryByText('Content B')).toBeFalsy()
    await fireEvent.click(getByText('Tab B'))
    flushSync()
    expect(getByText('Content B')).toBeTruthy()
  })

  it('sets aria-selected on active trigger', () => {
    const { container } = render(TabsHarness, { props: { defaultValue: 'a' } })
    const triggers = container.querySelectorAll('[data-iris-tabs-trigger]')
    expect(triggers[0].getAttribute('aria-selected')).toBe('true')
    expect(triggers[1].getAttribute('aria-selected')).toBe('false')
  })

  it('renders tablist with role', () => {
    const { container } = render(TabsHarness)
    expect(container.querySelector('[role="tablist"]')).not.toBeNull()
  })

  describe('keyboard navigation', () => {
    function triggers(container: HTMLElement): NodeListOf<HTMLElement> {
      return container.querySelectorAll('[data-iris-tabs-trigger]')
    }

    it('ArrowRight moves to next trigger (horizontal)', async () => {
      const { container, getByText, queryByText } = render(TabsHarness, {
        props: { defaultValue: 'a' },
      })
      expect(queryByText('Content B')).toBeFalsy()

      await fireEvent.keyDown(triggers(container)[0], { key: 'ArrowRight' })
      flushSync()

      expect(getByText('Content B')).toBeTruthy()
      expect(triggers(container)[0].getAttribute('aria-selected')).toBe('false')
      expect(triggers(container)[1].getAttribute('aria-selected')).toBe('true')
      expect(document.activeElement).toBe(triggers(container)[1])
    })

    it('ArrowLeft moves to previous trigger (horizontal)', async () => {
      const { container, getByText } = render(TabsHarness, {
        props: { defaultValue: 'b' },
      })
      expect(getByText('Content B')).toBeTruthy()

      await fireEvent.keyDown(triggers(container)[1], { key: 'ArrowLeft' })
      flushSync()

      expect(getByText('Content A')).toBeTruthy()
      expect(triggers(container)[0].getAttribute('aria-selected')).toBe('true')
      expect(triggers(container)[1].getAttribute('aria-selected')).toBe('false')
      expect(document.activeElement).toBe(triggers(container)[0])
    })

    it('ArrowDown moves to next trigger (vertical)', async () => {
      const { container, getByText, queryByText } = render(TabsHarness, {
        props: { defaultValue: 'a', orientation: 'vertical' },
      })
      expect(queryByText('Content B')).toBeFalsy()

      await fireEvent.keyDown(triggers(container)[0], { key: 'ArrowDown' })
      flushSync()

      expect(getByText('Content B')).toBeTruthy()
      expect(triggers(container)[0].getAttribute('aria-selected')).toBe('false')
      expect(triggers(container)[1].getAttribute('aria-selected')).toBe('true')
    })

    it('ArrowUp moves to previous trigger (vertical)', async () => {
      const { container, getByText } = render(TabsHarness, {
        props: { defaultValue: 'b', orientation: 'vertical' },
      })

      await fireEvent.keyDown(triggers(container)[1], { key: 'ArrowUp' })
      flushSync()

      expect(getByText('Content A')).toBeTruthy()
      expect(triggers(container)[0].getAttribute('aria-selected')).toBe('true')
      expect(triggers(container)[1].getAttribute('aria-selected')).toBe('false')
    })

    it('Home focuses and selects the first trigger', async () => {
      const { container, getByText } = render(TabsHarness, {
        props: { defaultValue: 'b' },
      })

      await fireEvent.keyDown(triggers(container)[1], { key: 'Home' })
      flushSync()

      expect(getByText('Content A')).toBeTruthy()
      expect(triggers(container)[0].getAttribute('aria-selected')).toBe('true')
      expect(document.activeElement).toBe(triggers(container)[0])
    })

    it('End focuses and selects the last trigger', async () => {
      const { container, getByText } = render(TabsHarness, {
        props: { defaultValue: 'a' },
      })

      await fireEvent.keyDown(triggers(container)[0], { key: 'End' })
      flushSync()

      expect(getByText('Content B')).toBeTruthy()
      expect(triggers(container)[1].getAttribute('aria-selected')).toBe('true')
      expect(document.activeElement).toBe(triggers(container)[1])
    })

    it('Enter on a non-active trigger activates the tab (via button click)', async () => {
      const onchange = vi.fn()
      const { container } = render(TabsHarness, {
        props: { defaultValue: 'a', onchange },
      })

      // The trigger is a <button>; pressing Enter fires a click natively.
      await fireEvent.click(triggers(container)[1])
      flushSync()

      expect(onchange).toHaveBeenCalledWith('b')
      expect(triggers(container)[0].getAttribute('aria-selected')).toBe('false')
      expect(triggers(container)[1].getAttribute('aria-selected')).toBe('true')
    })

    it('Space on a non-active trigger activates the tab (via button click)', async () => {
      const onchange = vi.fn()
      const { container } = render(TabsHarness, {
        props: { defaultValue: 'a', onchange },
      })

      // The trigger is a <button>; pressing Space fires a click natively.
      await fireEvent.click(triggers(container)[1])
      flushSync()

      expect(onchange).toHaveBeenCalledWith('b')
    })
  })
})
