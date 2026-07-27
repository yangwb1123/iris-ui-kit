import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import DialogHarness from './DialogHarness.svelte'
import DialogAsChildHarness from './DialogAsChildHarness.svelte'

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

  describe('asChild', () => {
    it('renders the child as the trigger with no wrapper button (single button)', () => {
      const { container } = render(DialogAsChildHarness)
      const buttons = container.querySelectorAll('button')
      // No wrapper <button> around the IrisButton — exactly one button, and it
      // is the IrisButton itself (the cause of the <button>-in-<button> SSR
      // node_invalid_placement / hydration mismatch was the wrapper).
      expect(buttons.length).toBe(1)
      const trigger = buttons[0]
      expect(trigger.classList.contains('iris-button')).toBe(true)
      expect(trigger.classList.contains('trigger-rest')).toBe(true)
      expect(trigger.id).toBe('dialog-trigger')
      expect(trigger.getAttribute('data-trigger-rest')).toBe('kept')
    })

    it('forwards trigger attrs (aria-*/data-state) onto the child element', () => {
      const { container } = render(DialogAsChildHarness)
      const trigger = container.querySelector('button')!
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-controls')).toBeTruthy()
      expect(trigger.getAttribute('data-state')).toBe('closed')
    })

    it('opens the dialog when the asChild trigger is clicked', async () => {
      const { getByText } = render(DialogAsChildHarness)
      expect(document.querySelector('[data-iris-dialog-content]')).toBeNull()
      await fireEvent.click(getByText('Open Dialog'))
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
      expect(document.querySelector('[data-iris-dialog-content]')).not.toBeNull()
    })

    it('closes the dialog when the asChild Close child is clicked', async () => {
      const { getByText } = render(DialogAsChildHarness)
      await fireEvent.click(getByText('Open Dialog'))
      const closeBtn = getByText('Close')
      // The Close child is the IrisButton itself (no wrapper) carrying the
      // forwarded data-iris-dialog-close hook.
      expect(closeBtn.tagName).toBe('BUTTON')
      expect(closeBtn.classList.contains('iris-button')).toBe(true)
      expect(closeBtn.getAttribute('data-iris-dialog-close')).not.toBeNull()
      expect(closeBtn.id).toBe('dialog-close')
      expect(closeBtn.getAttribute('data-close-rest')).toBe('kept')
      await fireEvent.click(closeBtn)
      expect(document.querySelector('[data-iris-dialog-content]')).toBeNull()
    })
  })
})
