import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import DialogHarness from './DialogHarness.svelte'

afterEach(cleanup)

describe('IrisDialog', () => {
  it('renders without crashing', () => {
    const { container } = render(DialogHarness)
    expect(container).toBeTruthy()
  })

  it('content is not shown initially', () => {
    const { container } = render(DialogHarness)
    expect(container.querySelector('[data-iris-dialog-content]')).toBeNull()
  })

  it('opens on trigger click', async () => {
    const { getByText } = render(DialogHarness)
    await fireEvent.click(getByText('Open Dialog'))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.querySelector('[data-iris-dialog-content]')).not.toBeNull()
  })

  it('shows title text', async () => {
    const { getByText } = render(DialogHarness)
    await fireEvent.click(getByText('Open Dialog'))
    expect(document.querySelector('[data-iris-dialog-title]')?.textContent).toBe('Dialog Title')
  })

  it('closes when Close button is clicked', async () => {
    const { getByText } = render(DialogHarness)
    await fireEvent.click(getByText('Open Dialog'))
    expect(document.querySelector('[data-iris-dialog-content]')).not.toBeNull()
    await fireEvent.click(getByText('Close'))
    expect(document.querySelector('[data-iris-dialog-content]')).toBeNull()
  })
})
