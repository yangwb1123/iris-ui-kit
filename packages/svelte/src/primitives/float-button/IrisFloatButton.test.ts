import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisFloatButton from './IrisFloatButton.svelte'

describe('IrisFloatButton', () => {
  it('renders a FAB button', () => {
    const { container } = render(IrisFloatButton)
    expect(container.querySelector('[data-iris-float-button]')).not.toBeNull()
  })

  it('shows default + icon', () => {
    const { container } = render(IrisFloatButton)
    expect(container.querySelector('[data-iris-float-button]')!.textContent?.trim()).toBe('+')
  })

  it('calls onclick when no actions', async () => {
    const onclick = vi.fn()
    const { container } = render(IrisFloatButton, { props: { onclick } })
    await fireEvent.click(container.querySelector('[data-iris-float-button]')!)
    flushSync()
    expect(onclick).toHaveBeenCalled()
  })

  it('opens action menu when actions provided', async () => {
    const actions = [{ key: 'a', label: 'Action A' }]
    const { container } = render(IrisFloatButton, { props: { actions } })
    await fireEvent.click(container.querySelector('[data-iris-float-button]')!)
    flushSync()
    expect(container.querySelector('[data-iris-float-button-actions]')).not.toBeNull()
  })
})
