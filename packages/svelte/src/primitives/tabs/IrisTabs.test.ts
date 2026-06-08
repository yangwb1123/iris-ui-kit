import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
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
})
