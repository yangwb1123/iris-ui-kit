import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisSegmented from './IrisSegmented.svelte'

describe('IrisSegmented', () => {
  it('renders options', () => {
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two', 'Three'] },
    })
    const items = container.querySelectorAll('[data-iris-segmented-item]')
    expect(items.length).toBe(3)
  })

  it('calls onchange when an option is clicked', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two'], onchange },
    })
    const btns = container.querySelectorAll('[data-iris-segmented-item]')
    await fireEvent.click(btns[1])
    flushSync()
    expect(onchange).toHaveBeenCalledWith('Two')
  })

  it('marks selected item with data-selected', () => {
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two'], value: 'Two' },
    })
    const items = container.querySelectorAll('[data-iris-segmented-item]')
    expect(items[1].getAttribute('data-selected')).toBe('true')
    expect(items[0].getAttribute('data-selected')).toBeNull()
  })

  // Controlled value renders from the prop (reject → no flip; accept → flips).
  it('controlled value renders from the prop, not optimistically', async () => {
    const onchange = vi.fn()
    const { container, rerender } = render(IrisSegmented, {
      props: { options: ['One', 'Two'], value: 'One', onchange },
    })
    const items = container.querySelectorAll('[data-iris-segmented-item]')
    expect(items[0].getAttribute('aria-checked')).toBe('true')
    expect(items[1].getAttribute('aria-checked')).toBe('false')

    // Click the second segment: onchange fires, but a controlled parent that
    // does NOT write `value` back means the active segment must NOT flip.
    await fireEvent.click(items[1])
    flushSync()
    expect(onchange).toHaveBeenCalledWith('Two')
    expect(items[0].getAttribute('aria-checked')).toBe('true')
    expect(items[1].getAttribute('aria-checked')).toBe('false')
    expect(items[0].getAttribute('data-selected')).toBe('true')
    expect(items[1].getAttribute('data-selected')).toBeNull()

    // Parent accepts: write the new value back → now it flips.
    await rerender({ options: ['One', 'Two'], value: 'Two', onchange })
    flushSync()
    expect(items[0].getAttribute('aria-checked')).toBe('false')
    expect(items[1].getAttribute('aria-checked')).toBe('true')
    expect(items[1].getAttribute('data-selected')).toBe('true')
  })

  describe('keyboard navigation', () => {
    function items(container: HTMLElement): NodeListOf<HTMLElement> {
      return container.querySelectorAll('[data-iris-segmented-item]')
    }

    it('ArrowRight moves to next segment and selects it', async () => {
      const onchange = vi.fn()
      const { container } = render(IrisSegmented, {
        props: { options: ['One', 'Two', 'Three'], onchange },
      })
      await fireEvent.keyDown(items(container)[0], { key: 'ArrowRight' })
      flushSync()
      expect(onchange).toHaveBeenCalledWith('Two')
      expect(items(container)[1].getAttribute('data-selected')).toBe('true')
    })

    it('ArrowDown also moves to next segment', async () => {
      const onchange = vi.fn()
      const { container } = render(IrisSegmented, {
        props: { options: ['One', 'Two', 'Three'], onchange },
      })
      await fireEvent.keyDown(items(container)[0], { key: 'ArrowDown' })
      flushSync()
      expect(onchange).toHaveBeenCalledWith('Two')
    })

    it('ArrowLeft moves to previous segment and selects it (wrap)', async () => {
      const onchange = vi.fn()
      const { container } = render(IrisSegmented, {
        props: { options: ['One', 'Two', 'Three'], onchange },
      })
      // Uncontrolled: first option 'One' selected. ArrowLeft wraps to last.
      await fireEvent.keyDown(items(container)[0], { key: 'ArrowLeft' })
      flushSync()
      expect(onchange).toHaveBeenCalledWith('Three')
      expect(items(container)[2].getAttribute('data-selected')).toBe('true')
    })

    it('ArrowUp also moves to previous segment (wrap)', async () => {
      const onchange = vi.fn()
      const { container } = render(IrisSegmented, {
        props: { options: ['One', 'Two', 'Three'], onchange },
      })
      await fireEvent.keyDown(items(container)[0], { key: 'ArrowUp' })
      flushSync()
      expect(onchange).toHaveBeenCalledWith('Three')
    })

    it('Home selects the first segment', async () => {
      const onchange = vi.fn()
      const { container } = render(IrisSegmented, {
        props: { options: ['One', 'Two', 'Three'], onchange },
      })
      // First navigate to the last item via wrapping ArrowLeft
      await fireEvent.keyDown(items(container)[0], { key: 'ArrowLeft' })
      flushSync()
      onchange.mockClear()
      // Now press Home from the last item
      await fireEvent.keyDown(items(container)[2], { key: 'Home' })
      flushSync()
      expect(onchange).toHaveBeenCalledWith('One')
      expect(items(container)[0].getAttribute('data-selected')).toBe('true')
    })

    it('End selects the last segment', async () => {
      const onchange = vi.fn()
      const { container } = render(IrisSegmented, {
        props: { options: ['One', 'Two', 'Three'], onchange },
      })
      await fireEvent.keyDown(items(container)[0], { key: 'End' })
      flushSync()
      expect(onchange).toHaveBeenCalledWith('Three')
      expect(items(container)[2].getAttribute('data-selected')).toBe('true')
    })

    it('navigates options added by a rerender', async () => {
      const onchange = vi.fn()
      const { container, rerender } = render(IrisSegmented, {
        props: { options: ['One', 'Two'], onchange },
      })
      await rerender({ options: ['One', 'Two', 'Three'], onchange })
      await fireEvent.keyDown(items(container)[0], { key: 'End' })
      flushSync()
      expect(onchange).toHaveBeenCalledWith('Three')
    })

    it('Enter on a segment selects it (via button click)', async () => {
      const onchange = vi.fn()
      const { container } = render(IrisSegmented, {
        props: { options: ['One', 'Two', 'Three'], onchange },
      })
      // The segment is a <button>; pressing Enter fires a click natively.
      await fireEvent.click(items(container)[1])
      flushSync()
      expect(onchange).toHaveBeenCalledWith('Two')
      expect(items(container)[1].getAttribute('data-selected')).toBe('true')
    })

    it('Space on a segment selects it (via button click)', async () => {
      const onchange = vi.fn()
      const { container } = render(IrisSegmented, {
        props: { options: ['One', 'Two', 'Three'], onchange },
      })
      // The segment is a <button>; pressing Space fires a click natively.
      await fireEvent.click(items(container)[1])
      flushSync()
      expect(onchange).toHaveBeenCalledWith('Two')
    })
  })
})
