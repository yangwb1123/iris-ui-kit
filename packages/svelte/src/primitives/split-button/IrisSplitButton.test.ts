import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisSplitButton from './IrisSplitButton.svelte'

afterEach(cleanup)

describe('IrisSplitButton', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisSplitButton)
    expect(container).toBeTruthy()
  })

  it('renders main button', () => {
    const { container } = render(IrisSplitButton)
    expect(container.querySelector('[data-iris-split-button-main]')).not.toBeNull()
  })

  it('calls onclick on main button click', async () => {
    const onclick = vi.fn()
    const { container } = render(IrisSplitButton, { props: { onclick } })
    await fireEvent.click(container.querySelector('[data-iris-split-button-main]')!)
    expect(onclick).toHaveBeenCalledTimes(1)
  })

  it('shows actions menu on chevron click', async () => {
    const actions = [
      { key: 'a', label: 'Action A' },
      { key: 'b', label: 'Action B' },
    ]
    const { container } = render(IrisSplitButton, { props: { actions } })
    await fireEvent.click(container.querySelector('[data-iris-split-button-trigger]')!)
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    expect(container.querySelectorAll('[role="menuitem"]').length).toBe(2)
  })

  it('closes menu and calls action onclick', async () => {
    const actionFn = vi.fn()
    const actions = [{ key: 'a', label: 'Action A', onclick: actionFn }]
    const { container } = render(IrisSplitButton, { props: { actions } })
    await fireEvent.click(container.querySelector('[data-iris-split-button-trigger]')!)
    await fireEvent.click(container.querySelector('[data-iris-split-button-item]')!)
    expect(actionFn).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })
})
