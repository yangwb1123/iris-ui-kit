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
})
