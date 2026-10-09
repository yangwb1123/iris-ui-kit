import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisDialog } from './IrisDialog'
import { IrisDialogTrigger } from './IrisDialogTrigger'
import {
  IrisDialogContent,
  IrisDialogTitle,
  type IrisDialogContentProps,
} from './IrisDialogContent'

afterEach(cleanup)

function surface(): HTMLElement {
  return document.querySelector('[role="dialog"]') as HTMLElement
}

function open(content: Partial<IrisDialogContentProps> = {}) {
  return render(() => (
    <IrisDialog defaultOpen>
      <IrisDialogTrigger>Open</IrisDialogTrigger>
      <IrisDialogContent portalTarget={false} {...content}>
        <IrisDialogTitle>Title</IrisDialogTitle>
        <input data-testid="first" />
        <button type="button" data-testid="last">
          Action
        </button>
      </IrisDialogContent>
    </IrisDialog>
  ))
}

describe('@iris-ui-kit/solid IrisDialogContent sizing', () => {
  it('renders content-sized by default (legacy geometry)', () => {
    open()
    const el = surface()
    expect(el.style.width).toBe('')
    expect(el.style.maxWidth).toBe('90vw')
    expect(el.style.maxHeight).toBe('85vh')
    expect(el.hasAttribute('data-iris-dialog-size')).toBe(false)
  })

  it('maps every size preset to its width', () => {
    for (const [size, width] of Object.entries({
      sm: '32rem',
      md: '40rem',
      lg: '50rem',
      xl: '60rem',
    })) {
      open({ size: size as 'sm' })
      const el = surface()
      expect(el.style.width).toBe(width)
      expect(el.getAttribute('data-iris-dialog-size')).toBe(size)
      expect(el.style.maxWidth).toBe('calc(100vw - 48px)')
      expect(el.style.boxSizing).toBe('border-box')
      cleanup()
    }
  })

  it('an explicit width overrides the preset and numbers read as px', () => {
    open({ size: 'sm', width: '70vw' })
    expect(surface().style.width).toBe('70vw')
    cleanup()
    open({ width: 720 })
    expect(surface().style.width).toBe('720px')
  })

  it('rejects invalid dimensions and falls back to the preset / defaults', () => {
    open({ size: 'lg', width: Number.NaN, maxHeight: -1 })
    expect(surface().style.width).toBe('50rem')
    expect(surface().style.maxHeight).toBe('min(85vh, calc(100vh - 48px))')
    cleanup()
    open({ width: Number.POSITIVE_INFINITY })
    expect(surface().style.width).toBe('')
    expect(surface().style.maxWidth).toBe('90vw')
  })

  it('honors a custom maxHeight', () => {
    open({ maxHeight: 400 })
    expect(surface().style.maxHeight).toBe('min(400px, calc(100vh - 48px))')
  })

  it('keeps ARIA, Escape and backdrop dismiss on a sized dialog', () => {
    const onOpenChange = vi.fn()
    const view = render(() => (
      <IrisDialog defaultOpen onOpenChange={onOpenChange}>
        <IrisDialogTrigger>Open</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false} size="lg">
          <IrisDialogTitle>Title</IrisDialogTitle>
        </IrisDialogContent>
      </IrisDialog>
    ))
    const el = surface()
    expect(el.style.width).toBe('50rem')
    expect(el.getAttribute('aria-modal')).toBe('true')
    const titleId = el.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(document.getElementById(titleId!)?.textContent).toBe('Title')

    fireEvent.pointerDown(document.querySelector('[data-iris-dialog-backdrop]')!)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    view.unmount()

    onOpenChange.mockClear()
    open({ size: 'md' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(surface()).toBeNull()
  })
})
