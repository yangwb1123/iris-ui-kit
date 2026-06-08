import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisTour } from './IrisTour'

afterEach(cleanup)

const steps = [
  { title: 'Welcome', description: 'This is the first step' },
  { title: 'Second step', description: 'This is step two' },
  { title: 'Final step', description: 'The last step' },
]

describe('IrisTour', () => {
  it('renders nothing when closed', () => {
    render(() => <IrisTour steps={steps} open={false} />)
    expect(document.body.querySelector('[data-iris-tour]')).toBeNull()
  })

  it('renders tour card when open (via Portal in body)', () => {
    render(() => <IrisTour steps={steps} open={true} />)
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('shows first step title', () => {
    render(() => <IrisTour steps={steps} open={true} />)
    const card = document.body.querySelector('[data-iris-tour-card]')
    expect(card?.textContent).toContain('Welcome')
  })

  it('advances to next step on Next click', async () => {
    render(() => <IrisTour steps={steps} open={true} />)
    const nextBtn = document.body.querySelector('[data-iris-tour-next]') as HTMLButtonElement
    expect(nextBtn).not.toBeNull()
    fireEvent.click(nextBtn)
    // Solid updates synchronously
    expect(document.body.querySelector('[data-iris-tour-card]')?.textContent).toContain(
      'Second step',
    )
  })

  it('calls onClose when Skip is clicked', () => {
    const onClose = vi.fn()
    const onOpenChange = vi.fn()
    render(() => (
      <IrisTour steps={steps} open={true} onClose={onClose} onOpenChange={onOpenChange} />
    ))
    const skipBtn = document.body.querySelector('[data-iris-tour-skip]') as HTMLButtonElement
    expect(skipBtn).not.toBeNull()
    fireEvent.click(skipBtn)
    expect(onClose).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onFinish on last step Next click', () => {
    const onFinish = vi.fn()
    const onClose = vi.fn()
    const onOpenChange = vi.fn()
    render(() => (
      <IrisTour
        steps={[{ title: 'Only step' }]}
        open={true}
        onFinish={onFinish}
        onClose={onClose}
        onOpenChange={onOpenChange}
      />
    ))
    const nextBtn = document.body.querySelector('[data-iris-tour-next]') as HTMLButtonElement
    expect(nextBtn).not.toBeNull()
    expect(nextBtn.textContent).toBe('Finish')
    fireEvent.click(nextBtn)
    expect(onFinish).toHaveBeenCalled()
  })
})
