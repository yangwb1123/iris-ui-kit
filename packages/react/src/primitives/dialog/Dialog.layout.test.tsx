import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisDialog } from './Dialog'
import { IrisDialogTrigger } from './DialogTrigger'
import { IrisDialogContent, IrisDialogTitle, type IrisDialogContentProps } from './DialogContent'
import { __resetBodyScrollLock } from '../../modal-utils/useBodyScrollLock'

beforeEach(() => __resetBodyScrollLock())
afterEach(() => {
  cleanup()
  __resetBodyScrollLock()
})

function surface(): HTMLElement {
  return document.querySelector('[role=dialog]') as HTMLElement
}

function open(props: Partial<IrisDialogContentProps> = {}, children?: React.ReactNode) {
  return (
    <IrisDialog defaultOpen>
      <IrisDialogTrigger>Open</IrisDialogTrigger>
      <IrisDialogContent {...props}>
        <IrisDialogTitle>Title</IrisDialogTitle>
        {children ?? <input data-testid="first-input" />}
      </IrisDialogContent>
    </IrisDialog>
  )
}

describe('@iris-ui-kit/react IrisDialogContent sizing', () => {
  it('renders content-sized by default (unchanged legacy geometry)', () => {
    render(open())
    const el = surface()
    expect(el.style.width).toBe('')
    expect(el.style.maxWidth).toBe('90vw')
    expect(el.style.maxHeight).toBe('85vh')
    expect(el.hasAttribute('data-iris-dialog-size')).toBe(false)
  })

  it('maps every size preset to its width', () => {
    const widths: Record<string, string> = { sm: '32rem', md: '40rem', lg: '50rem', xl: '60rem' }
    for (const [size, width] of Object.entries(widths)) {
      render(open({ size: size as 'sm' }))
      const el = surface()
      expect(el.style.width).toBe(width)
      expect(el.getAttribute('data-iris-dialog-size')).toBe(size)
      // clamped to the viewport minus both backdrop gutters
      expect(el.style.maxWidth).toBe('calc(100vw - 48px)')
      // border-box so the declared width includes padding + border
      expect(el.style.boxSizing).toBe('border-box')
      cleanup()
    }
  })

  it('an explicit width overrides the preset', () => {
    render(open({ size: 'sm', width: '70vw' }))
    const el = surface()
    expect(el.style.width).toBe('70vw')
    expect(el.getAttribute('data-iris-dialog-size')).toBe('sm')
  })

  it('reads a numeric width as px', () => {
    render(open({ width: 720 }))
    expect(surface().style.width).toBe('720px')
  })

  it('rejects invalid dimensions and falls back to the preset / defaults', () => {
    render(open({ size: 'lg', width: Number.NaN, maxHeight: -1 }))
    const el = surface()
    expect(el.style.width).toBe('50rem')
    expect(el.style.maxHeight).toBe('min(85vh, calc(100vh - 48px))')
    cleanup()

    render(open({ width: Number.POSITIVE_INFINITY }))
    expect(surface().style.width).toBe('')
    expect(surface().style.maxWidth).toBe('90vw')
  })

  it('honors a custom maxHeight', () => {
    render(open({ size: 'md', maxHeight: 400 }))
    expect(surface().style.maxHeight).toBe('min(400px, calc(100vh - 48px))')
    cleanup()
    render(open({ maxHeight: '60vh' }))
    expect(surface().style.maxHeight).toBe('min(60vh, calc(100vh - 48px))')
  })

  it('a consumer style override still wins', () => {
    render(open({ size: 'md', style: { maxWidth: 'none' } }))
    expect(surface().style.maxWidth).toBe('none')
  })

  it('keeps focus trap and ARIA intact on a sized dialog', () => {
    render(
      <IrisDialog defaultOpen>
        <IrisDialogTrigger>Open</IrisDialogTrigger>
        <IrisDialogContent size="lg">
          <IrisDialogTitle>Title</IrisDialogTitle>
          <input data-testid="first" />
          <button type="button" data-testid="last">
            Action
          </button>
        </IrisDialogContent>
      </IrisDialog>,
    )
    const el = surface()
    expect(el.getAttribute('aria-modal')).toBe('true')
    const titleId = el.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(document.getElementById(titleId!)?.textContent).toBe('Title')

    // focus is trapped inside the surface
    act(() => {
      ;(document.querySelector('[data-testid="last"]') as HTMLElement).focus()
    })
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(el.contains(document.activeElement)).toBe(true)
  })

  it('still closes on Escape when sized', () => {
    const onOpenChange = vi.fn()
    render(
      <IrisDialog defaultOpen onOpenChange={onOpenChange}>
        <IrisDialogTrigger>Open</IrisDialogTrigger>
        <IrisDialogContent size="xl">
          <IrisDialogTitle>Title</IrisDialogTitle>
        </IrisDialogContent>
      </IrisDialog>,
    )
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('still closes on a backdrop click when sized', () => {
    const onOpenChange = vi.fn()
    render(
      <IrisDialog defaultOpen onOpenChange={onOpenChange}>
        <IrisDialogTrigger>Open</IrisDialogTrigger>
        <IrisDialogContent size="md" portalTarget={false}>
          <IrisDialogTitle>Title</IrisDialogTitle>
        </IrisDialogContent>
      </IrisDialog>,
    )
    const backdrop = document.querySelector('[data-iris-dialog-backdrop]')!
    fireEvent.pointerDown(backdrop)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('still teleports to document.body by default', () => {
    const { container } = render(open({ size: 'sm' }))
    expect(container.querySelector('[role=dialog]')).toBeNull()
    expect(surface().style.width).toBe('32rem')
  })
})
