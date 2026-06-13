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

  it('renders the description with the context description id', async () => {
    const { getByText } = render(DialogHarness)
    await fireEvent.click(getByText('Open Dialog'))
    const desc = document.querySelector('[data-iris-dialog-description]')
    expect(desc?.textContent).toBe('Dialog body content')
    expect(desc?.id).toBeTruthy()
  })

  it('wires aria-labelledby/aria-describedby to the mounted title and description', async () => {
    const { getByText } = render(DialogHarness)
    await fireEvent.click(getByText('Open Dialog'))
    const content = document.querySelector('[role="dialog"]')!
    const title = document.querySelector('[data-iris-dialog-title]')!
    const desc = document.querySelector('[data-iris-dialog-description]')!
    expect(content.getAttribute('aria-labelledby')).toBe(title.id)
    expect(content.getAttribute('aria-describedby')).toBe(desc.id)
  })

  it('closes when Close button is clicked', async () => {
    const { getByText } = render(DialogHarness)
    await fireEvent.click(getByText('Open Dialog'))
    expect(document.querySelector('[data-iris-dialog-content]')).not.toBeNull()
    await fireEvent.click(getByText('Close'))
    expect(document.querySelector('[data-iris-dialog-content]')).toBeNull()
  })
})
