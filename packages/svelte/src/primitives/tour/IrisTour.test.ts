import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, waitFor } from '@testing-library/svelte'
import IrisTour from './IrisTour.svelte'
import IrisTourI18nHarness from './IrisTourI18nHarness.svelte'

afterEach(cleanup)

const steps = [
  { title: 'Step 1', description: 'First step' },
  { title: 'Step 2', description: 'Second step' },
  { title: 'Step 3', description: 'Last step' },
]

describe('IrisTour', () => {
  it('renders nothing when closed', () => {
    render(IrisTour, { props: { steps, open: false } })
    expect(document.querySelector('[data-iris-tour]')).toBeNull()
  })

  it('renders tour when open', () => {
    render(IrisTour, { props: { steps, open: true } })
    expect(document.querySelector('[data-iris-tour-card]')).not.toBeNull()
  })

  it('shows the first step title', () => {
    render(IrisTour, { props: { steps, open: true } })
    expect(document.querySelector('[data-iris-tour-title]')?.textContent).toBe('Step 1')
  })

  it('shows the step indicator in the default English locale', () => {
    render(IrisTour, { props: { steps, open: true } })
    expect(document.querySelector('[data-iris-tour-indicator]')?.textContent).toBe('Step 1 of 3')
  })

  it('updates the step indicator when the locale switches to zh-CN', async () => {
    const view = render(IrisTourI18nHarness, {
      props: { steps, open: true, locale: 'en-US' },
    })
    expect(document.querySelector('[data-iris-tour-indicator]')?.textContent).toBe('Step 1 of 3')

    await view.rerender({ steps, open: true, locale: 'zh-CN' })
    await waitFor(() => {
      expect(document.querySelector('[data-iris-tour-indicator]')?.textContent).toBe(
        '第 1 步，共 3 步',
      )
    })
  })

  it('advances to next step on Next click', async () => {
    render(IrisTour, { props: { steps, open: true } })
    await fireEvent.click(document.querySelector('[data-iris-tour-next]')!)
    await waitFor(() => {
      expect(document.querySelector('[data-iris-tour-title]')?.textContent).toBe('Step 2')
    })
    expect(document.querySelector('[data-iris-tour-indicator]')?.textContent).toBe('Step 2 of 3')
  })

  it('calls onClose when Skip is clicked', async () => {
    const onClose = vi.fn()
    render(IrisTour, { props: { steps, open: true, onClose } })
    await fireEvent.click(document.querySelector('[data-iris-tour-skip]')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows Finish on last step', async () => {
    render(IrisTour, { props: { steps, open: true } })
    await fireEvent.click(document.querySelector('[data-iris-tour-next]')!)
    await waitFor(() => {
      expect(document.querySelector('[data-iris-tour-title]')?.textContent).toBe('Step 2')
    })
    await fireEvent.click(document.querySelector('[data-iris-tour-next]')!)
    await waitFor(() => {
      const nextBtn = document.querySelector('[data-iris-tour-next]')
      expect(nextBtn?.textContent?.trim()).toBe('Finish')
    })
  })

  it('closes on Escape', async () => {
    const onUpdateOpen = vi.fn()
    render(IrisTour, { props: { steps, open: true, onUpdateOpen } })
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(onUpdateOpen).toHaveBeenCalledWith(false)
  })
})
