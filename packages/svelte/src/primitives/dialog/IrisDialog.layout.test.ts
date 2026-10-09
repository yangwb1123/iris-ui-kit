import { render, fireEvent, cleanup } from '@testing-library/svelte'
import { describe, expect, it, afterEach } from 'vitest'
import DialogSizeHarness from './DialogSizeHarness.svelte'

afterEach(cleanup)

function surface(): HTMLElement | null {
  return document.querySelector('[data-iris-dialog-content]')
}
function styleOf(el: HTMLElement): string {
  return el.getAttribute('style') ?? ''
}

describe('@iris-ui-kit/svelte IrisDialogContent sizing', () => {
  it('renders content-sized by default (legacy geometry)', () => {
    render(DialogSizeHarness)
    const el = surface()!
    // jsdom's CSS parser drops a bare `vw` length, so the legacy 90vw cap shows
    // up as an absent max-width; what matters is that no clamp was requested.
    expect(styleOf(el)).not.toContain('max-width')
    expect(styleOf(el)).toContain('max-height: 85vh')
    expect(styleOf(el)).not.toContain('width: 40rem')
    expect(el.hasAttribute('data-iris-dialog-size')).toBe(false)
  })

  it('maps every size preset to its width', () => {
    for (const [size, width] of Object.entries({
      sm: '32rem',
      md: '40rem',
      lg: '50rem',
      xl: '60rem',
    })) {
      render(DialogSizeHarness, { props: { size: size as 'sm' } })
      const el = surface()!
      expect(styleOf(el)).toContain(`width: ${width}`)
      expect(styleOf(el)).toContain('box-sizing: border-box')
      expect(styleOf(el)).toContain('max-width: calc(100vw - 48px)')
      expect(el.getAttribute('data-iris-dialog-size')).toBe(size)
      cleanup()
    }
  })

  it('an explicit width overrides the preset and numbers read as px', () => {
    render(DialogSizeHarness, { props: { size: 'sm', width: '70vw' } })
    expect(styleOf(surface()!)).toContain('width: 70vw')
    cleanup()
    render(DialogSizeHarness, { props: { width: 720 } })
    expect(styleOf(surface()!)).toContain('width: 720px')
  })

  it('rejects invalid dimensions and falls back to the preset / defaults', () => {
    render(DialogSizeHarness, {
      props: { size: 'lg', width: Number.NaN, maxHeight: -1 },
    })
    expect(styleOf(surface()!)).toContain('width: 50rem')
    expect(styleOf(surface()!)).toContain('max-height: min(85vh, calc(100vh - 48px))')
    cleanup()
    render(DialogSizeHarness, { props: { width: Number.POSITIVE_INFINITY } })
    expect(styleOf(surface()!)).not.toContain('max-width')
  })

  it('honors a custom maxHeight', () => {
    render(DialogSizeHarness, { props: { maxHeight: 400 } })
    expect(styleOf(surface()!)).toContain('max-height: min(400px, calc(100vh - 48px))')
  })

  it('keeps ARIA and backdrop dismiss on a sized dialog', async () => {
    render(DialogSizeHarness, { props: { size: 'lg' } })
    const el = surface()!
    expect(styleOf(el)).toContain('width: 50rem')
    expect(el.getAttribute('role')).toBe('dialog')
    expect(el.getAttribute('aria-modal')).toBe('true')
    const titleId = el.getAttribute('aria-labelledby')!
    expect(document.getElementById(titleId)?.textContent).toContain('Dialog Title')

    // clicking the backdrop closes; clicking inside does not
    const backdrop = document.querySelector('[data-iris-dialog-backdrop]')!
    fireEvent.pointerDown(el)
    expect(surface()).not.toBeNull()
    fireEvent.pointerDown(backdrop)
    expect(surface()).toBeNull()
  })

  it('still closes on Escape when sized', async () => {
    render(DialogSizeHarness, { props: { size: 'md' } })
    expect(surface()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(surface()).toBeNull()
  })
})
