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
})
