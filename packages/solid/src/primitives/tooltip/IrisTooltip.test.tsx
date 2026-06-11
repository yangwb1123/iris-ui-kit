import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisTooltip } from './IrisTooltip'

afterEach(cleanup)

describe('IrisTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders trigger without crashing', () => {
    const { getByText } = render(() => (
      <IrisTooltip content="Tooltip text" portalTarget={false}>
        <button>Hover me</button>
      </IrisTooltip>
    ))
    expect(getByText('Hover me')).toBeTruthy()
  })

  it('shows tooltip after openDelay on pointer enter', async () => {
    const { getByText, queryByRole } = render(() => (
      <IrisTooltip content="My tooltip" openDelay={100} portalTarget={false}>
        <button>Trigger</button>
      </IrisTooltip>
    ))

    expect(queryByRole('tooltip')).toBeNull()
    fireEvent.pointerEnter(getByText('Trigger').closest('span')!)
    // Async advance flushes microtasks between firing timers, so the reactive
    // open → render settles deterministically even under concurrent CPU load
    // (the sync variant was timing-flaky in the full parallel turbo run).
    await vi.advanceTimersByTimeAsync(150)
    expect(queryByRole('tooltip')).not.toBeNull()
    expect(queryByRole('tooltip')?.textContent).toBe('My tooltip')
  })

  it('hides tooltip after pointer leave', () => {
    const { getByText, queryByRole } = render(() => (
      <IrisTooltip content="My tooltip" openDelay={0} closeDelay={0} portalTarget={false}>
        <button>Trigger</button>
      </IrisTooltip>
    ))

    const span = getByText('Trigger').closest('span')!
    fireEvent.pointerEnter(span)
    expect(queryByRole('tooltip')).not.toBeNull()
    fireEvent.pointerLeave(span)
    expect(queryByRole('tooltip')).toBeNull()
  })

  it('does not show tooltip when disabled', () => {
    const { getByText, queryByRole } = render(() => (
      <IrisTooltip content="Disabled tip" openDelay={0} disabled={true} portalTarget={false}>
        <button>Trigger</button>
      </IrisTooltip>
    ))
    fireEvent.pointerEnter(getByText('Trigger').closest('span')!)
    vi.advanceTimersByTime(1000)
    expect(queryByRole('tooltip')).toBeNull()
  })
})
