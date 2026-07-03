import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import AccordionHarness from './AccordionHarness.svelte'

describe('IrisAccordion', () => {
  it('renders items and toggles open on click', async () => {
    const { getByText, queryByText } = render(AccordionHarness)

    // content should be hidden initially
    expect(queryByText('Content A')).toBeFalsy()

    const triggerA = getByText('Item A')
    await fireEvent.click(triggerA)
    flushSync()

    expect(getByText('Content A')).toBeTruthy()
  })

  it('closes open item on second click when collapsible', async () => {
    const { getByText, queryByText } = render(AccordionHarness, { props: { collapsible: true } })

    const triggerA = getByText('Item A')
    await fireEvent.click(triggerA)
    flushSync()

    expect(getByText('Content A')).toBeTruthy()

    await fireEvent.click(triggerA)
    flushSync()

    expect(queryByText('Content A')).toBeFalsy()
  })

  it('emits onValueChange when an item is toggled (uncontrolled)', async () => {
    const seen: (string | string[] | null)[] = []
    const { getByText } = render(AccordionHarness, {
      props: { onValueChange: (next) => seen.push(next) },
    })

    await fireEvent.click(getByText('Item A'))
    flushSync()
    await fireEvent.click(getByText('Item B'))
    flushSync()

    expect(seen).toEqual(['a', 'b'])
  })

  it('is controlled when `value` is set: clicks emit but do not self-open', async () => {
    const seen: (string | string[] | null)[] = []
    const { getByText, queryByText } = render(AccordionHarness, {
      props: { value: null, onValueChange: (next) => seen.push(next) },
    })

    await fireEvent.click(getByText('Item A'))
    flushSync()

    // Parent owns state — without writing `value` back, nothing opens...
    expect(queryByText('Content A')).toBeFalsy()
    // ...but the change is still emitted so the parent can react.
    expect(seen).toEqual(['a'])
  })

  function triggers(container: HTMLElement): HTMLButtonElement[] {
    return Array.from(
      container.querySelectorAll('[data-iris-accordion-trigger]'),
    ) as HTMLButtonElement[]
  }

  it('Enter toggles the focused header (unmodified existing behavior)', async () => {
    const { container } = render(AccordionHarness)
    const [a] = triggers(container)
    a!.focus()
    await fireEvent.keyDown(a!, { key: 'Enter' })
    flushSync()
    expect(a!.getAttribute('aria-expanded')).toBe('true')
  })

  it('Space toggles the focused header (unmodified existing behavior)', async () => {
    const { container } = render(AccordionHarness)
    const [a] = triggers(container)
    a!.focus()
    await fireEvent.keyDown(a!, { key: ' ' })
    flushSync()
    expect(a!.getAttribute('aria-expanded')).toBe('true')
  })

  it('ArrowDown moves focus to the next header', async () => {
    const { container } = render(AccordionHarness)
    const [a, b] = triggers(container)
    a!.focus()
    await fireEvent.keyDown(a!, { key: 'ArrowDown' })
    flushSync()
    expect(document.activeElement).toBe(b)
  })

  it('ArrowUp moves focus to the previous header', async () => {
    const { container } = render(AccordionHarness)
    const [a, b] = triggers(container)
    b!.focus()
    await fireEvent.keyDown(b!, { key: 'ArrowUp' })
    flushSync()
    expect(document.activeElement).toBe(a)
  })

  it('ArrowDown wraps from the last header to the first (loop: true)', async () => {
    const { container } = render(AccordionHarness)
    const items = triggers(container)
    const last = items[items.length - 1]!
    last.focus()
    await fireEvent.keyDown(last, { key: 'ArrowDown' })
    flushSync()
    expect(document.activeElement).toBe(items[0])
  })

  it('ArrowUp wraps from the first header to the last (loop: true)', async () => {
    const { container } = render(AccordionHarness)
    const items = triggers(container)
    const first = items[0]!
    first.focus()
    await fireEvent.keyDown(first, { key: 'ArrowUp' })
    flushSync()
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('End jumps focus to the last header', async () => {
    const { container } = render(AccordionHarness)
    const items = triggers(container)
    items[0]!.focus()
    await fireEvent.keyDown(items[0]!, { key: 'End' })
    flushSync()
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('Home jumps focus to the first header', async () => {
    const { container } = render(AccordionHarness)
    const items = triggers(container)
    const last = items[items.length - 1]!
    last.focus()
    await fireEvent.keyDown(last, { key: 'Home' })
    flushSync()
    expect(document.activeElement).toBe(items[0])
  })
})
