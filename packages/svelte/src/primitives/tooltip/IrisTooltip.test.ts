import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisTooltip from './IrisTooltip.svelte'
import TooltipHarness from './TooltipHarness.svelte'

afterEach(cleanup)

describe('IrisTooltip', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisTooltip, { props: { content: 'Hello' } })
    expect(container).toBeTruthy()
  })

  it('tooltip is not shown initially', () => {
    const { container } = render(IrisTooltip, { props: { content: 'Hi' } })
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('shows tooltip immediately when openDelay=0 on pointerenter', async () => {
    const { container } = render(IrisTooltip, { props: { content: 'Hi', openDelay: 0 } })
    const trigger = container.querySelector('[data-iris-tooltip-trigger]')!
    await fireEvent.pointerEnter(trigger)
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull()
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Hi')
  })

  it('hides tooltip on Escape', async () => {
    const { container } = render(IrisTooltip, { props: { content: 'Hi', openDelay: 0 } })
    const trigger = container.querySelector('[data-iris-tooltip-trigger]')!
    await fireEvent.pointerEnter(trigger)
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull()
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('does not show when disabled', async () => {
    const { container } = render(IrisTooltip, {
      props: { content: 'Hi', openDelay: 0, disabled: true },
    })
    const trigger = container.querySelector('[data-iris-tooltip-trigger]')!
    await fireEvent.pointerEnter(trigger)
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('uses rerendered hover delays', async () => {
    const { container, rerender } = render(IrisTooltip, {
      props: { content: 'Hi', openDelay: 10_000 },
    })
    await rerender({ content: 'Hi', openDelay: 0 })
    await fireEvent.pointerEnter(container.querySelector('[data-iris-tooltip-trigger]')!)
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull()
  })

  it('opens when a child trigger receives keyboard focus', async () => {
    const { getByTestId } = render(TooltipHarness)
    await fireEvent.focusIn(getByTestId('tooltip-child'))
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull()
  })
})
